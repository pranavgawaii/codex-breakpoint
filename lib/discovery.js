import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ValidationError } from "./errors.js";

/** @typedef {"node" | "jest" | "vitest"} RunningFramework */

/** Directories never walked. */
const IGNORE_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage", ".cache", "target", "vendor"]);
/** Files never returned as tests or sources. */
const IGNORE_FILES = new Set(["package-lock.json", "pnpm-lock.yaml"]);
const MAX_FILES = 400;
const MAX_TEST_FILES = 32;

const TEST_SUFFIX = /\.(test|spec)\.(js|mjs|cjs|jsx|ts|tsx)$/;

/**
 * @typedef {object} TestSource
 * @property {string} rel Project-relative path.
 * @property {"test" | "source" | "other"} kind
 */

/**
 * Walks a project directory without following symlinks out of it and returns
 * discovered files, split into tests and sources. No third-party glob is used.
 *
 * @param {string} root Absolute project root.
 * @returns {Promise<{ files: string[], testFiles: string[], sourceFiles: string[], truncated: boolean }>}
 */
export async function discoverFiles(root) {
  /** @type {string[]} */
  const files = [];

  /**
   * @param {string} dir
   * @param {string} rel
   * @returns {Promise<void>}
   */
  async function walk(dir, rel) {
    if (files.length >= MAX_FILES) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true, encoding: "utf8" });
    } catch {
      return; // unreadable subtree: skip, do not fail the whole discovery
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (files.length >= MAX_FILES) return;
      if (entry.name.startsWith(".") && entry.isDirectory()) continue;
      if (IGNORE_DIRS.has(entry.name)) continue;
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), relPath);
        continue;
      }
      if (!entry.isFile() || IGNORE_FILES.has(entry.name)) continue;
      files.push(relPath);
    }
  }

  await walk(root, "");
  const testFiles = files.filter((file) => TEST_SUFFIX.test(file));
  const sourceFiles = files.filter((file) => /\.(js|mjs|cjs|jsx|ts|tsx)$/.test(file) && !TEST_SUFFIX.test(file) && !file.endsWith(".d.ts"));
  return { files, testFiles: testFiles.slice(0, MAX_TEST_FILES), sourceFiles, truncated: files.length >= MAX_FILES };
}

/**
 * Reads package.json when present and returns {} otherwise.
 * @param {string} root
 * @returns {Promise<Record<string, unknown>>}
 */
export async function readPackageJson(root) {
  try {
    const raw = await readFile(path.join(root, "package.json"), "utf8");
    const parsed = /** @type {unknown} */ (JSON.parse(raw));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? /** @type {Record<string, unknown>} */ (parsed) : {};
  } catch {
    return {};
  }
}

/**
 * Detects the first-party test framework from dependencies, scripts, and
 * common config files. Defaults to Node's native runner.
 *
 * @param {string} root
 * @param {Record<string, unknown>} pkg
 * @returns {Promise<RunningFramework>}
 */
export async function detectFramework(root, pkg) {
  const dependencyText = JSON.stringify({ ...pkg.dependencies, ...pkg.devDependencies }) ?? "";
  const scripts = /** @type {Record<string, unknown> | undefined} */ (pkg.scripts);
  const scriptText = JSON.stringify(scripts) ?? "";
  let entries;
  try {
    entries = await readdir(root, { encoding: "utf8" });
  } catch {
    entries = [];
  }
  const configs = entries.filter((name) => /^jest\.config\./.test(name) || /^vitest\.config\./.test(name) || /^vite\.config\./.test(name));

  if (configs.some((name) => name.startsWith("vitest")) || /(vitest|@vitest)/.test(`${dependencyText} ${scriptText}`)) return "vitest";
  if (configs.some((name) => name.startsWith("jest")) || /(jest|@types\/jest)/.test(`${dependencyText} ${scriptText}`)) return "jest";
  return "node";
}

/**
 * Builds the exact argv for a run spec. Detected binaries only ever come from
 * the project's own node_modules/.bin, never npx and never the registry.
 *
 * @param {object} options
 * @param {string} options.root Absolute project root.
 * @param {RunningFramework} options.framework
 * @param {string[]} [options.testFiles] Project-relative test files to run.
 * @param {string} [options.testNamePattern] Restrict to tests matching this name.
 * @returns {Promise<{ argv: string[], parser: "tap" | "jest" | "none" }>}
 */
export async function buildRunCommand(options) {
  const { root, framework, testFiles = [], testNamePattern } = options;
  if (framework === "node") {
    /** @type {string[]} */
    const argv = [process.execPath, "--test", "--test-concurrency=1"];
    // Only pass a pattern when the target suite can be narrowed this way.
    if (testNamePattern) argv.push("--test-name-pattern", testNamePattern);
    if (testFiles.length > 0) argv.push(...testFiles);
    return { argv, parser: "tap" };
  }

  if (framework === "vitest" || framework === "jest") {
    const binName = framework === "vitest" ? "vitest" : "jest";
    const bin = path.join(root, "node_modules", ".bin", binName);
    const binExists = await exists(bin);
    if (!binExists) {
      throw new ValidationError(`${binName} is not installed inside this project; install dependencies or use the default node:test runner.`);
    }
    /** @type {string[]} */
    const argv = [bin];
    if (framework === "vitest") argv.push("run", "--reporter=tap", "--no-color");
    if (framework === "jest") argv.push("--runInBand", "--silent");
    if (testNamePattern) argv.push("--testNamePattern", testNamePattern);
    if (testFiles.length > 0) argv.push(...testFiles);
    return { argv, parser: framework === "vitest" ? "tap" : "jest" };
  }

  return { argv: [process.execPath, ...testFiles], parser: "none" };
}

/** @param {string} target @returns {Promise<boolean>} */
export async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}
