import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildRunCommand, discoverFiles } from "./discovery.js";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors.js";
import { buildMatrixSpecs, executeRunSpec, rerunRecordedSpec } from "./runner.js";
import { compareRunMatrix } from "./comparison.js";
import { deterministicHypothesis } from "./agent.js";
import { applyPatch, draftCleanupPatch, revertPatch as revertStoredPatch, verifyRun } from "./patch-review.js";
import { analyzeRegisteredProject } from "./projects.js";
import { chooseTarget, orderedTestNames } from "./state-analysis.js";
import { readStore, writeStore } from "./store.js";
import { evaluateEvidence } from "./openai-provider.js";

/** @typedef {import("./models.js").Evidence} Evidence */
/** @typedef {import("./models.js").Investigation} Investigation */
/** @typedef {import("./models.js").InvestigationSnapshot} InvestigationSnapshot */
/** @typedef {import("./models.js").Project} Project */
/** @typedef {import("./models.js").ProposedPatch} ProposedPatch */
/** @typedef {import("./models.js").StateFinding} StateFinding */
/** @typedef {import("./models.js").StoredData} StoredData */
/** @typedef {import("./models.js").TestRun} TestRun */

/** Bundled sample lives next to the package root, independent of process.cwd(). */
const SAMPLE_PROJECT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sample-project");
const now = () => new Date().toISOString();
const DEMO_PROJECT_ID = "project_demo";
const DEMO_INVESTIGATION_ID = "inv_session_state";
/** Triage probes are capped so a repo with many test files stays bounded. */
const MAX_TRIAGE_FILES = 3;

/** @returns {string} */
function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Ensures the built-in demo project and its investigation exist, migrating
 * the legacy relative-path record to an absolute root with discovery data.
 *
 * @param {StoredData} data
 * @returns {Promise<{ project: Project, investigation: Investigation }>}
 */
async function bootstrap(data) {
  /** @type {Project | undefined} */
  let project = data.projects.find((item) => item.id === DEMO_PROJECT_ID);
  if (!project) {
    project = {
      id: DEMO_PROJECT_ID,
      name: "Trusted session-state demo",
      root: SAMPLE_PROJECT_ROOT,
      trusted: true,
      framework: "node",
      testFiles: [],
      createdAt: now(),
    };
    data.projects.push(project);
  }
  // Migrate the legacy relative root and refresh discovery metadata.
  if (!path.isAbsolute(project.root)) project.root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", project.root);
  if (!project.framework || project.testFiles.length === 0) {
    const files = await discoverFiles(project.root);
    project.framework = "node";
    project.testFiles = files.testFiles;
  }

  /** @type {Investigation | undefined} */
  let investigation = data.investigations.find((item) => item.id === DEMO_INVESTIGATION_ID);
  if (!investigation) {
    investigation = {
      id: DEMO_INVESTIGATION_ID,
      projectId: project.id,
      title: "Session state persists between tests",
      status: "open",
      goal: "Find why this test fails depending on execution order.",
      target: null,
      runIds: [], evidenceIds: [], hypothesisIds: [], comparisonIds: [], patchIds: [], verificationIds: [], analysisIds: [],
      createdAt: now(), updatedAt: now(),
    };
    data.investigations.push(investigation);
  }
  return { project, investigation };
}

/**
 * The active investigation is the most recently created one, so starting a
 * new investigation moves the workspace to it. Investigations are only ever
 * appended to the store, so the final entry is the newest.
 *
 * @param {StoredData} data
 * @returns {Investigation}
 */
function currentInvestigation(data) {
  return data.investigations[data.investigations.length - 1];
}

/** @param {TestRun} run @returns {import("./models.js").PublicTestRun} */
function publicRun(run) {
  return {
    id: run.id, projectId: run.projectId, label: run.label, status: run.status, command: run.command,
    workingDirectory: run.workingDirectory, startedAt: run.startedAt, finishedAt: run.finishedAt,
    durationMs: run.durationMs, exitCode: run.exitCode, tests: run.tests, environment: run.environment,
    spec: run.spec,
    stdoutBytes: Buffer.byteLength(run.stdout, "utf8"), stderrBytes: Buffer.byteLength(run.stderr, "utf8"),
  };
}

/** @param {ProposedPatch} patch @returns {import("./models.js").PublicPatch} */
function publicPatch(patch) {
  return { id: patch.id, investigationId: patch.investigationId, description: patch.description, diff: patch.diff, status: patch.status, baseline: patch.baseline, targetPath: patch.targetPath };
}

