"""Investigation orchestrator: every product action lives here.

Pipeline for any registered project:
  static shared-state analysis -> triage runs -> resolve failing target and
  predecessor from real failures -> focused matrix runs (target solo,
  predecessor solo, ordered file, reproducibility probe) -> matrix-aware
  comparison -> deterministic hypothesis -> approval-gated multi-file patch
  -> verification rerun.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .agent import deterministic_hypothesis
from .comparison import compare_run_matrix
from .discovery import build_run_command, discover_files
from .errors import ForbiddenError, NotFoundError, ValidationError
from .patch_review import apply_patch as apply_patch_to_disk
from .patch_review import draft_cleanup_patch, read_text_exact, revert_patch as revert_patch_on_disk, verify_run
from .projects import analyze_registered_project
from .runner import build_matrix_specs, execute_run_spec, rerun_recorded_spec
from .state_analysis import choose_target, ordered_test_names
from .store import read_store, write_store

DEMO_PROJECT_ID = "project_demo"
DEMO_INVESTIGATION_ID = "inv_session_state"
MAX_TRIAGE_FILES = 3


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _sample_project_root() -> str:
    """Bundled sample lives next to the package root, independent of cwd."""
    return str(Path(__file__).resolve().parents[2] / "sample-project")


def bootstrap(data: dict) -> dict:
    """Ensures the built-in demo project and its investigation exist."""
    project = next((item for item in data["projects"] if item["id"] == DEMO_PROJECT_ID), None)
    if project is None:
        project = {
            "id": DEMO_PROJECT_ID,
            "name": "Trusted session-state demo",
            "root": _sample_project_root(),
            "trusted": True,
            "framework": "node",
            "testFiles": [],
            "createdAt": _now_iso(),
        }
        data["projects"].append(project)
    # Migrate the legacy relative root and refresh discovery metadata.
    if not os.path.isabs(project["root"]):
        project["root"] = str((Path(__file__).resolve().parents[2] / project["root"]))
    if not project.get("framework") or not project.get("testFiles"):
        files = discover_files(project["root"])
        project["framework"] = "node"
        project["testFiles"] = files["testFiles"]

    investigation = next((item for item in data["investigations"] if item["id"] == DEMO_INVESTIGATION_ID), None)
    if investigation is None:
        investigation = {
            "id": DEMO_INVESTIGATION_ID,
            "projectId": project["id"],
            "title": "Session state persists between tests",
            "status": "open",
            "goal": "Find why this test fails depending on execution order.",
            "target": None,
            "runIds": [], "evidenceIds": [], "hypothesisIds": [], "comparisonIds": [],
            "patchIds": [], "verificationIds": [], "analysisIds": [],
            "createdAt": _now_iso(), "updatedAt": _now_iso(),
        }
        data["investigations"].append(investigation)
    return {"project": project, "investigation": investigation}


def current_investigation(data: dict) -> dict | None:
    """The active investigation is the most recently created one."""
    investigations = data["investigations"]
    return investigations[-1] if investigations else None


def investigation_for(data: dict, demo_only: bool) -> dict | None:
    """Resolves which investigation an action applies to.

    The embedded landing demo passes demo_only so it always acts on the
    trusted sample, even when another project's investigation is active.
    """
    if demo_only:
        demo = next((item for item in data["investigations"] if item["id"] == DEMO_INVESTIGATION_ID), None)
        return demo or current_investigation(data)
    return current_investigation(data)


def public_run(run: dict) -> dict:
    """Run shape safe to send to clients: raw output stays on the server."""
    return {
        "id": run["id"], "projectId": run.get("projectId"), "label": run["label"], "status": run["status"],
        "command": run["command"], "workingDirectory": run["workingDirectory"],
        "startedAt": run["startedAt"], "finishedAt": run["finishedAt"], "durationMs": run["durationMs"],
        "exitCode": run["exitCode"], "tests": run["tests"], "environment": run["environment"],
        "spec": run["spec"],
        "stdoutBytes": len(run.get("stdout", "").encode("utf-8")),
        "stderrBytes": len(run.get("stderr", "").encode("utf-8")),
    }


def public_patch(patch: dict) -> dict:
    """Patch shape safe to send to clients: edit contents stay on the server."""
    return {
        "id": patch["id"], "investigationId": patch["investigationId"], "description": patch["description"],
        "diff": patch["diff"], "status": patch["status"], "baseline": patch["baseline"], "targetPath": patch["targetPath"],
    }


def evidence_record(investigation_id: str, kind: str, statement: str, source_run_ids: list[str], observed: bool, source_evidence_ids: list[str] | None = None) -> dict:
    return {
        "id": f"ev_{uuid.uuid4().hex[:8]}",
        "investigationId": investigation_id,
        "kind": kind,
        "statement": statement,
        "sourceRunIds": source_run_ids,
        "observed": observed,
        "sourceEvidenceIds": source_evidence_ids or [],
        "createdAt": _now_iso(),
    }


def snapshot(data: dict, investigation: dict) -> dict:
    """The full investigation snapshot clients render."""
    project = next((item for item in data["projects"] if item["id"] == investigation.get("projectId")), None)
    runs = [data_runs for data_runs in (next((run for run in data["runs"] if run["id"] == run_id), None) for run_id in investigation.get("runIds", [])) if data_runs]
    return {
        "investigation": investigation,
        "project": project,
        "runs": [public_run(run) for run in runs],
        "evidence": [item for item in (next((e for e in data["evidence"] if e["id"] == evidence_id), None) for evidence_id in investigation.get("evidenceIds", [])) if item],
        "comparisons": [item for item in (next((c for c in data["comparisons"] if c["id"] == comparison_id), None) for comparison_id in investigation.get("comparisonIds", [])) if item],
        "analyses": [item for item in data["analyses"] if item.get("investigationId") == investigation["id"]],
        "hypotheses": [item for item in (next((h for h in data["hypotheses"] if h["id"] == hypothesis_id), None) for hypothesis_id in investigation.get("hypothesisIds", [])) if item],
        "toolInvocations": [item for item in data["toolInvocations"] if item.get("investigationId") == investigation["id"]],
        "patches": [public_patch(patch) for patch in (next((p for p in data["patches"] if p["id"] == patch_id), None) for patch_id in investigation.get("patchIds", [])) if patch],
        "verifications": [item for item in (next((v for v in data["verifications"] if v["id"] == verification_id), None) for verification_id in investigation.get("verificationIds", [])) if item],
    }


def record_run(data: dict, investigation: dict, run: dict, on_evidence=None) -> None:
    """Persists a run, links it, and records one run-kind evidence item."""
    data["runs"].append(run)
    investigation["runIds"].append(run["id"])
    evidence = evidence_record(
        investigation["id"],
        "run",
        f"Run `{run['label']}` recorded with status `{run['status']}` (exit {run['exitCode']}).",
        [run["id"]],
        run["status"] in ("passed", "failed"),
    )
    data["evidence"].append(evidence)
    investigation["evidenceIds"].append(evidence["id"])
    if on_evidence is not None:
        on_evidence(evidence)


def project_for(data: dict, investigation: dict) -> dict:
    """Resolves the project that owns an investigation."""
    project = next((item for item in data["projects"] if item["id"] == investigation.get("projectId")), None)
    if project is None:
        raise NotFoundError("The project for this investigation no longer exists.")
    return project


def read_project_texts(project: dict) -> dict:
    """Reads every discovered file's text (tests and sources) for a project."""
    files = discover_files(project["root"])
    file_texts: dict[str, str] = {}
    for rel in [*files["testFiles"], *files["sourceFiles"]]:
        try:
            file_texts[rel] = read_text_exact(Path(project["root"]) / rel)
        except OSError:
            continue  # unreadable files are skipped; analysis proceeds with what it can read
    return {"fileTexts": file_texts, "testFiles": files["testFiles"], "sourceFiles": files["sourceFiles"]}


