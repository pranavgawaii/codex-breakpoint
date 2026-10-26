"""Deterministic hypothesis builder.

Builds a hypothesis strictly from recorded findings. The wording cites the
actual static-analysis discoveries of the target project, so the same engine
produces a different, correct narrative for every target. The AI reviewer is
an optional layer on top; this path never calls a network.
"""

from __future__ import annotations

import re
import time
import uuid
from datetime import datetime, timezone


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def deterministic_hypothesis(
    investigation_id: str,
    comparison_findings: list[dict],
    state_findings: list[dict],
    evidence: list[dict],
    analysis_evidence_ids: dict[str, str],
) -> dict:
    """Composes the working hypothesis from observed findings only."""
    evidence_ids = {item["id"] for item in evidence}

    module_states = [finding for finding in state_findings if finding["kind"] == "module-state"]
    exported_mutators = [finding for finding in state_findings if finding["kind"] == "exported-mutator"]
    hookless = [finding for finding in state_findings if finding["kind"] in ("no-hooks", "hooks-without-reset")]
    order_findings = [finding for finding in comparison_findings if finding["category"] == "order" and finding["certainty"] == "observed"]
    status_findings = [finding for finding in comparison_findings if finding["category"] == "status" and finding["certainty"] == "observed"]

    variable_names = list({
        match.group(1)
        for finding in module_states
        if (match := re.search(r"`([^`]+)`", finding["statement"]))
    })
    mutator_names = list({
        match.group(1)
        for finding in exported_mutators
        if (match := re.search(r"`([A-Za-z_$][\w$]*)`", finding["statement"]))
    })
    module_files = list({finding["file"] for finding in module_states})

    supporting: list[str] = []
    for finding in order_findings:
        supporting.extend(finding["evidenceIds"])
    for finding in status_findings:
        supporting.extend(finding["evidenceIds"])
    for finding in state_findings:
        mapped = analysis_evidence_ids.get(finding["id"])
        if mapped and mapped in evidence_ids:
            supporting.append(mapped)
    unique_cited = [item for item in dict.fromkeys(supporting) if item in evidence_ids]

    state_clause = (
        (
            f"The analysis observed module-level mutable state ({', '.join(f'`{name}`' for name in variable_names)}) "
            f"in {', '.join(module_files)}, mutated by "
            + (", ".join(f"`{name}`" for name in mutator_names) if mutator_names else "module code")
            + " and never reset by the test hooks."
        )
        if variable_names
        else "The analysis did not identify module-level mutable state, so the mechanism remains unproven."
    )

    outcome_clause = (
        "The recorded matrix shows the same test failing only when executed after its predecessor."
        if order_findings
        else "No order dependence was reproduced in any probed run."
        if any("no order dependence was reproduced" in finding["statement"] for finding in comparison_findings)
        else "Some runs failed, but the parsed output did not tie the failure to a specific test."
    )

    confidence = "medium" if order_findings and variable_names and hookless else "low"

    justification = (
        "Order outcomes and module state are both observed, but no runtime state capture links the two mechanically yet."
        if order_findings and variable_names
        else "Run outcomes are observed; the causal mechanism between tests is not captured."
    )

    alternatives = [
        "A test-runner configuration or process-isolation difference could contribute.",
        "An environmental dependency (clock, filesystem, network) could behave differently between contexts.",
    ]
    if not variable_names:
        alternatives.insert(0, "The failure may be independent of execution order and instead sensitive to how the file was loaded.")

    next_experiment = (
        (
            f"Add a beforeEach hook that resets {', '.join(f'`{name}`' for name in variable_names)} "
            "(a reset function exists for one or more of them), then rerun the same ordered file."
        )
        if variable_names and hookless
        else "Export a reset function for the mutable module state, call it from a beforeEach hook, and rerun the ordered pair."
        if variable_names
        else "Instrument the failing test with explicit state logging, then rerun the ordered file."
    )

    return {
        "id": _new_id("hyp"),
        "investigationId": investigation_id,
        "source": "deterministic",
        "description": f"{outcome_clause} {state_clause}",
        "supportingEvidenceIds": unique_cited,
        "contradictingEvidenceIds": [],
        "confidence": confidence,
        "confidenceJustification": justification,
        "alternativeExplanations": alternatives,
        "nextExperiment": next_experiment,
        "experimentOutcome": None,
        "createdAt": _now_iso(),
    }
