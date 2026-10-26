import { spawn } from "node:child_process";
import { ValidationError } from "./errors.js";

/** Maximum captured bytes per output stream. */
const MAX_OUTPUT_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Executes a fixed argument vector with no shell, a kill timer, environment
 * scrubbing, and per-stream output caps. Callers must pass argv arrays; this
 * module never accepts shell strings.
 *
 * @param {object} options
 * @param {string[]} options.argv Exact argv. argv[0] must be the allowlisted
 *   node binary or a resolved binary inside the target project (declared by
 *   the allowlist check in the caller, never the browser).
 * @param {string} options.cwd Resolved working directory.
 * @param {{ label: string, argv: string[], cwd: string }} [options.spec] Echoed
 *   back for persistence so a run can be reproduced later.
 * @param {number} [options.timeoutMs]
 * @param {Record<string, string>} [options.extraEnv]
 * @returns {Promise<{ spec: { label: string, argv: string[], cwd: string }, result: { status: "passed" | "failed" | "timeout" | "cancelled" | "infrastructure_error", exitCode: number | null, stdout: string, stderr: string, durationMs: number } }>}
 */
export function runProcess(options) {
  const { argv, cwd, spec, timeoutMs = DEFAULT_TIMEOUT_MS, extraEnv } = options;
  if (!Array.isArray(argv) || argv.some((part) => typeof part !== "string")) {
    throw new ValidationError("Subprocess argv must be an array of strings.");
  }
  if (argv.length === 0) throw new ValidationError("Subprocess argv cannot be empty.");
  if (typeof cwd !== "string") throw new ValidationError("Subprocess cwd must be a string.");

  /** @type {{ label: string, argv: string[], cwd: string }} */
  const echoedSpec = spec ?? { label: "ad-hoc process", argv: [...argv], cwd };

  /**
   * Capped stream accumulator: keeps at most MAX_OUTPUT_BYTES per stream so a
   * chatty test cannot exhaust server memory.
   * @param {import("node:stream").Readable | null} stream
   * @returns {Promise<string>}
   */
  function capture(stream) {
    if (!stream) return Promise.resolve("");
    return new Promise((resolve) => {
      /** @type {Buffer[]} */
      const chunks = [];
      let total = 0;
      stream.on("data", (chunk) => {
        if (total >= MAX_OUTPUT_BYTES) return;
        const buffer = /** @type {Buffer} */ (chunk);
        const slice = buffer.subarray(0, Math.min(buffer.length, MAX_OUTPUT_BYTES - total));
        chunks.push(slice);
        total += slice.length;
      });
      stream.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        resolve(total >= MAX_OUTPUT_BYTES ? `${text}\n[output truncated at ${MAX_OUTPUT_BYTES} bytes]` : text);
      });
      stream.on("error", () => resolve(""));
    });
  }

  return new Promise((resolve) => {
    const startedAt = Date.now();
    let didTimeout = false;
    /** @type {Error | undefined} */
    let spawnError;

    const child = spawn(argv[0], argv.slice(1), {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        PATH: process.env.PATH ?? "",
        HOME: cwd,
        TZ: "UTC",
        LANG: "C",
        NO_COLOR: "1",
        CI: "1",
        NODE_ENV: "test",
        FORCE_TTY: "0",
        NODE_OPTIONS: "--max-old-space-size=256",
        NO_PROXY: "*",
        ...extraEnv,
      },
    });

    const stdoutPromise = capture(child.stdout);
    const stderrPromise = capture(child.stderr);
    child.on("error", (error) => { spawnError = /** @type {Error} */ (error); });
    const timer = setTimeout(() => { didTimeout = true; child.kill("SIGKILL"); }, timeoutMs);

    child.on("close", async (code) => {
      clearTimeout(timer);
      const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
      resolve({
        spec: echoedSpec,
        result: {
          status: didTimeout ? "timeout" : spawnError ? "infrastructure_error" : code === 0 ? "passed" : "failed",
          exitCode: code,
          stdout,
          stderr,
          durationMs: Date.now() - startedAt,
        },
      });
    });
  });
}