def persist_analysis(data: dict, investigation: dict, findings_raw: list[dict]) -> dict:
    """Persists analysis findings and returns them plus the evidence map."""
    findings: list[dict] = []
    analysis_evidence_ids: dict[str, str] = {}
    for raw in findings_raw:
        finding = {**raw, "id": _new_id("st"), "investigationId": investigation["id"]}
        data["analyses"].append(finding)
        investigation["analysisIds"].append(finding["id"])
        evidence = evidence_record(
            investigation["id"],
            "analysis",
            finding["statement"],
            [],
            finding["certainty"] == "observed",
        )
        data["evidence"].append(evidence)
        investigation["evidenceIds"].append(evidence["id"])
        analysis_evidence_ids[finding["id"]] = evidence["id"]
        findings.append(finding)
    return {"findings": findings, "analysisEvidenceIds": analysis_evidence_ids}


def get_investigation(on_event=None) -> dict:
    """The snapshot the workspace loads."""
    data = read_store()
    bootstrap(data)
    write_store(data)
    return snapshot(data, current_investigation(data) or data["investigations"][0])


def list_projects() -> list[dict]:
    data = read_store()
    bootstrap(data)
    write_store(data)
    return data["projects"]


def start_investigation(project_id: str) -> dict:
    """Starts a fresh investigation for a registered project; makes it active."""
    data = read_store()
    bootstrap(data)
    project = next((item for item in data["projects"] if item["id"] == project_id), None)
    if project is None:
        raise NotFoundError("That project was not found.")
    untouched = next(
        (
            item for item in data["investigations"]
            if item.get("projectId") == project_id and item["status"] == "open" and not item.get("runIds")
        ),
        None,
    )
    if untouched is not None:
        write_store(data)
        return snapshot(data, untouched)
    investigation = {
        "id": _new_id("inv"),
        "projectId": project_id,
        "title": f"Flaky investigation — {project['name']}",
        "status": "open",
        "goal": "Prove which test sequence breaks which test, then verify a cleanup fix.",
        "target": None,
        "runIds": [], "evidenceIds": [], "hypothesisIds": [], "comparisonIds": [],
        "patchIds": [], "verificationIds": [], "analysisIds": [],
        "createdAt": _now_iso(), "updatedAt": _now_iso(),
    }
    data["investigations"].append(investigation)
    write_store(data)
    return snapshot(data, investigation)


