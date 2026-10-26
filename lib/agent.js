/** @typedef {import("./models.js").Evidence} Evidence */
/** @typedef {import("./models.js").Hypothesis} Hypothesis */
/** @typedef {import("./models.js").StateFinding} StateFinding */
/** @typedef {import("./models.js").ComparisonFinding} ComparisonFinding */

/**
 * Builds a deterministic hypothesis strictly from recorded findings. The
 * wording cites the actual static-analysis discoveries of this project, so
 * the same engine produces a different, correct narrative for every target.
 *
 * @param {string} investigationId
 * @param {ComparisonFinding[]} comparisonFindings
 * @param {StateFinding[]} stateFindings
 * @param {Evidence[]} evidence
 * @param {Record<string, string>} analysisEvidenceIds Maps a state-finding id
 *   onto the evidence item created for it (built by the orchestrator).
 * @returns {Hypothesis}
 */
export function deterministicHypothesis(investigationId, comparisonFindings, stateFindings, evidence, analysisEvidenceIds) {
  const evidenceIds = new Set(evidence.map((item) => item.id));

  const moduleStates = stateFindings.filter((finding) => finding.kind === "module-state");
  const exportedMutators = stateFindings.filter((finding) => finding.kind === "exported-mutator");
  const hookless = stateFindings.filter((finding) => finding.kind === "no-hooks" || finding.kind === "hooks-without-reset");
  const orderFindings = comparisonFindings.filter((finding) => finding.category === "order" && finding.certainty === "observed");
  const statusFindings = comparisonFindings.filter((finding) => finding.category === "status" && finding.certainty === "observed");

  const variableNames = [...new Set(moduleStates.map((finding) => (finding.statement.match(/`([^`]+)`/)?.[1] ?? "")))].filter(Boolean);
  const mutatorNames = [...new Set(exportedMutators.map((finding) => (finding.statement.match(/`([A-Za-z_$][\w$]*)`/)?.[1] ?? "")))].filter(Boolean);
  const moduleFiles = [...new Set(moduleStates.map((finding) => finding.file))];

  /** @type {string[]} */
  const supporting = [];
  for (const finding of orderFindings) supporting.push(...finding.evidenceIds);
  for (const finding of statusFindings) supporting.push(...finding.evidenceIds);
  for (const finding of stateFindings) {
    const mapped = analysisEvidenceIds[finding.id];
    if (mapped && evidenceIds.has(mapped)) supporting.push(mapped);
  }
  const uniqueCited = [...new Set(supporting)].filter((id) => evidenceIds.has(id));

  const stateClause = variableNames.length > 0
    ? `The analysis observed module-level mutable state (${variableNames.map((name) => `\`${name}\``).join(", ")}) in ${moduleFiles.join(", ")}, mutated by ${mutatorNames.length > 0 ? mutatorNames.map((name) => `\`${name}\``).join(", ") : "module code"} and never reset by the test hooks.`
    : "The analysis did not identify module-level mutable state, so the mechanism remains unproven.";

  const outcomeClause = orderFindings.length > 0
    ? "The recorded matrix shows the same test failing only when executed after its predecessor."
    : comparisonFindings.some((finding) => finding.statement.includes("no order dependence was reproduced"))
      ? "No order dependence was reproduced in any probed run."
      : "Some runs failed, but the parsed output did not tie the failure to a specific test.";

  const confidence = orderFindings.length > 0 && variableNames.length > 0 && hookless.length > 0 ? "medium" : "low";

  const justification = orderFindings.length > 0 && variableNames.length > 0
    ? "Order outcomes and module state are both observed, but no runtime state capture links the two mechanically yet."
    : "Run outcomes are observed; the causal mechanism between tests is not captured.";

  /** @type {string[]} */
  const alternatives = ["A test-runner configuration or process-isolation difference could contribute.", "An environmental dependency (clock, filesystem, network) could behave differently between contexts."];
  if (variableNames.length === 0) alternatives.unshift("The failure may be independent of execution order and instead sensitive to how the file was loaded.");

  const nextExperiment = variableNames.length > 0 && hookless.length > 0
    ? `Add a beforeEach hook that resets ${variableNames.map((name) => `\`${name}\``).join(", ")} (a reset function exists for one or more of them), then rerun the same ordered file.`
    : variableNames.length > 0
      ? "Export a reset function for the mutable module state, call it from a beforeEach hook, and rerun the ordered pair."
      : "Instrument the failing test with explicit state logging, then rerun the ordered file.";

  return {
    id: `hyp_${crypto.randomUUID().slice(0, 8)}`,
    investigationId,
    source: "deterministic",
    description: `${outcomeClause} ${stateClause}`,
    supportingEvidenceIds: uniqueCited,
    contradictingEvidenceIds: [],
    confidence,
    confidenceJustification: justification,
    alternativeExplanations: alternatives,
    nextExperiment,
    experimentOutcome: null,
    createdAt: new Date().toISOString(),
  };
}
