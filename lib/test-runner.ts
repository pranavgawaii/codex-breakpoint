import { spawn } from "node:child_process";
import path from "node:path";
import type { IndividualTestResult, RunStatus, TestRun } from "./models";

const demoRoot = path.join(process.cwd(), "sample-project");
const MAX_OUTPUT = 64 * 1024;
const TIMEOUT_MS = 10_000;

const approvedCommands = {
  isolated: {
    label: "session test in isolation",
    args: ["--test", "--test-name-pattern", "session starts without a user", "test/session-flow.test.js"],
  },
  auth: { label: "authentication test in isolation", args: ["--test", "--test-name-pattern", "authentication establishes the demo user", "test/session-flow.test.js"] },
  pair: { label: "authentication then session", args: ["--test", "test/session-flow.test.js"] },
  reverse: { label: "session then authentication", args: ["--test", "test/reverse-flow.test.js"] },
  suite: { label: "ordered demo suite", args: ["--test", "test/session-flow.test.js"] },
} as const;

export type ApprovedRun = keyof typeof approvedCommands;

function clipped(value: string): string {
  return value.length > MAX_OUTPUT ? `${value.slice(0, MAX_OUTPUT)}\n[output truncated]` : value;
}

function parseTap(output: string): IndividualTestResult[] {
  const results: IndividualTestResult[] = [];
  const lines = output.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const specMatch = lines[index].match(/^[✔✖]\s+(.+?)\s*\(([\d.]+)ms\)/);
    if (specMatch) {
      results.push({ name: specMatch[1], status: lines[index].startsWith("✔") ? "passed" : "failed", durationMs: Number(specMatch[2]) });
      continue;
    }
    const match = lines[index].match(/^# (?:Subtest: )?(.*)$/) || lines[index].match(/^# Subtest: (.*)$/);
    if (!match) continue;
    const name = match[1].trim();
    const following = lines.slice(index + 1, index + 8).join("\n");
    const statusMatch = following.match(/^(ok|not ok)\s+\d+/m);
    if (!statusMatch) continue;
    const duration = following.match(/duration_ms:\s*([\d.]+)/);
    const error = following.match(/error:\s*['"]?([^\n'"]+)/);
    results.push({ name, status: statusMatch[1] === "ok" ? "passed" : "failed", durationMs: duration ? Number(duration[1]) : undefined, error: error?.[1] });
  }
  return results;
}

export async function runApprovedDemo(commandId: ApprovedRun): Promise<TestRun> {
  const approved = approvedCommands[commandId];
  if (!approved) throw new Error("Unapproved test command.");
  const id = `run_${crypto.randomUUID().slice(0, 8)}`;
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const environment = { node: process.version, platform: process.platform, runner: "node --test", isolation: "trusted local demo only" };

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let didTimeout = false;
    let spawnError: Error | undefined;
    const child = spawn(process.execPath, approved.args, {
      cwd: demoRoot,
      shell: false,
      env: { PATH: process.env.PATH ?? "", HOME: demoRoot, NODE_ENV: "test", NODE_OPTIONS: "--max-old-space-size=128", NO_PROXY: "*" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (chunk: Buffer) => { stdout = clipped(stdout + chunk.toString()); });
    child.stderr?.on("data", (chunk: Buffer) => { stderr = clipped(stderr + chunk.toString()); });
    child.on("error", (error) => { spawnError = error; });
    const timer = setTimeout(() => { didTimeout = true; child.kill("SIGKILL"); }, TIMEOUT_MS);
    child.on("close", (code) => {
      clearTimeout(timer);
      const status: RunStatus = didTimeout ? "timeout" : spawnError ? "infrastructure_error" : code === 0 ? "passed" : "failed";
      resolve({ id, projectId: "project_demo", label: approved.label, status, command: [process.execPath, ...approved.args], workingDirectory: demoRoot, startedAt, finishedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - start), exitCode: code, stdout, stderr, tests: parseTap(stdout), environment });
    });
  });
}
