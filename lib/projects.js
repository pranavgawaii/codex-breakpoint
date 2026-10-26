import { access, constants as fsConstants, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ValidationError } from "./errors.js";
import { detectFramework, discoverFiles, readPackageJson } from "./discovery.js";
import { analyzeProject } from "./state-analysis.js";
import { readStore, writeStore } from "./store.js";

/** @typedef {import("./models.js").Project} Project */
/** @typedef {import("./models.js").StateFinding} StateFinding */

/** Absolute path prefixes that must never be registered as projects. */
const FORBIDDEN_ROOTS = ["/", "/etc", "/usr", "/bin", "/sbin", "/var", "/System", "/Library", "/private/etc", "/opt/homebrew", "/Applications", "/cores", "/dev"];
const MAX_ROOT_LENGTH = 512;
/** Bundled sample lives next to the package root, independent of process.cwd(). */
const SAMPLE_PROJECT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sample-project");

/**
 * @typedef {object} ProjectRegistration
 * @property {Project} project
 * @property {{ framework: import("./discovery.js").RunningFramework, testFiles: string[], sourceFiles: string[], stateFindingCount: number, truncated: boolean }} discovery
 */

/**
 * Validates and registers a local project directory. The path must exist on
 * this machine, must not be a system prefix, and must plausibly contain
 * tests. Registration alone never executes anything; runs additionally
 * require the trusted flag to have been explicitly confirmed by a human in
 * the same request.
 *
 * @param {string} rootInput Absolute path typed by the operator.
 * @param {boolean} trustedExplicit True only when the request explicitly confirmed trust.
 * @returns {Promise<ProjectRegistration>}
 */
export async function registerProject(rootInput, trustedExplicit) {
  if (typeof rootInput !== "string" || rootInput.length === 0 || rootInput.length > MAX_ROOT_LENGTH) {
    throw new ValidationError("Provide a project path (an absolute directory on this machine).");
  }
  const root = path.resolve(rootInput.trim());
  if (!path.isAbsolute(root)) throw new ValidationError("The project path must be absolute.");
  if (FORBIDDEN_ROOTS.includes(root) || FORBIDDEN_ROOTS.some((forbidden) => forbidden !== "/" && (root === forbidden || root.startsWith(`${forbidden}/`)))) {
    throw new ValidationError("Refusing to register a system directory as a project.");
  }
  const info = await stat(root).catch(() => null);
  if (!info || !info.isDirectory()) throw new ValidationError("That path is not a directory on this machine.");

  const pkg = await readPackageJson(root);
  const files = await discoverFiles(root);
  if (files.testFiles.length === 0) {
    throw new ValidationError("No test files were discovered there (looked for *.test.* and *.spec.* files).");
  }
  try {
    await access(root, fsConstants.R_OK);
  } catch {
    throw new ValidationError("The project directory is not readable by this process.");
  }

  const pkgName = typeof pkg.name === "string" && pkg.name.length > 0 ? pkg.name : path.basename(root);
  const framework = await detectFramework(root, pkg);
  const project = {
    id: `project_${crypto.randomUUID().slice(0, 8)}`,
    name: pkgName,
    root,
    trusted: trustedExplicit === true,
    framework,
    testFiles: files.testFiles,
    createdAt: new Date().toISOString(),
  };

  return { project, discovery: { framework, testFiles: files.testFiles, sourceFiles: files.sourceFiles, stateFindingCount: 0, truncated: files.truncated } };
}

/**
 * Runs the static state analysis for a project and returns findings plus the
 * raw per-file text needed by the patch engine. This never executes tests.
 *
 * @param {Project} project
 * @returns {Promise<{ analysis: ReturnType<typeof analyzeProject>, fileTexts: Record<string, string> }>}
 */
export async function analyzeRegisteredProject(project) {
  const { discoverFiles: rediscover } = { discoverFiles };
  const files = await rediscover(project.root);
  /** @type {Record<string, string>} */
  const fileTexts = {};
  for (const rel of [...files.testFiles, ...files.sourceFiles]) {
    try {
      fileTexts[rel] = await readFile(path.join(project.root, rel), "utf8");
    } catch {
      // Unreadable file: skip it; analysis proceeds with what it can read.
    }
  }
  const analysis = analyzeProject({ fileTexts, testFiles: files.testFiles, sourceFiles: files.sourceFiles });
  return { analysis, fileTexts };
}

/**
 * Registers a project in the store (deduplicating by resolved root) and
 * returns the stored record with its discovery summary.
 *
 * @param {string} rootInput
 * @param {boolean} trustedExplicit
 * @returns {Promise<ProjectRegistration>}
 */
export async function registerProjectAction(rootInput, trustedExplicit) {
  const data = await readStore();
  const { project, discovery } = await registerProject(rootInput, trustedExplicit);
  const existing = data.projects.find((item) => {
    try {
      return path.resolve(item.root) === project.root;
    } catch {
      return false;
    }
  });
  if (existing) {
    existing.framework = project.framework;
    existing.testFiles = project.testFiles;
    if (trustedExplicit) existing.trusted = true;
    await writeStore(data);
    return { project: existing, discovery };
  }
  data.projects.push(project);
  await writeStore(data);
  return { project, discovery };
}

/**
 * Lists registered projects (bootstrapping the demo project when absent).
 *
 * @returns {Promise<Project[]>}
 */
export async function listProjectsAction() {
  const data = await readStore();
  if (data.projects.length === 0) {
    const files = await discoverFiles(SAMPLE_PROJECT_ROOT);
    data.projects.push({
      id: "project_demo",
      name: "Trusted session-state demo",
      root: SAMPLE_PROJECT_ROOT,
      trusted: true,
      framework: "node",
      testFiles: files.testFiles,
      createdAt: new Date().toISOString(),
    });
    await writeStore(data);
  }
  return data.projects;
}

/**
 * @param {Record<string, unknown> | null | undefined} raw
 * @returns {Project | null}
 */
export function asProject(raw) {
  if (!raw || typeof raw !== "object") return null;
  const candidate = /** @type {Record<string, unknown>} */ (raw);
  if (typeof candidate.id !== "string" || typeof candidate.root !== "string") return null;
  return /** @type {Project} */ (candidate);
}
