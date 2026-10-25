import { deterministicHypothesis } from "./agent";
import { compareRuns } from "./comparison";
import type { AgentToolInvocation, Evidence, Hypothesis, Investigation, InvestigationSnapshot, Project, ProposedPatch, PublicPatch, PublicTestRun, RunComparison, StoredData, TestRun } from "./models";
import { runApprovedDemo } from "./test-runner";
import { readStore, writeStore } from "./store";
import { evaluateEvidence } from "./openai-provider";
import { applyDemoPatch, createDemoCleanupPatch, revertDemoPatch, verifyRun } from "./patch-review";
import { NotFoundError } from "./errors";

const now = () => new Date().toISOString();
function bootstrap(data: StoredData): { project: Project; investigation: Investigation } {
  let project = data.projects.find((item) => item.id === "project_demo");
  if (!project) { project = { id: "project_demo", name: "Trusted session-state demo", root: "sample-project", trusted: true, createdAt: now() }; data.projects.push(project); }
  let investigation = data.investigations.find((item) => item.id === "inv_session_state");
  if (!investigation) { investigation = { id: "inv_session_state", projectId: project.id, title: "Session state persists between tests", status: "open", runIds: [], evidenceIds: [], hypothesisIds: [], comparisonIds: [], patchIds: [], verificationIds: [], createdAt: now(), updatedAt: now() }; data.investigations.push(investigation); }
  return { project, investigation };
}
function publicRun(run: TestRun): PublicTestRun {
  return { id: run.id, projectId: run.projectId, label: run.label, status: run.status, command: run.command, workingDirectory: run.workingDirectory, startedAt: run.startedAt, finishedAt: run.finishedAt, durationMs: run.durationMs, exitCode: run.exitCode, tests: run.tests, environment: run.environment, stdoutBytes: Buffer.byteLength(run.stdout, "utf8"), stderrBytes: Buffer.byteLength(run.stderr, "utf8") };
}
function publicPatch(patch: ProposedPatch): PublicPatch {
  return { id: patch.id, investigationId: patch.investigationId, description: patch.description, diff: patch.diff, status: patch.status, baseline: patch.baseline, targetPath: patch.targetPath };
}
function snapshot(data: StoredData, investigation: Investigation): InvestigationSnapshot {
  return { investigation, runs: investigation.runIds.map((id) => data.runs.find((run) => run.id === id)).filter((run): run is TestRun => Boolean(run)).map(publicRun), evidence: investigation.evidenceIds.map((id) => data.evidence.find((item) => item.id === id)).filter((item): item is Evidence => Boolean(item)), comparisons: investigation.comparisonIds.map((id) => data.comparisons.find((item) => item.id === id)).filter((item): item is RunComparison => Boolean(item)), hypotheses: investigation.hypothesisIds.map((id) => data.hypotheses.find((item) => item.id === id)).filter((item): item is Hypothesis => Boolean(item)), toolInvocations: data.toolInvocations.filter((item): item is AgentToolInvocation => item.investigationId === investigation.id), patches: data.patches.filter((item) => item.investigationId === investigation.id).map(publicPatch), verifications: data.verifications.filter((item) => item.investigationId === investigation.id) };
}
function recordRun(data: StoredData, investigation: Investigation, run: TestRun): Evidence {
  data.runs.push(run); investigation.runIds.push(run.id);
  const evidence: Evidence = { id: `ev_${crypto.randomUUID().slice(0, 8)}`, investigationId: investigation.id, kind: "run", statement: `${run.label}: ${run.status}, exit ${run.exitCode}, ${run.durationMs} ms.`, sourceRunIds: [run.id], observed: true, createdAt: now() };
  data.evidence.push(evidence); investigation.evidenceIds.push(evidence.id); return evidence;
}
export async function getInvestigation(): Promise<InvestigationSnapshot> {
  const data = await readStore(); const { investigation } = bootstrap(data); await writeStore(data); return snapshot(data, investigation);
}
export async function runDemoInvestigation(): Promise<InvestigationSnapshot> {
  const data = await readStore(); const { investigation } = bootstrap(data);
  // Fixed, local commands only: this API never accepts command text or a path.
  const passing = await runApprovedDemo("isolated"); const failing = await runApprovedDemo("suite");
  recordRun(data, investigation, passing); recordRun(data, investigation, failing);
  const runEvidence = data.evidence.filter((item) => investigation.evidenceIds.includes(item.id));
  const findings = compareRuns(failing, passing, runEvidence);
  const comparison = { id: `cmp_${crypto.randomUUID().slice(0, 8)}`, investigationId: investigation.id, leftRunId: failing.id, rightRunId: passing.id, findings, createdAt: now() };
  data.comparisons.push(comparison); investigation.comparisonIds.push(comparison.id);
  for (const finding of findings) {
    const evidence: Evidence = { id: `ev_${crypto.randomUUID().slice(0, 8)}`, investigationId: investigation.id, kind: finding.certainty === "unknown" ? "unknown" : "comparison", statement: finding.statement, sourceRunIds: [failing.id, passing.id], sourceEvidenceIds: finding.evidenceIds, observed: finding.certainty === "observed", createdAt: now() };
    data.evidence.push(evidence); investigation.evidenceIds.push(evidence.id);
  }
  const hypothesis = deterministicHypothesis(investigation.id, failing, passing, data.evidence.filter((item) => investigation.evidenceIds.includes(item.id)));
  data.hypotheses.push(hypothesis); investigation.hypothesisIds.push(hypothesis.id); investigation.status = "needs_review"; investigation.updatedAt = now();
  await writeStore(data); return snapshot(data, investigation);
}

