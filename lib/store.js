import { access, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";

/** @typedef {import("./models.js").StoredData} StoredData */

const STORE_FILE = "investigations.json";
const MAX_STORE_BYTES = 20 * 1024 * 1024;

const empty = () => ({
  projects: [],
  investigations: [],
  runs: [],
  evidence: [],
  comparisons: [],
  analyses: [],
  hypotheses: [],
  patches: [],
  verifications: [],
  toolInvocations: [],
});

/**
 * Local-first persistence. If the repository is read-only (for example on a
 * serverless host), fall back to the platform temp directory and document that
 * the record is ephemeral there.
 */

/** @type {Promise<string> | null} */
let directoryPromise = null;

/** @returns {Promise<string>} */
export function getDataDirectory() {
  if (!directoryPromise) directoryPromise = resolveDataDirectory();
  return directoryPromise;
}

/** @returns {Promise<string>} */
async function resolveDataDirectory() {
  const configured = process.env.BREAKPOINT_DATA_DIR?.trim();
  const candidates = configured
    ? [path.resolve(configured), path.join(os.tmpdir(), "breakpoint-data")]
    : [path.join(process.cwd(), ".breakpoint"), path.join(os.tmpdir(), "breakpoint-data")];

  /** @type {unknown} */
  let lastError;
  for (const candidate of candidates) {
    try {
      await mkdir(candidate, { recursive: true });
      await access(candidate, constants.W_OK);
      return candidate;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No writable directory is available for the investigation store.");
}

/** @returns {Promise<string>} */
export async function dataFilePath() {
  return path.join(await getDataDirectory(), STORE_FILE);
}

/**
 * @template T
 * @param {unknown} value
 * @returns {T[]}
 */
function asArray(value) {
  return Array.isArray(value) ? /** @type {T[]} */ (value) : [];
}

/**
 * Normalizes older or partial JSON records so a schema addition cannot crash
 * the UI.
 *
 * @param {Partial<StoredData> | null | undefined} input
 * @returns {StoredData}
 */
export function normalizeStore(input) {
  /** @type {StoredData} */
  const data = { ...empty(), ...(input ?? {}) };

  data.projects = asArray(data.projects).filter((item) => item && typeof item.id === "string" && typeof item.root === "string");
  data.investigations = asArray(data.investigations)
    .filter((item) => item && typeof item.id === "string")
    .map((item) => ({
      ...item,
      status: item.status === "verified" || item.status === "needs_review" ? item.status : "open",
      goal: typeof item.goal === "string" ? item.goal : "",
      target: item.target && typeof item.target === "object" && typeof item.target.testFile === "string" ? item.target : null,
      runIds: asArray(item.runIds),
      evidenceIds: asArray(item.evidenceIds),
      hypothesisIds: asArray(item.hypothesisIds),
      comparisonIds: asArray(item.comparisonIds),
      patchIds: asArray(item.patchIds),
      verificationIds: asArray(item.verificationIds),
      analysisIds: asArray(item.analysisIds),
    }));
  data.runs = asArray(data.runs).filter((item) => item && typeof item.id === "string");
  data.evidence = asArray(data.evidence).filter((item) => item && typeof item.id === "string");
  data.comparisons = asArray(data.comparisons).filter((item) => item && typeof item.id === "string");
  data.analyses = asArray(data.analyses).filter((item) => item && typeof item.id === "string");
  data.hypotheses = asArray(data.hypotheses)
    .filter((item) => item && typeof item.id === "string")
    .map((item) => ({
      ...item,
      source: item.source === "ai" ? "ai" : "deterministic",
      supportingEvidenceIds: asArray(item.supportingEvidenceIds),
      contradictingEvidenceIds: asArray(item.contradictingEvidenceIds),
      alternativeExplanations: asArray(item.alternativeExplanations),
    }));
  data.patches = asArray(data.patches)
    .filter((item) => item && typeof item.id === "string")
    .map((item) => {
      /** @type {Array<{ targetPath: string, originalContent: string, appliedContent: string }>} */
      let edits = Array.isArray(item.edits)
        ? item.edits.filter((edit) => edit && typeof edit.targetPath === "string" && typeof edit.originalContent === "string" && typeof edit.appliedContent === "string")
        : [];
      // Legacy single-file patches carry their contents in flat fields.
      if (edits.length === 0 && item.status === "applied" && typeof item.originalContent === "string" && typeof item.appliedContent === "string" && typeof item.targetPath === "string") {
        edits = [{ targetPath: item.targetPath, originalContent: item.originalContent, appliedContent: item.appliedContent }];
      }
      return {
        ...item,
        status: item.status === "applied" || item.status === "reviewed" || item.status === "reverted" ? item.status : "draft",
        edits,
        targetPath: typeof item.targetPath === "string" ? item.targetPath : "",
      };
    });
  data.verifications = asArray(data.verifications).filter((item) => item && typeof item.id === "string");
  data.toolInvocations = asArray(data.toolInvocations).filter((item) => item && typeof item.id === "string");

  return data;
}

/**
 * @param {string} candidate Absolute directory path.
 * @returns {Promise<boolean>}
 */
export async function isDirectory(candidate) {
  try {
    return (await stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

/** @returns {Promise<StoredData>} */
export async function readStore() {
  const file = await dataFilePath();

  try {
    const raw = await readFile(file, "utf8");
    if (raw.length > MAX_STORE_BYTES) {
      throw new Error("The local investigation store is unexpectedly large. Reset the store before continuing.");
    }
    const parsed = /** @type {unknown} */ (JSON.parse(raw));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("The local investigation store is not a JSON object.");
    }
    return normalizeStore(/** @type {Partial<StoredData>} */ (parsed));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return empty();
    throw error;
  }
}

/** @param {StoredData} data @returns {Promise<void>} */
export async function writeStore(data) {
  const directory = await getDataDirectory();
  const file = path.join(directory, STORE_FILE);
  const temporary = path.join(directory, `${STORE_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`);

  await writeFile(temporary, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
  await rename(temporary, file);
}