/** @returns {Evidence} */
function evidenceRecord(investigationId, kind, statement, sourceRunIds, observed, sourceEvidenceIds) {
  return { id: `ev_${crypto.randomUUID().slice(0, 8)}`, investigationId, kind, statement, sourceRunIds, observed, sourceEvidenceIds, createdAt: now() };
}

/**
 * @param {StoredData} data
 * @param {Investigation} investigation
 * @returns {InvestigationSnapshot}
 */
function snapshot(data, investigation) {
  const project = data.projects.find((item) => item.id === investigation.projectId) ?? null;
  const runs = investigation.runIds.map((id) => data.runs.find((run) => run.id === id)).filter(Boolean);
  return {
    investigation,
    project,
    runs: runs.map(publicRun),
    evidence: investigation.evidenceIds.map((id) => data.evidence.find((item) => item.id === id)).filter(Boolean),
    comparisons: investigation.comparisonIds.map((id) => data.comparisons.find((item) => item.id === id)).filter(Boolean),
    analyses: data.analyses.filter((item) => item.investigationId === investigation.id),
    hypotheses: investigation.hypothesisIds.map((id) => data.hypotheses.find((item) => item.id === id)).filter(Boolean),
    toolInvocations: data.toolInvocations.filter((item) => item.investigationId === investigation.id),
    patches: data.patches.filter((item) => item.investigationId === investigation.id).map(publicPatch),
    verifications: data.verifications.filter((item) => item.investigationId === investigation.id),
  };
}

/**
 * Records a run and its "run" evidence item.
 *
 * @param {StoredData} data
 * @param {Investigation} investigation
 * @param {TestRun} run
 * @returns {Evidence}
 */
function recordRun(data, investigation, run) {
  data.runs.push(run);
  investigation.runIds.push(run.id);
  const evidence = evidenceRecord(investigation.id, "run", `${run.label}: ${run.status}, exit ${run.exitCode}, ${run.durationMs} ms.`, [run.id], true);
  data.evidence.push(evidence);
  investigation.evidenceIds.push(evidence.id);
  return evidence;
}

/**
 * Reads every discovered file's text (tests and sources) for a project.
 *
 * @param {Project} project
 * @returns {Promise<{ fileTexts: Record<string, string>, testFiles: string[], sourceFiles: string[] }>}
 */
async function readProjectTexts(project) {
  const files = await discoverFiles(project.root);
  /** @type {Record<string, string>} */
  const fileTexts = {};
  for (const rel of [...files.testFiles, ...files.sourceFiles]) {
    try {
      fileTexts[rel] = await readFile(path.join(project.root, rel), "utf8");
    } catch {
      // Unreadable files are skipped; analysis proceeds with what it can read.
    }
  }
  return { fileTexts, testFiles: files.testFiles, sourceFiles: files.sourceFiles };
}

/**
 * Persists analysis findings for an investigation and returns the finding list
 * plus the evidence map (finding id -> evidence id).
 *
 * @param {StoredData} data
 * @param {Investigation} investigation
 * @param {StateFinding[]} findingsRaw Findings without investigation ids.
 * @returns {{ findings: StateFinding[], analysisEvidenceIds: Record<string, string> }}
 */
function persistAnalysis(data, investigation, findingsRaw) {
  /** @type {StateFinding[]} */
  const findings = [];
  /** @type {Record<string, string>} */
  const analysisEvidenceIds = {};
  for (const raw of findingsRaw) {
    const finding = { ...raw, id: newId("st"), investigationId: investigation.id };
    data.analyses.push(finding);
    investigation.analysisIds.push(finding.id);
    const evidence = evidenceRecord(investigation.id, "analysis", finding.statement, [], finding.certainty === "observed");
    data.evidence.push(evidence);
    investigation.evidenceIds.push(evidence.id);
    analysisEvidenceIds[finding.id] = evidence.id;
    findings.push(finding);
  }
  return { findings, analysisEvidenceIds };
}

/**
 * Resolves the project that owns an investigation.
 *
 * @param {StoredData} data
 * @param {Investigation} investigation
 * @returns {Promise<Project>}
 */
async function projectFor(data, investigation) {
  const project = data.projects.find((item) => item.id === investigation.projectId);
  if (!project) throw new NotFoundError("The project for this investigation no longer exists.");
  return project;
}

/**
 * Resolves the investigation an action applies to. The embedded landing demo
 * passes demoOnly so it always acts on the trusted sample, even when another
 * project's investigation is active in the workspace.
 *
 * @param {StoredData} data
 * @param {boolean} demoOnly
 * @returns {Investigation}
 */