def scan_project(project_id: str | None = None, on_event=None) -> dict:
    """Runs only the static shared-state analysis (no subprocesses)."""
    data = read_store()
    bootstrap(data)
    if project_id:
        active = next((item for item in data["investigations"] if item.get("projectId") == project_id), None) or current_investigation(data)
    else:
        active = current_investigation(data)
    if active is None:
        raise NotFoundError("No investigation exists; start one first.")
    project = project_for(data, active)
    outcome = analyze_registered_project(project)
    persisted = persist_analysis(data, active, outcome["analysis"]["findings"])
    active["updatedAt"] = _now_iso()
    write_store(data)
    top_findings = [finding["statement"] for finding in persisted["findings"][:3]]
    summary = (
        f"Static analysis recorded {len(persisted['findings'])} findings; notably: {' | '.join(top_findings)}"
        if top_findings
        else "Static analysis recorded no shared-state findings for this project."
    )
    if on_event is not None:
        on_event({"type": "scan_finished", "investigationId": active["id"], "summary": summary})
    return {"snapshot": snapshot(data, active), "summary": summary}


def run_controlled_workflow(request: dict | None = None, on_event=None, on_line=None) -> dict:
    """Full controlled investigation against a real project."""
    request = request or {}
    data = read_store()
    demo = bootstrap(data)
    investigation = investigation_for(data, bool(request.get("demoOnly")))
    if investigation is None:
        raise NotFoundError("No investigation exists; start one first.")
    project = demo["project"] if request.get("demoOnly") else project_for(data, investigation)

    if not project.get("trusted"):
        raise ForbiddenError("Runs require a trusted project. Confirm the trust prompt for this directory first.")

    texts = read_project_texts(project)
    file_texts = texts["fileTexts"]
    test_files = texts["testFiles"]
    if not test_files:
        raise ValidationError("No test files were discovered for this project.")

    if on_event is not None:
        on_event({"type": "workflow_started", "investigationId": investigation["id"], "project": project["name"]})

    # Static analysis first: findings guide ranking and later hypothesis + patch.
    analysis_result = analyze_registered_project(project)
    persisted = persist_analysis(data, investigation, analysis_result["analysis"]["findings"])

    shape: dict
    triage_outcomes: list[dict] = []

    requested_file = (
        request.get("testFile")
        if isinstance(request.get("testFile"), str) and request.get("testFile") in test_files
        else None
    )
    ranked_files = (
        [requested_file]
        if requested_file
        else [
            file for file, _score in sorted(
                analysis_result["analysis"]["scores"].items(),
                key=lambda item: item[1],
                reverse=True,
            )
        ][:MAX_TRIAGE_FILES]
    )

    for candidate in ranked_files or test_files[:MAX_TRIAGE_FILES]:
        spec = build_run_command(project["root"], project["framework"], test_files=[candidate])
        run = execute_run_spec(
            project,
            investigation["id"],
            {"label": f"triage — {candidate}", "argv": spec["argv"], "cwd": project["root"], "parser": spec["parser"]},
            on_line=on_line,
        )
        record_run(data, investigation, run)
        failing = [test["name"] for test in run["tests"] if test["status"] == "failed"]
        triage_outcomes.append({"file": candidate, "failing": failing})
        if on_event is not None:
            on_event({"type": "triage_run", "file": candidate, "status": run["status"], "failing": failing})

    failed_triage = next((outcome for outcome in triage_outcomes if outcome["failing"]), None)
    if failed_triage is not None:
        names = ordered_test_names(file_texts.get(failed_triage["file"], ""), is_python=failed_triage["file"].endswith(".py"))
        target_test = failed_triage["failing"][0]
        index = names.index(target_test) if target_test in names else -1
        predecessor_test = names[max(0, index - 1)] if index > 0 or (index == -1 and len(names) > 1) else None
        if predecessor_test == target_test:
            predecessor_test = None
        shape = {
            "testFile": failed_triage["file"],
            "targetTest": target_test,
            "predecessorTest": predecessor_test,
            "reasoning": f'Triage found "{target_test}" failing in {failed_triage["file"]}; the declared predecessor becomes the isolation comparison.',
        }
    else:
        heuristic = choose_target(analysis_result["analysis"], file_texts, test_files)
        if heuristic is None:
            raise ValidationError("No test target could be resolved for this project.")
        shape = heuristic
    if requested_file:
        shape["testFile"] = requested_file
    investigation["target"] = shape

    matrix_specs = build_matrix_specs(project, shape)
    for spec in matrix_specs:
        run = execute_run_spec(project, investigation["id"], spec, on_line=on_line)
        record_run(data, investigation, run)
        if on_event is not None:
            on_event({"type": "matrix_run", "label": spec["label"], "status": run["status"]})

    all_runs = [run for run in (next((r for r in data["runs"] if r["id"] == run_id), None) for run_id in investigation["runIds"]) if run]
    run_evidence = [item for item in data["evidence"] if item.get("kind") == "run" and item.get("investigationId") == investigation["id"]]
    findings = compare_run_matrix(all_runs, run_evidence)
    comparison = {
        "id": _new_id("cmp"),
        "investigationId": investigation["id"],
        "leftRunId": all_runs[0]["id"] if all_runs else "",
        "rightRunId": all_runs[-1]["id"] if all_runs else "",
        "findings": findings,
        "createdAt": _now_iso(),
    }
    data["comparisons"].append(comparison)
    investigation["comparisonIds"].append(comparison["id"])
    for finding in findings:
        cited_run_ids = list({
            run_id
            for evidence_id in finding["evidenceIds"]
            for item in data["evidence"] if item["id"] == evidence_id
            for run_id in item.get("sourceRunIds", [])
        })
        evidence = evidence_record(
            investigation["id"],
            "unknown" if finding["certainty"] == "unknown" else "comparison",
            finding["statement"],
            cited_run_ids,
            finding["certainty"] == "observed",
            finding["evidenceIds"],
        )
        data["evidence"].append(evidence)
        investigation["evidenceIds"].append(evidence["id"])

    evidence = [item for item in data["evidence"] if item["id"] in investigation["evidenceIds"]]
    hypothesis = deterministic_hypothesis(
        investigation["id"],
        findings,
        persisted["findings"],
        evidence,
        persisted["analysisEvidenceIds"],
    )
    data["hypotheses"].append(hypothesis)
    investigation["hypothesisIds"].append(hypothesis["id"])

    investigation["status"] = "needs_review"
    investigation["updatedAt"] = _now_iso()
    write_store(data)
    if on_event is not None:
        on_event({"type": "workflow_finished", "investigationId": investigation["id"]})
    return snapshot(data, investigation)


