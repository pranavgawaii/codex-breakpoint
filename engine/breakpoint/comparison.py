"""Matrix-aware differential comparison of recorded runs.

Cross-examines the recorded runs of one investigation and emits findings.
Unlike a naive before/after diff, this proves the same test produced
different outcomes under different run contexts — the signature of
order-dependent state.
"""

from __future__ import annotations

from typing import Callable


def _evidence_for_run_id(evidence: list[dict]) -> Callable[[str], str]:
    def lookup(run_id: str) -> str:
        for item in evidence:
            if run_id in item.get("sourceRunIds", []) and item.get("kind") == "run":
                return item["id"]
        return ""
    return lookup


def _outcomes_by_test(runs: list[dict]) -> dict[str, list[dict]]:
    table: dict[str, list[dict]] = {}
    for run in runs:
        for test in run.get("tests", []):
            if test.get("status") == "unknown":
                continue
            table.setdefault(test["name"], []).append({
                "runId": run["id"],
                "label": run["label"],
                "status": test["status"],
                "error": test.get("error"),
            })
    return table


def compare_run_matrix(runs: list[dict], evidence: list[dict]) -> list[dict]:
    """Emits comparison findings with evidence citations and honest unknowns."""
    evidence_id_for = _evidence_for_run_id(evidence)
    findings: list[dict] = []

    if not runs:
        return findings

    failing_runs = [run for run in runs if run["status"] == "failed"]
    outcomes = _outcomes_by_test(runs)

    # Per-test outcome conflicts: the strongest order-dependence evidence.
    for name, observations in outcomes.items():
        statuses = {observation["status"] for observation in observations}
        if len(statuses) < 2:
            continue
        passing = [observation for observation in observations if observation["status"] == "passed"]
        failing = [observation for observation in observations if observation["status"] == "failed"]
        if not passing or not failing:
            continue
        passing_text = "; ".join(f"passed ({observation['label']})" for observation in passing)
        failing_text = "; ".join(
            f"failed ({observation['label']})" + (f" — {observation['error']}" if observation.get("error") else "")
            for observation in failing
        )
        findings.append({
            "category": "order",
            "statement": f'Test "{name}" produced conflicting outcomes: {passing_text}, but {failing_text}.',
            "evidenceIds": list({
                evidence_id_for(observation["runId"]) for observation in observations if evidence_id_for(observation["runId"])
            }),
            "certainty": "observed",
        })

    # Explicit causal direction, emitted once for the first ordered failing run.
    ordered_failing = [run for run in failing_runs if run["label"].startswith("file in declared order")]
    failing_run = ordered_failing[0] if ordered_failing else None
    if failing_run:
        ordered_before = runs[:runs.index(failing_run)]
        solo_run_for = next((run for run in ordered_before if run["label"].startswith("target test in isolation")), None)
        predecessor_solo = next((run for run in ordered_before if run["label"].startswith("predecessor test in isolation")), None)
        if solo_run_for and solo_run_for["status"] == "passed":
            findings.append({
                "category": "status",
                "statement": (
                    f"The same target passed in isolation ({solo_run_for['id']}) and failed in the ordered run "
                    f"({failing_run['id']}); the only difference between those contexts is what executed beforehand."
                ),
                "evidenceIds": [evidence_id_for(run_id) for run_id in (solo_run_for["id"], failing_run["id"]) if evidence_id_for(run_id)],
                "certainty": "observed",
            })
        if predecessor_solo and predecessor_solo["status"] == "passed":
            findings.append({
                "category": "status",
                "statement": (
                    f"The predecessor test also passes alone ({predecessor_solo['id']}), "
                    "so the failure is not an unconditional defect in either test."
                ),
                "evidenceIds": [evidence_id_for(predecessor_solo["id"])] if evidence_id_for(predecessor_solo["id"]) else [],
                "certainty": "observed",
            })

    # Reproducibility probe: a repeated ordered run failing identically.
    first_ordered = next((run for run in failing_runs if run["label"].startswith("file in declared order")), None)
    for repeat in [run for run in failing_runs if run["label"].startswith("file again")]:
        if first_ordered and first_ordered is not repeat:
            findings.append({
                "category": "status",
                "statement": (
                    f"The ordered failure reproduced across {first_ordered['id']} and {repeat['id']} "
                    f"(exit {first_ordered['exitCode']} then {repeat['exitCode']}), "
                    "so the divergence is systematic, not a fluke of one execution."
                ),
                "evidenceIds": [evidence_id_for(run_id) for run_id in (first_ordered["id"], repeat["id"]) if evidence_id_for(run_id)],
                "certainty": "observed",
            })

    # Equivalence result: everything passed under every probed order.
    if not failing_runs and len(runs) > 1:
        findings.append({
            "category": "status",
            "statement": (
                f"Every probed run passed ({'; '.join(run['label'] for run in runs)}); "
                "no order dependence was reproduced for this target."
            ),
            "evidenceIds": [evidence_id_for(run["id"]) for run in runs if evidence_id_for(run["id"])],
            "certainty": "observed",
        })

    # Per-run failures that carry no parsed test identity stay visible.
    for failing_entry in failing_runs:
        if any(test["status"] == "failed" for test in failing_entry.get("tests", [])):
            continue
        findings.append({
            "category": "error",
            "statement": (
                f"Run {failing_entry['id']} ({failing_entry['label']}) failed with exit {failing_entry['exitCode']}, "
                "but no per-test record identifies the failing unit from the parsed output."
            ),
            "evidenceIds": [evidence_id_for(failing_entry["id"])] if evidence_id_for(failing_entry["id"]) else [],
            "certainty": "unknown",
        })

    # Honest unknown: application heap state was never captured for these runs.
    findings.append({
        "category": "state",
        "statement": "No application-state capture was configured for these runs; any state transition between tests remains unknown.",
        "evidenceIds": [],
        "certainty": "unknown",
    })

    return [
        finding for finding in findings
        if finding["certainty"] != "observed" or finding["evidenceIds"] or finding["category"] == "state"
    ]