function investigationFor(data, demoOnly) {
  return demoOnly
    ? data.investigations.find((item) => item.id === DEMO_INVESTIGATION_ID) ?? currentInvestigation(data)
    : currentInvestigation(data);
}

/** @returns {Promise<InvestigationSnapshot>} */
export async function getInvestigation() {
  const data = await readStore();
  await bootstrap(data);
  await writeStore(data);
  return snapshot(data, currentInvestigation(data));
}

/** @returns {Promise<Project[]>} */
export async function listProjects() {
  const data = await readStore();
  await bootstrap(data);
  await writeStore(data);
  return data.projects;
}

/**
 * Starts a fresh investigation for a registered project and makes it the
 * workspace's active one.
 *
 * @param {string} projectId
 * @returns {Promise<InvestigationSnapshot>}
 */
export async function startInvestigation(projectId) {
  const data = await readStore();
  await bootstrap(data);
  const project = data.projects.find((item) => item.id === projectId);
  if (!project) throw new NotFoundError("That project was not found.");
  const untouched = data.investigations.find((item) => item.projectId === projectId && item.status === "open" && item.runIds.length === 0);
  if (untouched) {
    await writeStore(data);
    return snapshot(data, untouched);
  }
  const investigation = {
    id: newId("inv"),
    projectId,
    title: `Flaky investigation — ${project.name}`,
    status: "open",
    goal: "Prove which test sequence breaks which test, then verify a cleanup fix.",
    target: null,
    runIds: [], evidenceIds: [], hypothesisIds: [], comparisonIds: [], patchIds: [], verificationIds: [], analysisIds: [],
    createdAt: now(), updatedAt: now(),
  };
  data.investigations.push(investigation);
  await writeStore(data);
  return snapshot(data, investigation);
}

/**
 * Runs only the static shared-state analysis (no subprocesses).
 *
 * @param {string} [projectId] Optional; defaults to the active investigation's project.
 * @returns {Promise<{ snapshot: InvestigationSnapshot, summary: string }>}
 */
export async function scanProject(projectId) {
  const data = await readStore();
  const { investigation } = await bootstrap(data);
  const active = projectId
    ? data.investigations.find((item) => item.projectId === projectId) ?? currentInvestigation(data) ?? investigation
    : currentInvestigation(data) ?? investigation;
  const project = await projectFor(data, active);
  const { analysis } = await analyzeRegisteredProject(project);
  const persisted = persistAnalysis(data, active, analysis.findings);
  active.updatedAt = now();
  await writeStore(data);
  const topFindings = persisted.findings.slice(0, 3).map((finding) => finding.statement);
  return {
    snapshot: snapshot(data, active),
    summary: topFindings.length > 0
      ? `Static analysis recorded ${persisted.findings.length} findings; notably: ${topFindings.join(" | ")}`
      : "Static analysis recorded no shared-state findings for this project.",
  };
}

/**
 * Full controlled investigation against a real project:
 *   triage runs -> resolve target + predecessor from failures or analysis ->
 *   focused matrix runs -> cross-run comparison -> deterministic hypothesis.
 *
 * @param {{ testFile?: string, targetTest?: string, demoOnly?: boolean }} [request]
 * @returns {Promise<InvestigationSnapshot>}
 */
