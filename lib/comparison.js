/** @typedef {import("./models.js").ComparisonFinding} ComparisonFinding */
/** @typedef {import("./models.js").Evidence} Evidence */
/** @typedef {import("./models.js").TestRun} TestRun */

/**
 * Evidence lookup by run id: the investigations layer records one "run"
 * evidence item per executed run, and comparison findings cite those IDs.
 *
 * @param {Evidence[]} evidence
 * @returns {(runId: string) => string}
 */
function evidenceForRunId(evidence) {
  return (runId) => evidence.find((item) => item.sourceRunIds.includes(runId) && item.kind === "run")?.id ?? "";
}

/**
 * Indexes per-test statuses across every run in the matrix.
 *
 * @param {TestRun[]} runs
 * @returns {Record<string, Array<{ runId: string, label: string, status: string, error?: string }>>}
 */
function outcomesByTest(runs) {
  /** @type {Record<string, Array<{ runId: string, label: string, status: string, error?: string }>>} */
  const table = {};
  for (const run of runs) {
    for (const test of run.tests) {
      if (test.status === "unknown") continue;
      table[test.name] = [...(table[test.name] ?? []), { runId: run.id, label: run.label, status: test.status, error: test.error }];
    }
  }
  return table;
}

/**
 * Cross-examines the recorded runs of one investigation and emits findings.
 * Unlike a naive before/after diff, the matrix-aware comparison proves the
 * same test produced different outcomes under different run contexts, which
 * is the signature of order-dependent state.
 *
 * @param {TestRun[]} runs All runs recorded for this investigation, in order.
 * @param {Evidence[]} evidence Run-evidence items for citation.
 * @returns {ComparisonFinding[]}
 */
export function compareRunMatrix(runs, evidence) {
  const evidenceIdFor = evidenceForRunId(evidence);
  /** @type {ComparisonFinding[]} */
  const findings = [];

  if (runs.length === 0) return findings;

  const failingRuns = runs.filter((run) => run.status === "failed");
  const outcomes = outcomesByTest(runs);

  // Per-test outcome conflicts: the strongest order-dependence evidence.
  for (const [name, observations] of Object.entries(outcomes)) {
    const statuses = new Set(observations.map((observation) => observation.status));
    if (statuses.size < 2) continue;
    const passing = observations.filter((observation) => observation.status === "passed");
    const failing = observations.filter((observation) => observation.status === "failed");
    if (passing.length === 0 || failing.length === 0) continue;
    findings.push({
      category: "order",
      statement: `Test "${name}" produced conflicting outcomes: ${passing.map((observation) => `passed (${observation.label})`).join("; ")}, but ${failing.map((observation) => `failed (${observation.label})${observation.error ? ` — ${observation.error}` : ""}`).join("; ")}.`,
      evidenceIds: [...new Set(observations.map((observation) => evidenceIdFor(observation.runId)).filter(Boolean))],
      certainty: "observed",
    });
  }

  // Explicit causal direction: the failing context follows a specific
  // predecessor. Emitted once, for the first ordered failing run, so the
  // reproducibility probe does not duplicate the statement.
  const orderedFailing = failingRuns.filter((run) => run.label.startsWith("file in declared order"));
  const failingRun = orderedFailing[0] ?? null;
  if (failingRun) {
    const orderedBefore = runs.slice(0, runs.indexOf(failingRun));
    const soloRunFor = orderedBefore.find((run) => run.label.startsWith("target test in isolation"));
    const predecessorSolo = orderedBefore.find((run) => run.label.startsWith("predecessor test in isolation"));
    if (soloRunFor?.status === "passed") {
      findings.push({
        category: "status",
        statement: `The same target passed in isolation (${soloRunFor.id}) and failed in the ordered run (${failingRun.id}); the only difference between those contexts is what executed beforehand.`,
        evidenceIds: [evidenceIdFor(soloRunFor.id), evidenceIdFor(failingRun.id)].filter(Boolean),
        certainty: "observed",
      });
    }
    if (predecessorSolo?.status === "passed") {
      findings.push({
        category: "status",
        statement: `The predecessor test also passes alone (${predecessorSolo.id}), so the failure is not an unconditional defect in either test.`,
        evidenceIds: [evidenceIdFor(predecessorSolo.id)].filter(Boolean),
        certainty: "observed",
      });
    }
  }

  // Reproducibility probe: a repeated ordered run failing identically.
  const repeated = failingRuns.filter((run) => run.label.startsWith("file again"));
  for (const repeat of repeated) {
    const firstOrdered = failingRuns.find((run) => run.label.startsWith("file in declared order"));
    if (firstOrdered && firstOrdered !== repeat) {
      findings.push({
        category: "status",
        statement: `The ordered failure reproduced across ${firstOrdered.id} and ${repeat.id} (exit ${firstOrdered.exitCode} then ${repeat.exitCode}), so the divergence is systematic, not a fluke of one execution.`,
        evidenceIds: [evidenceIdFor(firstOrdered.id), evidenceIdFor(repeat.id)].filter(Boolean),
        certainty: "observed",
      });
    }
  }

  // Equivalence result: everything passed under every probed order.
  if (failingRuns.length === 0 && runs.length > 1) {
    findings.push({
      category: "status",
      statement: `Every probed run passed (${runs.map((run) => run.label).join("; ")}); no order dependence was reproduced for this target.`,
      evidenceIds: runs.map((run) => evidenceIdFor(run.id)).filter(Boolean),
      certainty: "observed",
    });
  }

  // Per-run failures that carry no parsed test identity stay visible.
  for (const failingEntry of failingRuns) {
    if (failingEntry.tests.some((test) => test.status === "failed")) continue;
    findings.push({
      category: "error",
      statement: `Run ${failingEntry.id} (${failingEntry.label}) failed with exit ${failingEntry.exitCode}, but no per-test record identifies the failing unit from the parsed output.`,
      evidenceIds: [evidenceIdFor(failingEntry.id)].filter(Boolean),
      certainty: "unknown",
    });
  }

  // Honest unknown: application heap state was never captured for these runs.
  findings.push({
    category: "state",
    statement: "No application-state capture was configured for these runs; any state transition between tests remains unknown.",
    evidenceIds: [],
    certainty: "unknown",
  });

  // Observed findings must cite evidence; the honest "state unknown" marker is
  // the single allowed evidence-free finding.
  return findings.filter((finding) => finding.certainty !== "observed" || finding.evidenceIds.length > 0 || finding.category === "state");
}
