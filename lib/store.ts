import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  AgentToolInvocation,
  Evidence,
  Hypothesis,
  Investigation,
  Project,
  ProposedPatch,
  RunComparison,
  StoredData,
  TestRun,
  VerificationResult
} from "./models";

const STORE_FILE = "investigations.json";
const MAX_STORE_BYTES = 20 * 1024 * 1024;

const empty = (): StoredData => ({
  projects: [],
  investigations: [],
  runs: [],
  evidence: [],
  comparisons: [],
  hypotheses: [],
  patches: [],
  verifications: [],
  toolInvocations: []
});

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/**
 * Local-first persistence. If the repository is read-only (for example on a
 * serverless host), fall back to the platform temp directory and document that
 * the record is ephemeral there.
 */
let directoryPromise: Promise<string> | null = null;

export function getDataDirectory(): Promise<string> {
  if (!directoryPromise) directoryPromise = resolveDataDirectory();
  return directoryPromise;
}

async function resolveDataDirectory(): Promise<string> {
  const configured = process.env.BREAKPOINT_DATA_DIR?.trim();
  const candidates = configured
    ? [path.resolve(configured), path.join(os.tmpdir(), "breakpoint-data")]
    : [path.join(process.cwd(), ".breakpoint"), path.join(os.tmpdir(), "breakpoint-data")];

  let lastError: unknown;
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

export async function dataFilePath(): Promise<string> {
  return path.join(await getDataDirectory(), STORE_FILE);
}

/** Normalizes older or partial JSON records so a schema addition cannot crash the UI. */
export function normalizeStore(input: Partial<StoredData> | null | undefined): StoredData {
  const data = { ...empty(), ...(input ?? {}) };

  data.projects = asArray<Project>(data.projects).filter((item) => item && typeof item.id === "string");
  data.investigations = asArray<Investigation>(data.investigations)
    .filter((item) => item && typeof item.id === "string")
    .map((item) => ({
      ...item,
      status: item.status === "verified" || item.status === "needs_review" ? item.status : "open",
      runIds: asArray<string>(item.runIds),
      evidenceIds: asArray<string>(item.evidenceIds),
      hypothesisIds: asArray<string>(item.hypothesisIds),
      comparisonIds: asArray<string>(item.comparisonIds),
      patchIds: asArray<string>(item.patchIds),
      verificationIds: asArray<string>(item.verificationIds)
    }));
  data.runs = asArray<TestRun>(data.runs).filter((item) => item && typeof item.id === "string");
  data.evidence = asArray<Evidence>(data.evidence).filter((item) => item && typeof item.id === "string");
  data.comparisons = asArray<RunComparison>(data.comparisons).filter((item) => item && typeof item.id === "string");
  data.hypotheses = asArray<Hypothesis>(data.hypotheses)
    .filter((item) => item && typeof item.id === "string")
    .map((item) => ({
      ...item,
      source: item.source === "ai" ? "ai" : "deterministic",
      supportingEvidenceIds: asArray<string>(item.supportingEvidenceIds),
      contradictingEvidenceIds: asArray<string>(item.contradictingEvidenceIds),
      alternativeExplanations: asArray<string>(item.alternativeExplanations)
    }));
  data.patches = asArray<ProposedPatch>(data.patches)
    .filter((item) => item && typeof item.id === "string")
    .map((item) => ({
      ...item,
      status:
        item.status === "applied" || item.status === "reviewed" || item.status === "reverted"
          ? item.status
          : "draft",
      originalContent: typeof item.originalContent === "string" ? item.originalContent : "",
      targetPath: typeof item.targetPath === "string" ? item.targetPath : "test/session-flow.test.js"
    }));
  data.verifications = asArray<VerificationResult>(data.verifications).filter(
    (item) => item && typeof item.id === "string"
  );
  data.toolInvocations = asArray<AgentToolInvocation>(data.toolInvocations).filter(
    (item) => item && typeof item.id === "string"
  );

  return data;
}

export async function readStore(): Promise<StoredData> {
  const file = await dataFilePath();

  try {
    const raw = await readFile(file, "utf8");
    if (raw.length > MAX_STORE_BYTES) {
      throw new Error("The local investigation store is unexpectedly large. Reset the demo before continuing.");
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("The local investigation store is not a JSON object.");
    }
    return normalizeStore(parsed as Partial<StoredData>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty();
    throw error;
  }
}

export async function writeStore(data: StoredData): Promise<void> {
  const directory = await getDataDirectory();
  const file = path.join(directory, STORE_FILE);
  const temporary = path.join(directory, `${STORE_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`);

  await writeFile(temporary, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
  await rename(temporary, file);
}
