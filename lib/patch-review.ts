import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ConflictError, ValidationError } from "./errors";
import type { ProposedPatch, TestRun, VerificationResult } from "./models";

const demoRoot = path.join(process.cwd(), "sample-project");
const safeTarget = path.join(demoRoot, "test", "session-flow.test.js");

/** Patch text is scoped to the trusted demo source. Apply and revert are explicit, approval-gated operations. */
export async function createDemoCleanupPatch(investigationId: string): Promise<ProposedPatch> {
  const originalContent = await readFile(safeTarget, "utf8");
  return { id: `patch_${crypto.randomUUID().slice(0, 8)}`, investigationId, description: "Reset module-level session state before every test.", diff: "+ test.beforeEach(() => clearSession());", status: "draft", baseline: "trusted-demo baseline", targetPath: "test/session-flow.test.js", originalContent };
}

export async function applyDemoPatch(patch: ProposedPatch): Promise<ProposedPatch> {
  if (patch.status !== "draft" || patch.targetPath !== "test/session-flow.test.js") throw new ValidationError("Only a draft patch for the approved demo source can be applied.");
  const current = await readFile(safeTarget, "utf8");
  if (current !== patch.originalContent) throw new ConflictError("Patch blocked: source no longer matches the recorded baseline.");
  const updated = current.replace('import { authenticate, currentUser } from "../src/session.js";', 'import { authenticate, clearSession, currentUser } from "../src/session.js";\n\ntest.beforeEach(() => clearSession());');
  if (updated === current) throw new ValidationError("Patch blocked: expected import location was not found.");
  await writeFile(safeTarget, updated, "utf8");
  return { ...patch, status: "applied", appliedContent: updated };
}

export async function revertDemoPatch(patch: ProposedPatch): Promise<ProposedPatch> {
  if (patch.status !== "applied" || patch.targetPath !== "test/session-flow.test.js") throw new ValidationError("Only the approved demo patch can be reverted.");
  await writeFile(safeTarget, patch.originalContent, "utf8");
  return { ...patch, status: "reverted" };
}

export function verifyRun(investigationId: string, run: TestRun, notes: string): VerificationResult {
  return { id: `verify_${crypto.randomUUID().slice(0, 8)}`, investigationId, runId: run.id, result: run.status === "passed" ? "verified" : run.status === "failed" ? "not_verified" : "unknown", notes };
}
