/**
 * Standard simulated sample investigation snapshot for interactive UI inspection
 * and zero-state live exploration when backend engine is in standby.
 */
export const SAMPLE_INVESTIGATION_SNAPSHOT = {
  investigation: {
    id: "inv_session_state",
    projectId: "proj_sample_node",
    title: "Session state persists between tests",
    status: "verified",
    goal: "Prove which test sequence breaks auth session state, then verify a cleanup fix.",
    target: {
      testFile: "test/auth.test.js",
      targetTest: "auth: validates session expiration",
      predecessorTest: "auth: keeps user session cached",
      reasoning: "Session state leaked across run boundary without resetting session store."
    },
    runIds: ["run_triage_01", "run_isolated_02", "run_reverse_03", "run_verify_04"],
    evidenceIds: ["ev_101", "ev_102", "ev_103", "ev_104"],
    hypothesisIds: ["hyp_01"],
    comparisonIds: ["comp_01"],
    patchIds: ["patch_01"],
    verificationIds: ["verif_01"],
    createdAt: "2026-10-28T10:00:00.000Z",
    updatedAt: "2026-10-28T10:14:22.000Z"
  },
  project: {
    id: "proj_sample_node",
    name: "Trusted session-state demo",
    framework: "node",
    trusted: true,
    root: "./sample-project",
    testFiles: ["test/auth.test.js", "test/users.test.js", "test/billing.test.js"]
  },
  runs: [
    {
      id: "run_triage_01",
      label: "Triage suite execution",
      status: "failed",
      command: ["node", "--test", "test/auth.test.js"],
      workingDirectory: "/sample-project",
      startedAt: "2026-10-28T10:02:11.000Z",
      finishedAt: "2026-10-28T10:02:13.000Z",
      durationMs: 1840,
      exitCode: 1,
      tests: { passed: 3, failed: 1, total: 4 },
      environment: { NODE_ENV: "test" },
      spec: "test/auth.test.js",
      stdoutBytes: 4200,
      stderrBytes: 312
    },
    {
      id: "run_isolated_02",
      label: "Isolated target probe",
      status: "passed",
      command: ["node", "--test", "--test-name-pattern=validates session expiration", "test/auth.test.js"],
      workingDirectory: "/sample-project",
      startedAt: "2026-10-28T10:04:40.000Z",
      finishedAt: "2026-10-28T10:04:41.000Z",
      durationMs: 620,
      exitCode: 0,
      tests: { passed: 1, failed: 0, total: 1 },
      environment: { NODE_ENV: "test" },
      spec: "test/auth.test.js",
      stdoutBytes: 1540,
      stderrBytes: 0
    },
    {
      id: "run_reverse_03",
      label: "Reversed predecessor order",
      status: "failed",
      command: ["node", "--test", "test/auth.test.js", "--reverse"],
      workingDirectory: "/sample-project",
      startedAt: "2026-10-28T10:06:15.000Z",
      finishedAt: "2026-10-28T10:06:17.000Z",
      durationMs: 1950,
      exitCode: 1,
      tests: { passed: 3, failed: 1, total: 4 },
      environment: { NODE_ENV: "test" },
      spec: "test/auth.test.js",
      stdoutBytes: 4310,
      stderrBytes: 280
    },
    {
      id: "run_verify_04",
      label: "Verification rerun after patch",
      status: "passed",
      command: ["node", "--test", "test/auth.test.js"],
      workingDirectory: "/sample-project",
      startedAt: "2026-10-28T10:14:02.000Z",
      finishedAt: "2026-10-28T10:14:04.000Z",
      durationMs: 1420,
      exitCode: 0,
      tests: { passed: 4, failed: 0, total: 4 },
      environment: { NODE_ENV: "test" },
      spec: "test/auth.test.js",
      stdoutBytes: 3820,
      stderrBytes: 0
    }
  ],
  evidence: [
    {
      id: "ev_101",
      investigationId: "inv_session_state",
      kind: "run",
      statement: "Target test fails when preceded by 'keeps user session cached' in full suite execution.",
      sourceRunIds: ["run_triage_01"],
      observed: true,
      sourceEvidenceIds: [],
      createdAt: "2026-10-28T10:02:13.000Z"
    },
    {
      id: "ev_102",
      investigationId: "inv_session_state",
      kind: "run",
      statement: "Target test passes consistently in clean isolated process probe.",
      sourceRunIds: ["run_isolated_02"],
      observed: true,
      sourceEvidenceIds: [],
      createdAt: "2026-10-28T10:04:41.000Z"
    },
    {
      id: "ev_103",
      investigationId: "inv_session_state",
      kind: "analysis",
      statement: "Module sessionStore exports resetSession() but lacks test teardown hook in auth.test.js.",
      sourceRunIds: ["run_reverse_03"],
      observed: true,
      sourceEvidenceIds: ["ev_101"],
      createdAt: "2026-10-28T10:06:18.000Z"
    },
    {
      id: "ev_104",
      investigationId: "inv_session_state",
      kind: "run",
      statement: "Memory leak suspicion discounted; module level Map cache retains active session tokens.",
      sourceRunIds: [],
      observed: false,
      sourceEvidenceIds: [],
      createdAt: "2026-10-28T10:07:00.000Z"
    }
  ],
  comparisons: [
    {
      id: "comp_01",
      investigationId: "inv_session_state",
      leftRunId: "run_triage_01",
      rightRunId: "run_isolated_02",
      findings: [
        {
          statement: "Failure mode disappears when isolated from preceding session test cases.",
          certainty: "observed"
        },
        {
          statement: "Environment variables and process arguments are byte-identical across runs.",
          certainty: "observed"
        },
        {
          statement: "Global singleton cache retains user authorization across file-level execution.",
          certainty: "observed"
        }
      ]
    }
  ],
  hypotheses: [
    {
      id: "hyp_01",
      confidence: "high",
      description: "In-memory session registry retains active sessions across test cases without beforeEach teardown.",
      confidenceJustification: "Proved by clean isolated pass versus persistent suite failure and exported resetSession() symbol.",
      nextExperiment: "Inject beforeEach(() => resetSession()) into test/auth.test.js and execute suite.",
      supportingEvidenceIds: ["ev_101", "ev_102", "ev_103"],
      alternativeExplanations: [
        "Database transaction rolled back asynchronously",
        "Process environment variable pollution"
      ]
    }
  ],
  patches: [
    {
      id: "patch_01",
      investigationId: "inv_session_state",
      description: "Wire resetSession() into beforeEach hook in test/auth.test.js",
      targetPath: "test/auth.test.js",
      baseline: "commit a9f2b80",
      status: "applied",
      diff: `--- a/test/auth.test.js\n+++ b/test/auth.test.js\n@@ -2,6 +2,7 @@\n const test = require('node:test');\n const assert = require('node:assert/strict');\n const { loginUser, validateSession, resetSession } = require('../src/session');\n+\n+test.beforeEach(() => { resetSession(); });\n \n test('auth: keeps user session cached', async () => {\n   const session = await loginUser('alice');`
    }
  ],
  verifications: [
    {
      id: "verif_01",
      investigationId: "inv_session_state",
      runId: "run_verify_04",
      patchId: "patch_01",
      result: "verified",
      notes: "Suite passed 4 of 4 tests in declared order without cross-test leakage after hook integration.",
      createdAt: "2026-10-28T10:14:04.000Z"
    }
  ]
};