export async function runControlledWorkflow(request = {}) {
  const data = await readStore();
  const { project: demoProject } = await bootstrap(data);
  const investigation = request.demoOnly ? investigationFor(data, true) : currentInvestigation(data);
  if (!investigation) throw new NotFoundError("No investigation exists; start one first.");
  const project = request.demoOnly ? demoProject : await projectFor(data, investigation);

  if (!project.trusted) {
    throw new ForbiddenError("Runs require a trusted project. Confirm the trust prompt for this directory first.");
  }

  const { fileTexts, testFiles } = await readProjectTexts(project);
  if (testFiles.length === 0) throw new ValidationError("No test files were discovered for this project.");

  // Static analysis first: findings guide ranking and later hypothesis + patch.
  const analysisResult = (await analyzeRegisteredProject(project)).analysis;
  const persisted = persistAnalysis(data, investigation, analysisResult.findings);

  /** @type {{ testFile: string, targetTest: string | null, predecessorTest: string | null, reasoning: string }} */
  let shape;
  /** @type {Array<{ file: string, failing: string[] }>} */
  const triageOutcomes = [];

  const requestedFile = typeof request.testFile === "string" && testFiles.includes(request.testFile) ? request.testFile : null;
  const rankedFiles = requestedFile
    ? [requestedFile]
    : Object.entries(analysisResult.scores)
        .sort((a, b) => b[1] - a[1])
        .map(([file]) => file)
        .slice(0, MAX_TRIAGE_FILES);

  for (const candidate of rankedFiles.length > 0 ? rankedFiles : testFiles.slice(0, MAX_TRIAGE_FILES)) {
    const spec = await buildRunCommand({ root: project.root, framework: project.framework, testFiles: [candidate] });
    const run = await executeRunSpec(project, investigation.id, { label: `triage — ${candidate}`, argv: spec.argv, cwd: project.root, parser: spec.parser });
    recordRun(data, investigation, run);
    const failing = run.tests.filter((test) => test.status === "failed").map((test) => test.name);
    triageOutcomes.push({ file: candidate, failing });
  }

  const failedTriage = triageOutcomes.find((outcome) => outcome.failing.length > 0);
  if (failedTriage) {
    const names = orderedTestNames(fileTexts[failedTriage.file] ?? "");
    const targetTest = failedTriage.failing[0];
    const predecessorTest = names.length > 1 ? names[Math.max(0, names.indexOf(targetTest) - 1)] ?? null : null;
    shape = {
      testFile: failedTriage.file,
      targetTest,
      predecessorTest: predecessorTest && predecessorTest !== targetTest ? predecessorTest : null,
      reasoning: `Triage found "${targetTest}" failing in ${failedTriage.file}; the declared predecessor becomes the isolation comparison.`,
    };
  } else {
    const heuristic = chooseTarget(analysisResult, fileTexts, testFiles);
    if (!heuristic) throw new ValidationError("No test target could be resolved for this project.");
    shape = heuristic;
  }
  if (requestedFile) shape.testFile = requestedFile;
  investigation.target = shape;

  const matrixSpecs = await buildMatrixSpecs(project, shape);
  for (const spec of matrixSpecs) {
    const run = await executeRunSpec(project, investigation.id, spec);
    recordRun(data, investigation, run);
  }

  const allRuns = investigation.runIds.map((id) => data.runs.find((run) => run.id === id)).filter(Boolean);
  const runEvidence = data.evidence.filter((item) => item.kind === "run" && item.investigationId === investigation.id);
  const findings = compareRunMatrix(allRuns, runEvidence);
  const comparison = { id: newId("cmp"), investigationId: investigation.id, leftRunId: allRuns[0]?.id ?? "", rightRunId: allRuns.at(-1)?.id ?? "", findings, createdAt: now() };
  data.comparisons.push(comparison);
  investigation.comparisonIds.push(comparison.id);
  for (const finding of findings) {
    const citedRunIds = [...new Set(finding.evidenceIds.flatMap((evidenceId) => data.evidence.find((item) => item.id === evidenceId)?.sourceRunIds ?? []))];
    const evidence = evidenceRecord(
      investigation.id,
      finding.certainty === "unknown" ? "unknown" : "comparison",
      finding.statement,
      citedRunIds,
      finding.certainty === "observed",
      finding.evidenceIds,
    );
    data.evidence.push(evidence);
    investigation.evidenceIds.push(evidence.id);
  }

  const evidence = data.evidence.filter((item) => investigation.evidenceIds.includes(item.id));
  const hypothesis = deterministicHypothesis(investigation.id, findings, persisted.findings, evidence, persisted.analysisEvidenceIds);
  data.hypotheses.push(hypothesis);
  investigation.hypothesisIds.push(hypothesis.id);

  investigation.status = "needs_review";
  investigation.updatedAt = now();
  await writeStore(data);
  return snapshot(data, investigation);
}

/** The legacy demo action now flows through the same generic pipeline. */
export const runDemoInvestigation = () => runControlledWorkflow({ demoOnly: true });

/**
 * Runs the optional AI evidence review for an investigation.
 *
 * @param {boolean} [demoOnly] Act on the trusted sample instead of the active investigation.
 * @returns {Promise<{ snapshot: InvestigationSnapshot, summary: string }>}
 */
export async function runAiReview(demoOnly = false) {
  const data = await readStore();
  await bootstrap(data);
  const investigation = investigationFor(data, demoOnly);
  const current = snapshot(data, investigation);
  const result = await evaluateEvidence(current);
  data.toolInvocations.push(...result.invocations);
  if (result.hypothesis) {
    const hypothesis = { ...result.hypothesis, id: newId("hyp"), createdAt: now() };
    data.hypotheses.push(hypothesis);
    investigation.hypothesisIds.push(hypothesis.id);
    investigation.updatedAt = now();
  }
  await writeStore(data);
  return { snapshot: snapshot(data, investigation), summary: result.summary };
}

