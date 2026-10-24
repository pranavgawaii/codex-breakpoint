import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoredData } from "./models";

const dataDirectory = path.join(process.cwd(), ".breakpoint");
const dataFile = path.join(dataDirectory, "investigations.json");
const empty = (): StoredData => ({ projects: [], investigations: [], runs: [], evidence: [], comparisons: [], hypotheses: [], patches: [], verifications: [], toolInvocations: [] });

export async function readStore(): Promise<StoredData> {
  try {
    const data = JSON.parse(await readFile(dataFile, "utf8")) as Partial<StoredData>;
    return { projects: [], investigations: [], runs: [], evidence: [], comparisons: [], hypotheses: [], patches: [], verifications: [], toolInvocations: [], ...data };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty();
    throw error;
  }
}

export async function writeStore(data: StoredData): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  const temporary = `${dataFile}.tmp`;
  await writeFile(temporary, JSON.stringify(data, null, 2), "utf8");
  await rename(temporary, dataFile);
}