/** The fixed workflow makes each reproduction step explicit and repeatable. */
export async function runControlledWorkflow(): Promise<InvestigationSnapshot> {
  const data = await readStore(); const { investigation } = bootstrap(data);
  const runs: TestRun[] = [];
  for (const command of ["isolated", "auth", "pair", "reverse", "pair"] as const) {
    const run = await runApprovedDemo(command);
    recordRun(data, investigation, run);
    runs.push(run);
  }
  const [, , failing, reverse] = runs;
  const findings = compareRuns(failing, reverse, data.evidence.filter((item) => investigation.evidenceIds.includes(item.id)));
  const comparison: RunComparison = { id: `cmp_${crypto.randomUUID().slice(0, 8)}`, investigationId: investigation.id, leftRunId: failing.id, rightRunId: reverse.id, findings, createdAt: now() };
  data.comparisons.push(comparison); investigation.comparisonIds.push(comparison.id);
  for (const finding of findings) { const evidence: Evidence = { id: `ev_${crypto.randomUUID().slice(0, 8)}`, investigationId: investigation.id, kind: finding.certainty === "unknown" ? "unknown" : "comparison", statement: finding.statement, sourceRunIds: [failing.id, reverse.id], sourceEvidenceIds: finding.evidenceIds, observed: finding.certainty === "observed", createdAt: now() }; data.evidence.push(evidence); investigation.evidenceIds.push(evidence.id); }
  investigation.status = "needs_review"; investigation.updatedAt = now(); await writeStore(data); return snapshot(data, investigation);
}

export async function runAiReview(): Promise<{ snapshot: InvestigationSnapshot; summary: string }> {
  const data = await readStore(); const { investigation } = bootstrap(data); const current = snapshot(data, investigation); const result = await evaluateEvidence(current);
  data.toolInvocations.push(...result.invocations);
  if (result.hypothesis) { const hypothesis: Hypothesis = { ...result.hypothesis, id: `hyp_${crypto.randomUUID().slice(0, 8)}`, createdAt: now() }; data.hypotheses.push(hypothesis); investigation.hypothesisIds.push(hypothesis.id); investigation.updatedAt = now(); }
  await writeStore(data); return { snapshot: snapshot(data, investigation), summary: result.summary };
}

export async function proposeDemoPatch(): Promise<InvestigationSnapshot> {
  const data = await readStore(); const { investigation } = bootstrap(data); const patch = await createDemoCleanupPatch(investigation.id);
  data.patches.push(patch); investigation.patchIds.push(patch.id); investigation.updatedAt = now(); await writeStore(data); return snapshot(data, investigation);
}

export async function approveAndVerifyPatch(patchId: string): Promise<InvestigationSnapshot> {
  const data = await readStore(); const { investigation } = bootstrap(data); const index = data.patches.findIndex((patch) => patch.id === patchId && patch.investigationId === investigation.id);
  if (index < 0) throw new NotFoundError("Patch was not found for this investigation.");
  data.patches[index] = await applyDemoPatch(data.patches[index]);
  const run = await runApprovedDemo("pair"); recordRun(data, investigation, run);
  const verification = verifyRun(investigation.id, run, "Approved patch verification ran the previously failing ordered pair.");
  data.verifications.push(verification); investigation.verificationIds.push(verification.id); investigation.status = verification.result === "verified" ? "verified" : "needs_review"; investigation.updatedAt = now(); await writeStore(data); return snapshot(data, investigation);
}

export async function revertPatch(patchId: string): Promise<InvestigationSnapshot> {
  const data = await readStore(); const { investigation } = bootstrap(data); const index = data.patches.findIndex((patch) => patch.id === patchId && patch.investigationId === investigation.id);
  if (index < 0) throw new NotFoundError("Patch was not found for this investigation."); data.patches[index] = await revertDemoPatch(data.patches[index]); investigation.status = "needs_review"; investigation.updatedAt = now(); await writeStore(data); return snapshot(data, investigation);
}