/**
 * Drafts the cleanup patch from the current analysis (no writes to disk).
 *
 * @param {boolean} [demoOnly] Act on the trusted sample instead of the active investigation.
 * @returns {Promise<InvestigationSnapshot>}
 */
export async function proposePatch(demoOnly = false) {
  const data = await readStore();
  await bootstrap(data);
  const investigation = investigationFor(data, demoOnly);
  const project = await projectFor(data, investigation);
  const { analysis } = await analyzeRegisteredProject(project);
  const { fileTexts } = await readProjectTexts(project);
  const fallback = chooseTarget(analysis, fileTexts, project.testFiles);
  const target = investigation.target ?? fallback ?? { testFile: project.testFiles[0], targetTest: null, predecessorTest: null, reasoning: "" };
  if (!target?.testFile) throw new ValidationError("No test target could be resolved for patch drafting.");

  const patch = await draftCleanupPatch({ investigationId: investigation.id, project, analysis, fileTexts, shape: target });
  if (!patch) {
    throw new ValidationError("No safe mechanical fix could be drafted: no exported reset function and no provably resettable module state were found. Add an explicit reset hook by hand, then rerun.");
  }
  data.patches.push(patch);
  investigation.patchIds.push(patch.id);
  investigation.updatedAt = now();
  await writeStore(data);
  return snapshot(data, investigation);
}

/**
 * Applies the approved patch, reruns the previously failing ordered probe,
 * and records the verification result.
 *
 * @param {string} patchId
 * @param {boolean} [demoOnly] Act on the trusted sample instead of the active investigation.
 * @returns {Promise<InvestigationSnapshot>}
 */
export async function approveAndVerifyPatch(patchId, demoOnly = false) {
  const data = await readStore();
  await bootstrap(data);
  const investigation = investigationFor(data, demoOnly);
  const project = await projectFor(data, investigation);
  const index = data.patches.findIndex((patch) => patch.id === patchId && patch.investigationId === investigation.id);
  if (index < 0) throw new NotFoundError("Patch was not found for this investigation.");

  data.patches[index] = await applyPatch(data.patches[index], project);

  // Rerun the ordered probe that failed before the patch.
  const orderedProbe = investigation.runIds
    .map((id) => data.runs.find((run) => run.id === id))
    .find((run) => run && run.status === "failed" && run.label.startsWith("file"));
  const rerun = orderedProbe
    ? await rerunRecordedSpec(project, investigation.id, orderedProbe, `post-patch rerun — ${orderedProbe.label}`)
    : await (async () => {
        const spec = await buildRunCommand({ root: project.root, framework: project.framework, testFiles: project.testFiles.slice(0, 1) });
        return executeRunSpec(project, investigation.id, { label: "post-patch rerun", argv: spec.argv, cwd: project.root, parser: spec.parser });
      })();
  recordRun(data, investigation, rerun);

  const verification = verifyRun(
    investigation.id,
    rerun,
    orderedProbe
      ? "Approved patch verification re-executed the recorded failing command."
      : "Approved patch verification re-ran the project's first test file (no prior failing probe was recorded).",
  );
  data.verifications.push(verification);
  investigation.verificationIds.push(verification.id);
  investigation.status = verification.result === "verified" ? "verified" : "needs_review";
  investigation.updatedAt = now();
  await writeStore(data);
  return snapshot(data, investigation);
}

/**
 * Restores every file a patch changed to its recorded baseline.
 *
 * @param {string} patchId
 * @param {boolean} [demoOnly] Act on the trusted sample instead of the active investigation.
 * @returns {Promise<InvestigationSnapshot>}
 */
export async function revertPatch(patchId, demoOnly = false) {
  const data = await readStore();
  await bootstrap(data);
  const investigation = investigationFor(data, demoOnly);
  const project = await projectFor(data, investigation);
  const index = data.patches.findIndex((patch) => patch.id === patchId && patch.investigationId === investigation.id);
  if (index < 0) throw new NotFoundError("Patch was not found for this investigation.");
  data.patches[index] = await revertStoredPatch(data.patches[index], project);
  investigation.status = "needs_review";
  investigation.updatedAt = now();
  await writeStore(data);
  return snapshot(data, investigation);
}