# The legacy demo action now flows through the same generic pipeline.
run_demo_investigation = lambda: run_controlled_workflow({"demoOnly": True})  # noqa: E731


def run_ai_review(demo_only: bool = False) -> dict:
    """Runs the optional AI evidence review for an investigation."""
    from .ai_provider import evaluate_evidence

    data = read_store()
    bootstrap(data)
    investigation = investigation_for(data, demo_only)
    if investigation is None:
        raise NotFoundError("No investigation exists; start one first.")
    current = snapshot(data, investigation)
    result = evaluate_evidence(current)
    data["toolInvocations"].extend(result["invocations"])
    if result.get("hypothesis"):
        hypothesis = {
            **result["hypothesis"],
            "id": _new_id("hyp"),
            "createdAt": _now_iso(),
        }
        data["hypotheses"].append(hypothesis)
        investigation["hypothesisIds"].append(hypothesis["id"])
        investigation["updatedAt"] = _now_iso()
    write_store(data)
    return {"snapshot": snapshot(data, investigation), "summary": result["summary"]}


def propose_patch(demo_only: bool = False) -> dict:
    """Drafts the cleanup patch from the current analysis (no writes to disk)."""
    data = read_store()
    bootstrap(data)
    investigation = investigation_for(data, demo_only)
    if investigation is None:
        raise NotFoundError("No investigation exists; start one first.")
    project = project_for(data, investigation)
    analysis_result = analyze_registered_project(project)
    texts = read_project_texts(project)
    fallback = choose_target(analysis_result["analysis"], texts["fileTexts"], project.get("testFiles") or [])
    target = investigation.get("target") or fallback or {
        "testFile": (project.get("testFiles") or [None])[0],
        "targetTest": None,
        "predecessorTest": None,
        "reasoning": "",
    }
    if not target or not target.get("testFile"):
        raise ValidationError("No test target could be resolved for patch drafting.")

    patch = draft_cleanup_patch(
        investigation["id"],
        analysis_result["analysis"],
        texts["fileTexts"],
        target,
    )
    if patch is None:
        raise ValidationError(
            "No safe mechanical fix could be drafted: no exported reset function and no provably resettable "
            "module state were found. Add an explicit reset hook by hand, then rerun."
        )
    data["patches"].append(patch)
    investigation["patchIds"].append(patch["id"])
    investigation["updatedAt"] = _now_iso()
    write_store(data)
    return snapshot(data, investigation)


