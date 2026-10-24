export type RunStatus = "passed" | "failed" | "timeout" | "cancelled" | "infrastructure_error";
export type EvidenceKind = "run" | "comparison" | "output" | "environment" | "unknown";
export type Confidence = "low" | "medium" | "high";
export type HypothesisSource = "deterministic" | "ai";
export type PatchStatus = "draft" | "reviewed" | "applied" | "rejected" | "reverted";

export type AgentToolName =
  | "run_tests"
  | "compare_runs"
  | "inspect_test_output"
  | "inspect_evidence"
  | "propose_experiment"
  | "record_hypothesis"
  | "propose_patch"
  | "verify_patch";

export interface Project {
  id: string;
  name: string;
  root: string;
  trusted: boolean;
  createdAt: string;
}

export interface IndividualTestResult {
  name: string;
  status: "passed" | "failed" | "skipped" | "unknown";
  durationMs?: number;
  error?: string;
}

export interface TestRun {
  id: string;
  projectId: string;
  label: string;
  status: RunStatus;
  command: string[];
  workingDirectory: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  tests: IndividualTestResult[];
  environment: Record<string, string>;
}

/** Run shape safe to send to the browser: raw output stays on the server. */
export interface PublicTestRun extends Omit<TestRun, "stdout" | "stderr"> {
  stdout?: string;
  stderr?: string;
  stdoutBytes?: number;
  stderrBytes?: number;
}

export interface Evidence {
  id: string;
  investigationId: string;
  kind: EvidenceKind;
  statement: string;
  sourceRunIds: string[];
  sourceEvidenceIds?: string[];
  observed: boolean;
  createdAt: string;
}

export interface ComparisonFinding {
  category: "status" | "order" | "error" | "command" | "duration" | "timestamp" | "state";
  statement: string;
  evidenceIds: string[];
  certainty: "observed" | "unknown";
}

export interface RunComparison {
  id: string;
  investigationId: string;
  leftRunId: string;
  rightRunId: string;
  findings: ComparisonFinding[];
  createdAt: string;
}

export interface Hypothesis {
  id: string;
  investigationId: string;
  source?: HypothesisSource;
  description: string;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  confidence: Confidence;
  confidenceJustification: string;
  alternativeExplanations: string[];
  nextExperiment: string;
  experimentOutcome: string | null;
  createdAt: string;
}

export interface AgentToolInvocation {
  id: string;
  investigationId: string;
  tool: AgentToolName;
  arguments: Record<string, unknown>;
  status: "requested" | "completed" | "rejected" | "failed";
  result: string;
  createdAt: string;
}

export interface ProposedPatch {
  id: string;
  investigationId: string;
  description: string;
  diff: string;
  status: PatchStatus;
  baseline: string;
  targetPath: string;
  /** Server-only: exact baseline content used for apply/revert checks. */
  originalContent: string;
  /** Server-only: exact content written when the patch was applied. */
  appliedContent?: string;
}

/** Patch shape safe to send to the browser. */
export type PublicPatch = Omit<ProposedPatch, "originalContent" | "appliedContent">;

export interface VerificationResult {
  id: string;
  investigationId: string;
  runId: string;
  result: "verified" | "not_verified" | "unknown";
  notes: string;
}

export interface Investigation {
  id: string;
  projectId: string;
  title: string;
  status: "needs_review" | "verified" | "open";
  runIds: string[];
  evidenceIds: string[];
  hypothesisIds: string[];
  comparisonIds: string[];
  patchIds: string[];
  verificationIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StoredData {
  projects: Project[];
  investigations: Investigation[];
  runs: TestRun[];
  evidence: Evidence[];
  comparisons: RunComparison[];
  hypotheses: Hypothesis[];
  patches: ProposedPatch[];
  verifications: VerificationResult[];
  toolInvocations: AgentToolInvocation[];
}

export interface InvestigationSnapshot {
  investigation: Investigation;
  runs: PublicTestRun[];
  evidence: Evidence[];
  comparisons: RunComparison[];
  hypotheses: Hypothesis[];
  toolInvocations: AgentToolInvocation[];
  patches: PublicPatch[];
  verifications: VerificationResult[];
}
