"""End-to-end tests: register -> scan -> workflow -> patch -> approve -> revert.

These run the real bundled samples through the real orchestrator.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from breakpoint import investigations
from breakpoint.errors import ForbiddenError
from breakpoint.projects import register_project_action

REPO_ROOT = Path(__file__).resolve().parents[2]
NODE_SAMPLE = REPO_ROOT / "sample-project"
PY_SAMPLE = REPO_ROOT / "python-sample-project"


def _verify_project_clean(sample: Path) -> None:
    dirty = subprocess.run(
        ["git", "status", "--porcelain", str(sample)],
        capture_output=True,
        text=True,
        cwd=str(REPO_ROOT),
    ).stdout.strip()
    # Untracked entries (a brand-new sample not yet committed) are fine;
    # the patch flow must leave every TRACKED file byte-identical.
    tracked_dirty = [line for line in dirty.splitlines() if line and not line.startswith("??")]
    assert not tracked_dirty, f"{sample} left dirty: {tracked_dirty}"


def test_forbidden_root_rejected(isolated_store):
    with pytest.raises(Exception):
        register_project_action("/etc", False)


def test_untrusted_run_refused(isolated_store, node_sample):
    registered = register_project_action(str(NODE_SAMPLE), False)
    investigations.start_investigation(registered["project"]["id"])
    with pytest.raises(Exception):
        investigations.run_controlled_workflow({})


def test_node_sample_full_cycle(isolated_store, node_sample):
    """The bundled Node sample: triage finds the failing pair; patch verifies."""
    registered = register_project_action(str(NODE_SAMPLE), True)
    investigations.start_investigation(registered["project"]["id"])

    result = investigations.run_controlled_workflow({})
    assert result["investigation"]["status"] == "needs_review"
    assert result["investigation"]["target"]["testFile"].endswith("session-flow.test.js")
    assert len(result["runs"]) >= 4
    findings = result["comparisons"][-1]["findings"]
    assert any(finding["certainty"] == "observed" for finding in findings)
    hypothesis = result["hypotheses"][-1]
    assert hypothesis["supportingEvidenceIds"], "hypothesis must cite evidence"

    patch_result = investigations.propose_patch()
    patch = patch_result["patches"][-1]
    from breakpoint.store import read_store

    internal_patch = next(item for item in read_store()["patches"] if item["id"] == patch["id"])
    assert patch["status"] == "draft"
    assert internal_patch["edits"], "draft must record exact edits"

    verify_result = investigations.approve_and_verify_patch(patch["id"])
    assert verify_result["verifications"][-1]["result"] == "verified"
    assert verify_result["investigation"]["status"] == "verified"

    revert_result = investigations.revert_patch_action(patch["id"])
    assert revert_result["patches"][-1]["status"] == "reverted"
    _verify_project_clean(NODE_SAMPLE)


def test_pytest_sample_full_cycle(isolated_store, py_sample):
    """The pytest sample proves the same pipeline works for python suites."""
    registered = register_project_action(str(PY_SAMPLE), True)
    investigations.start_investigation(registered["project"]["id"])

    result = investigations.run_controlled_workflow({})
    assert result["investigation"]["status"] == "needs_review"
    target = result["investigation"]["target"]
    assert target["testFile"] == "tests/test_ledger_flow.py"
    assert target["targetTest"] == "test_expected_total"
    assert target["predecessorTest"] == "test_charge_is_recorded"

    # The matrix must contain the ordered failing run and the passing solo run.
    statuses = {(run["label"].split(" — ")[0], run["status"]) for run in result["runs"]}
    assert ("target test in isolation", "passed") in statuses
    assert ("file in declared order", "failed") in statuses

    patch_result = investigations.propose_patch()
    patch = patch_result["patches"][-1]
    from breakpoint.store import read_store

    internal_patch = next(item for item in read_store()["patches"] if item["id"] == patch["id"])
    assert patch["status"] == "draft"
    # The sample exports reset_ledger, so Case 1 wires it into an autouse fixture.
    assert "reset_ledger" in patch["description"]
    assert "autouse" in internal_patch["edits"][-1]["appliedContent"]

    verify_result = investigations.approve_and_verify_patch(patch["id"])
    assert verify_result["verifications"][-1]["result"] == "verified"

    revert_result = investigations.revert_patch_action(patch["id"])
    assert revert_result["patches"][-1]["status"] == "reverted"
    _verify_project_clean(PY_SAMPLE)


def test_demo_only_scopes_to_demo_investigation(isolated_store, node_sample):
    """A fresh investigation stays untouched while the demo flow runs."""
    registered = register_project_action(str(NODE_SAMPLE), True)
    started = investigations.start_investigation(registered["project"]["id"])
    assert started["investigation"]["id"] != investigations.DEMO_INVESTIGATION_ID

    demo_result = investigations.run_controlled_workflow({"demoOnly": True})
    assert demo_result["investigation"]["id"] == investigations.DEMO_INVESTIGATION_ID
    assert len(demo_result["runs"]) >= 4

    current = investigations.get_investigation()
    assert current["investigation"]["id"] == started["investigation"]["id"]
    assert len(current["runs"]) == 0
    _verify_project_clean(NODE_SAMPLE)


def test_investigation_action_validation():
    from fastapi.testclient import TestClient
    from breakpoint.api import app

    client = TestClient(app)
    resp = client.post("/api/investigations", json={"action": "start-investigation"})
    assert resp.status_code == 400
    assert "projectId is required" in resp.json()["error"]

    resp = client.post("/api/investigations", json={"action": "approve-patch"})
    assert resp.status_code == 400
    assert "patchId is required" in resp.json()["error"]

    resp = client.post("/api/investigations", json={"action": "revert-patch"})
    assert resp.status_code == 400
    assert "patchId is required" in resp.json()["error"]
