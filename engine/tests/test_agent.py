"""Tests for the deterministic hypothesis engine."""

from breakpoint.agent import deterministic_hypothesis


def test_deterministic_hypothesis_narrative_preserves_order():
    state_findings = [
        {
            "id": "st_1",
            "kind": "module-state",
            "file": "src/cache.js",
            "statement": "Module-level state in `sessionCache`.",
        },
        {
            "id": "st_2",
            "kind": "module-state",
            "file": "src/user.js",
            "statement": "Module-level state in `activeToken`.",
        },
        {
            "id": "st_3",
            "kind": "exported-mutator",
            "statement": "Exported function `setSession` mutates state.",
        },
        {
            "id": "st_4",
            "kind": "exported-mutator",
            "statement": "Exported function `setToken` mutates state.",
        },
        {
            "id": "st_5",
            "kind": "no-hooks",
            "statement": "No cleanup hooks detected.",
        },
    ]
    comparison_findings = [
        {
            "category": "order",
            "certainty": "observed",
            "evidenceIds": ["ev_run_1"],
            "statement": "Order dependent failure observed.",
        }
    ]
    evidence = [{"id": "ev_run_1"}, {"id": "ev_st_1"}]
    analysis_evidence_ids = {"st_1": "ev_st_1"}

    hyp = deterministic_hypothesis(
        "inv_123",
        comparison_findings,
        state_findings,
        evidence,
        analysis_evidence_ids,
    )

    assert hyp["investigationId"] == "inv_123"
    assert hyp["source"] == "deterministic"
    assert hyp["confidence"] == "medium"
    assert "sessionCache" in hyp["description"]
    assert "activeToken" in hyp["description"]
    # Verify exact appearance ordering: sessionCache before activeToken, setSession before setToken
    assert hyp["description"].index("`sessionCache`") < hyp["description"].index("`activeToken`")
    assert hyp["description"].index("`setSession`") < hyp["description"].index("`setToken`")
    assert hyp["description"].index("src/cache.js") < hyp["description"].index("src/user.js")
    assert "ev_run_1" in hyp["supportingEvidenceIds"]
    assert "ev_st_1" in hyp["supportingEvidenceIds"]


def test_deterministic_hypothesis_unproven_state():
    hyp = deterministic_hypothesis(
        "inv_456",
        [],
        [],
        [],
        {},
    )
    assert hyp["confidence"] == "low"
    assert "mechanism remains unproven" in hyp["description"]
