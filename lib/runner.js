import { buildRunCommand } from "./discovery.js";
import { ValidationError } from "./errors.js";
import { runProcess } from "./spawn-safe.js";

/** @typedef {import("./models.js").IndividualTestResult} IndividualTestResult */
/** @typedef {import("./models.js").RunStatus} RunStatus */
/** @typedef {import("./models.js").Project} Project */
/** @typedef {import("./models.js").TestRun} TestRun */

const TIMEOUT_MS = 15_000;

/** Maximum test unit count parsed per run. */
const MAX_PARSED_TESTS = 200;

/** Clean control characters away so names cannot be spoofed into JSON. */
function sanitizedName(value) {
  return value.replace(/[^\x20-\x7e]/g, "").slice(0, 200).trim();
}

/**
 * Parses TAP output (node --test emits it; `vitest --reporter=tap` too).
 *
 * Handles both formats emitted in the wild:
 *  - spec lines: `✔ name (12.34ms)` / `✖ name (...)`
 *  - classic TAP: `ok 1 - name` / `not ok 2 - name` plus YAML diagnostic blocks
 *
 * @param {string} output
 * @returns {IndividualTestResult[]}
 */
export function parseTap(output) {
  /** @type {IndividualTestResult[]} */
  const results = [];
  const lines = output.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    // Format A: node --test spec summary lines.
    const specMatch = line.match(/^([✔✖])\s+(.+?)\s*\(([\d.]+)ms\)/);
    if (specMatch) {
      results.push({
        name: sanitizedName(specMatch[2]),
        status: specMatch[1] === "✔" ? "passed" : "failed",
        durationMs: Number(specMatch[3]),
      });
      if (results.length >= MAX_PARSED_TESTS) return results;
      continue;
    }

    // Format B: classic TAP plan lines with YAML diagnostics that follow.
    const tapMatch = line.match(/^(not ok|ok)\s+\d+\s*(?:-\s*)?(.*)$/);
    if (tapMatch) {
      const isSkipped = /#\s*(SKIP|TODO)/.test(tapMatch[2]);
      const name = sanitizedName(tapMatch[2].replace(/#\s*(SKIP|TODO).*$/, "").trim());
      if (name) {
        const context = lines.slice(index + 1, index + 26).join("\n");
        const duration = context.match(/^\s+duration_ms:\s*([\d.]+)/m);
        const error = context.match(/^\s+error:\s*['\x22]?([^\n'"\r]+)/m);
        results.push({
          name,
          status: isSkipped ? "skipped" : tapMatch[1] === "ok" ? "passed" : "failed",
          durationMs: duration ? Number(duration[1]) : undefined,
          error: error?.[1]?.trim(),
        });
        if (results.length >= MAX_PARSED_TESTS) return results;
      }
      continue;
    }

    // Format C: comment lines used by some reporters to announce subtests.
    const subtestMatch = line.match(/^# Subtest: (.*)$/);
    if (subtestMatch) {
      const name = sanitizedName(subtestMatch[1]);
      if (name && !results.some((result) => result.name === name)) {
        results.push({ name, status: "unknown" });
        if (results.length >= MAX_PARSED_TESTS) return results;
      }
    }
  }

  return results;
}

/**
 * Weak but explicit jest-style reporter parsing. When the reporter cannot be
 * trusted, test status is recorded as "unknown" instead of guessed.
 *
 * @param {string} output
 * @returns {IndividualTestResult[]}
 */
export function parseJestStyle(output) {
  /** @type {IndividualTestResult[]} */
  const results = [];
  for (const line of output.split("\n")) {
    const match = line.match(/^\s*(?:✓|√|--)\s+(.*)$|^\s*(?:✕|×|--)\s+(.*)$/);
    if (!match) continue;
    const failed = /^\s*(?:✕|×)/.test(line);
    const name = sanitizedName((failed ? match[2] : match[1]) ?? "");
    if (!name) continue;
    results.push({ name, status: failed ? "failed" : "passed" });
    if (results.length >= MAX_PARSED_TESTS) return results;
  }
  return results;
}

/** Deduplicate per-test entries that appear in both spec and TAP sections. */
function dedupeTests(tests) {
  const seen = new Set();
  const kept = [];
  for (const test of tests) {
    const key = `${test.name}::${test.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(test);
  }
  return kept;
}

/**
 * Persists one executed run descendant from a raw process result.
 *
 * @param {object} options
 * @param {string} options.id
 * @param {string} options.projectId
 * @param {string} options.investigationId
 * @param {{ label: string, argv: string[], cwd: string }} options.spec
 * @param {"passed" | "failed" | "timeout" | "cancelled" | "infrastructure_error"} options.status
 * @param {number | null} options.exitCode
 * @param {string} options.stdout
 * @param {string} options.stderr
 * @param {number} options.durationMs
 * @param {"tap" | "jest" | "none"} options.parser
 * @returns {TestRun}
 */
export function buildTestRun(options) {
  const { id, projectId, investigationId, spec, status, exitCode, stdout, stderr, durationMs, parser } = options;
  const rawTests = parser === "tap" ? parseTap(stdout) : parser === "jest" ? parseJestStyle(`${stdout}\n${stderr}`) : [];
  return {
    id,
    projectId,
    investigationId,
    label: spec.label,
    status,
    command: spec.argv,
    workingDirectory: spec.cwd,
    startedAt: new Date(Date.now() - durationMs).toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs,
    exitCode,
    stdout,
    stderr,
    tests: dedupeTests(rawTests),
    environment: {
      node: process.version,
      platform: process.platform,
      cwd: spec.cwd,
      parser,
    },
    spec,
  };
}

/**
 * Executes one run spec against a project and returns a persisted-ready run.
 *
 * @param {Project} project
 * @param {string} investigationId
 * @param {{ label: string, argv: string[], cwd: string, parser: "tap" | "jest" | "none" }} spec
 * @param {number} [timeoutMs]
 * @returns {Promise<TestRun>}
 */
export async function executeRunSpec(project, investigationId, spec, timeoutMs = TIMEOUT_MS) {
  if (!spec.argv?.length) throw new ValidationError("Run spec is missing argv.");
  if (spec.parser === undefined) throw new ValidationError("Run spec is missing a parser designation.");
  const { result } = await runProcess({ argv: spec.argv, cwd: spec.cwd, spec, timeoutMs });
  return buildTestRun({
    id: `run_${crypto.randomUUID().slice(0, 8)}`,
    projectId: project.id,
    investigationId,
    spec,
    status: result.status,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: result.durationMs,
    parser: spec.parser,
  });
}

/**
 * Escapes a test name for `--test-name-pattern`, which is a regex.
 *
 * @param {string} name
 * @returns {string}
 */
export function escapeTestNamePattern(name) {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds the focused matrix for a resolved target test: solo target,
 * solo predecessor, and two whole-file probes in declared order.
 *
 * @param {Project} project
 * @param {object} shape Resolved investigation targets.
 * @param {string} shape.testFile Project-relative file containing the target test.
 * @param {string | null} shape.targetTest Name of the failing-candidate test.
 * @param {string | null} shape.predecessorTest Name of the test that runs before it.
 * @returns {Promise<Array<{ label: string, argv: string[], cwd: string, parser: "tap" | "jest" | "none" }>>}
 */
export async function buildMatrixSpecs(project, shape) {
  const { testFile, targetTest, predecessorTest } = shape;
  /** @type {Array<{ label: string, argv: string[], cwd: string, parser: "tap" | "jest" | "none" }>} */
  const specs = [];

  if (targetTest) {
    const solo = await buildRunCommand({ root: project.root, framework: project.framework, testFiles: [testFile], testNamePattern: escapeTestNamePattern(targetTest) });
    specs.push({ label: `target test in isolation — ${targetTest}`, argv: solo.argv, cwd: project.root, parser: solo.parser });
  }
  if (predecessorTest) {
    const solo = await buildRunCommand({ root: project.root, framework: project.framework, testFiles: [testFile], testNamePattern: escapeTestNamePattern(predecessorTest) });
    specs.push({ label: `predecessor test in isolation — ${predecessorTest}`, argv: solo.argv, cwd: project.root, parser: solo.parser });
  }
  const whole = await buildRunCommand({ root: project.root, framework: project.framework, testFiles: [testFile] });
  specs.push({ label: `file in declared order — ${testFile}`, argv: whole.argv, cwd: project.root, parser: whole.parser });
  specs.push({ label: `file again (reproducibility probe) — ${testFile}`, argv: whole.argv, cwd: project.root, parser: whole.parser });
  return specs;
}

/**
 * Re-executes a recorded run spec verbatim (used for post-patch verification).
 * The spec comes from a previously recorded run, so no browser input flows in.
 *
 * @param {Project} project
 * @param {string} investigationId
 * @param {TestRun} previous
 * @param {string} label
 * @returns {Promise<TestRun>}
 */
export async function rerunRecordedSpec(project, investigationId, previous, label) {
  return executeRunSpec(project, investigationId, {
    label,
    argv: previous.spec.argv,
    cwd: previous.spec.cwd,
    parser: /** @type {"tap" | "jest" | "none"} */ (previous.environment?.parser ?? "tap"),
  });
}
