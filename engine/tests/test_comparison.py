"""Tests for matrix-aware run comparison."""

from breakpoint.comparison import compare_run_matrix


def test_compare_run_matrix_empty():
    assert compare_run_matrix([], []) == []


def test_compare_run_matrix_all_pass():
    runs = [
        {
            "id": "run_1",
            "label": "target test in isolation",
            "status": "passed",
            "tests": [{"name": "test_feature", "status": "passed"}],
        },
        {
            "id": "run_2",
            "label": "file in declared order",
            "status": "passed",
            "tests": [{"name": "test_feature", "status": "passed"}],
        },
    ]
    evidence = [
        {"id": "ev_1", "kind": "run", "sourceRunIds": ["run_1"]},
        {"id": "ev_2", "kind": "run", "sourceRunIds": ["run_2"]},
    ]
    findings = compare_run_matrix(runs, evidence)
    assert any("Every probed run passed" in f["statement"] for f in findings)
    assert any(f["category"] == "state" for f in findings)


def test_compare_run_matrix_conflicting_outcomes():
    runs = [
        {
            "id": "run_solo",
            "label": "target test in isolation",
            "status": "passed",
            "tests": [{"name": "test_auth", "status": "passed"}],
        },
        {
            "id": "run_pred",
            "label": "predecessor test in isolation",
            "status": "passed",
            "tests": [{"name": "test_seed", "status": "passed"}],
        },
        {
            "id": "run_ordered",
            "label": "file in declared order",
            "status": "failed",
            "exitCode": 1,
            "tests": [
                {"name": "test_seed", "status": "passed"},
                {"name": "test_auth", "status": "failed", "error": "session expired"},
            ],
        },
    ]
    evidence = [
        {"id": "ev_solo", "kind": "run", "sourceRunIds": ["run_solo"]},
        {"id": "ev_pred", "kind": "run", "sourceRunIds": ["run_pred"]},
        {"id": "ev_ord", "kind": "run", "sourceRunIds": ["run_ordered"]},
    ]
    findings = compare_run_matrix(runs, evidence)
    order_findings = [f for f in findings if f["category"] == "order"]
    assert len(order_findings) == 1
    assert "test_auth" in order_findings[0]["statement"]
    assert order_findings[0]["evidenceIds"] == ["ev_solo", "ev_ord"]
    assert order_findings[0]["certainty"] == "observed"

    status_findings = [f for f in findings if f["category"] == "status"]
    assert any("passes alone" in f["statement"] for f in status_findings)
