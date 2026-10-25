import type { Evidence, Hypothesis, TestRun } from "./models";

export interface AiProvider { plan(input: { facts: string[]; unknowns: string[] }): Promise<string>; }

export function deterministicHypothesis(investigationId: string, failing: TestRun, passing: TestRun, evidence: Evidence[]): Hypothesis {
  const related = evidence.filter((item) => item.sourceRunIds.includes(failing.id) || item.sourceRunIds.includes(passing.id)).map((item) => item.id);
  return { id: `hyp_${crypto.randomUUID().slice(0, 8)}`, investigationId, source: "deterministic", description: "The session test failure is consistent with state established by the preceding authentication test, but the captured runs do not prove the mechanism of that state leak.", supportingEvidenceIds: related, contradictingEvidenceIds: [], confidence: "low", confidenceJustification: "The sequence and outcomes are observed; application state was not captured.", alternativeExplanations: ["A test-runner ordering or configuration difference could be involved.", "A dependency may behave differently when the full file is executed."], nextExperiment: "Add explicit state capture or cleanup instrumentation, then rerun the same two approved commands.", experimentOutcome: null, createdAt: new Date().toISOString() };
}