def approve_and_verify_patch(patch_id: str, demo_only: bool = False, on_event=None, on_line=None) -> dict:
    """Applies the approved patch, reruns the failing ordered probe, records verification."""
    data = read_store()
    bootstrap(data)
    investigation = investigation_for(data, demo_only)
    if investigation is None:
        raise NotFoundError("No investigation exists; start one first.")
    project = project_for(data, investigation)
    index = next(
        (
            position for position, patch in enumerate(data["patches"])
            if patch["id"] == patch_id and patch.get("investigationId") == investigation["id"]
        ),
        -1,
    )
    if index < 0:
        raise NotFoundError("Patch was not found for this investigation.")

    if on_event is not None:
        on_event({"type": "patch_applied", "patchId": patch_id})
    data["patches"][index] = apply_patch_to_disk(data["patches"][index], project)

    # Rerun the ordered probe that failed before the patch.
    ordered_probe = next(
        (
            run for run in
            [next((r for r in data["runs"] if r["id"] == run_id), None) for run_id in investigation["runIds"]]
            if run and run["status"] == "failed" and run["label"].startswith("file")
        ),
        None,
    )
    if ordered_probe is not None:
        rerun = rerun_recorded_spec(
            project,
            investigation["id"],
            ordered_probe,
            f"post-patch rerun — {ordered_probe['label']}",
            on_line=on_line,
        )
        notes = "Approved patch verification re-executed the recorded failing command."
    else:
        spec = build_run_command(
            project["root"],
            project["framework"],
            test_files=(project.get("testFiles") or [None])[0:1],
        )
        rerun = execute_run_spec(
            project,
            investigation["id"],
            {"label": "post-patch rerun", "argv": spec["argv"], "cwd": project["root"], "parser": spec["parser"]},
            on_line=on_line,
        )
        notes = "Approved patch verification re-ran the project's first test file (no prior failing probe was recorded)."
    record_run(data, investigation, rerun)

    verification = verify_run(investigation["id"], rerun, notes)
    data["verifications"].append(verification)
    investigation["verificationIds"].append(verification["id"])
    investigation["status"] = "verified" if verification["result"] == "verified" else "needs_review"
    investigation["updatedAt"] = _now_iso()
    write_store(data)
    if on_event is not None:
        on_event({"type": "verification_recorded", "result": verification["result"]})
    return snapshot(data, investigation)


def revert_patch_action(patch_id: str, demo_only: bool = False) -> dict:
    """Restores every file a patch changed to its recorded baseline."""
    data = read_store()
    bootstrap(data)
    investigation = investigation_for(data, demo_only)
    if investigation is None:
        raise NotFoundError("No investigation exists; start one first.")
    project = project_for(data, investigation)
    index = next(
        (
            position for position, patch in enumerate(data["patches"])
            if patch["id"] == patch_id and patch.get("investigationId") == investigation["id"]
        ),
        -1,
    )
    if index < 0:
        raise NotFoundError("Patch was not found for this investigation.")
    data["patches"][index] = revert_patch_on_disk(data["patches"][index], project)
    investigation["status"] = "needs_review"
    investigation["updatedAt"] = _now_iso()
    write_store(data)
    return snapshot(data, investigation)
