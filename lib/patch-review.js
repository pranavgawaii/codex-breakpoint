import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ConflictError, ValidationError } from "./errors.js";

/** @typedef {import("./models.js").ProposedPatch} ProposedPatch */
/** @typedef {import("./models.js").TestRun} TestRun */
/** @typedef {import("./models.js").VerificationResult} VerificationResult */
/** @typedef {import("./models.js").Project} Project */

/** Files larger than this are not patched; the edit preview would be unwieldy. */
const MAX_PATCH_FILE_BYTES = 256 * 1024;

/** Cap for the LCS diff table; larger inputs fall back to a suppressed summary. */
const MAX_DIFF_LINES = 600;

/**
 * Computes a line-level unified diff via LCS dynamic programming. Inputs are
 * capped; beyond the cap the diff degrades to a suppressed summary, which
 * stays honest even if unhelpful. The diff is display-only — apply/revert
 * always reconstruct files from stored full contents and baselines.
 *
 * @param {string} before
 * @param {string} after
 * @param {string} targetPath Project-relative path.
 * @returns {string}
 */
export function makeUnifiedDiff(before, after, targetPath) {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  if (oldLines.length > MAX_DIFF_LINES || newLines.length > MAX_DIFF_LINES) {
    return `--- a/${targetPath}\n+++ b/${targetPath}\n@@ (file exceeds ${MAX_DIFF_LINES} lines; content suppressed) @@`;
  }

  const rows = oldLines.length;
  const columns = newLines.length;
  /** @type {Uint32Array} */
  const lcs = new Uint32Array((rows + 1) * (columns + 1));
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = columns - 1; j >= 0; j -= 1) {
      lcs[i * (columns + 1) + j] = oldLines[i] === newLines[j]
        ? lcs[(i + 1) * (columns + 1) + j + 1] + 1
        : Math.max(lcs[(i + 1) * (columns + 1) + j], lcs[i * (columns + 1) + j + 1]);
    }
  }

  /** @type {Array<{ kind: "same" | "del" | "add", text: string }>} */
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < columns) {
    if (oldLines[i] === newLines[j]) { ops.push({ kind: "same", text: oldLines[i] }); i += 1; j += 1; }
    else if (lcs[(i + 1) * (columns + 1) + j] >= lcs[i * (columns + 1) + j + 1]) { ops.push({ kind: "del", text: oldLines[i] }); i += 1; }
    else { ops.push({ kind: "add", text: newLines[j] }); j += 1; }
  }
  while (i < rows) { ops.push({ kind: "del", text: oldLines[i] }); i += 1; }
  while (j < columns) { ops.push({ kind: "add", text: newLines[j] }); j += 1; }

  // Annotate ops with effective old/new line numbers.
  let oldLine = 1;
  let newLine = 1;
  /** @type {Array<{ kind: string, text: string, oldLine: number, newLine: number }>} */
  const annotated = [];
  for (const op of ops) {
    annotated.push({ ...op, oldLine, newLine });
    if (op.kind !== "add") oldLine += 1;
    if (op.kind !== "del") newLine += 1;
  }

  // Keep changed ops plus up to 3 lines of context on each side. Kept windows
  // of nearby changes overlap, so contiguous kept runs form merged hunks.
  const keep = /** @type {boolean[]} */ (new Array(annotated.length).fill(false));
  for (let index = 0; index < annotated.length; index += 1) {
    if (annotated[index].kind === "same") continue;
    for (let w = Math.max(0, index - 3); w <= Math.min(annotated.length - 1, index + 3); w += 1) keep[w] = true;
  }

  /** @type {string[]} */
  const emitted = [];
  let index = 0;
  while (index < annotated.length) {
    if (!keep[index]) { index += 1; continue; }
    let end = index;
    while (end + 1 < annotated.length && keep[end + 1]) end += 1;
    const hOld = annotated[index].oldLine;
    const hNew = annotated[index].newLine;
    let countOld = 0;
    let countNew = 0;
    const body = [];
    for (let k = index; k <= end; k += 1) {
      const op = annotated[k];
      if (op.kind === "same") { body.push(` ${op.text}`); countOld += 1; countNew += 1; }
      else if (op.kind === "del") { body.push(`-${op.text}`); countOld += 1; }
      else { body.push(`+${op.text}`); countNew += 1; }
    }
    emitted.push(`@@ -${hOld},${countOld} +${hNew},${countNew} @@`, ...body);
    index = end + 1;
  }

  return [`--- a/${targetPath}`, `+++ b/${targetPath}`, ...emitted].join("\n");
}

/**
 * @param {string} content
 * @returns {string}
 */
function contentHash(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Resolves a project-relative target path and refuses escapes from the root.
 *
 * @param {string} root Absolute project root.
 * @param {string} relativePath
 * @returns {string}
 */
function resolveInsideProject(root, relativePath) {
  const absolute = path.resolve(root, relativePath);
  const relative = path.relative(root, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative) || relative === "") {
    throw new ValidationError("Patch target escapes the project root.");
  }
  return absolute;
}

/**
 * Finds the index just past the final import statement in a test file.
 *
 * @param {string[]} lines
 * @returns {number}
 */
function lastImportLineIndex(lines) {
  let last = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s*import\b/.test(lines[index])) last = index;
  }
  return last;
}

/** Detects the local test/hook naming style of a test file. */
function hookApiFor(raw) {
  if (/from\s+["']node:test["']/.test(raw)) {
    const defaultImport = raw.match(/import\s+([A-Za-z_$][\w$]*)\s+from\s+["']node:test["']/)?.[1] ?? "test";
    return { hook: `${defaultImport}.beforeEach` };
  }
  if (/from\s+["']vitest["']/.test(raw)) {
    const named = raw.match(/import\s*\{([^}]*)\}\s*from\s+["']vitest["']/)?.[1] ?? "";
    return { hook: /\bbeforeEach\b/.test(named) ? "beforeEach" : null };
  }
  return { hook: "beforeEach" }; // jest/global test style
}

/**
 * Drafts a cleanup patch from recorded static analysis. Preference order:
 *  1. The target test file gains a beforeEach hook calling an exported reset
 *     function of an imported stateful module (one edit).
 *  2. If no reset is exported, the stateful module gains an exported reset
 *     function (only for provably resettable state) AND the test file wires
 *     it into a hook (two edits).
 *  3. Otherwise no patch is drafted — the engine refuses to guess.
 *
 * @param {object} options
 * @param {string} options.investigationId
 * @param {Project} options.project
 * @param {ReturnType<import("./state-analysis.js").analyzeProject>} options.analysis
 * @param {Record<string, string>} options.fileTexts
 * @param {{ testFile: string, targetTest: string | null, predecessorTest: string | null }} options.shape
 * @returns {Promise<ProposedPatch | null>}
 */
export async function draftCleanupPatch(options) {
  const { investigationId, analysis, fileTexts, shape } = options;
  const testRaw = fileTexts[shape.testFile] ?? "";
  if (!testRaw) throw new ValidationError("The target test file could not be read for patch drafting.");
  if (testRaw.length > MAX_PATCH_FILE_BYTES) throw new ValidationError("The target test file is too large to patch safely.");

  const hookApi = hookApiFor(testRaw);
  if (!hookApi.hook) return null;

  const importedStateModules = (analysis.importsByTest[shape.testFile] ?? [])
    .map((audit) => audit.resolved)
    .filter((resolved) => resolved !== null && analysis.facts[resolved]?.mutableVars.length > 0);

  // Case 1: an exported reset already exists on an imported stateful module.
  for (const modulePath of importedStateModules) {
    const fact = analysis.facts[modulePath];
    const reset = fact.resetCandidates[0];
    if (!reset) continue;
    const edit = wireResetIntoTestFile(testRaw, modulePath, reset.name, shape.testFile, hookApi);
    if (!edit) continue;
    return {
      id: `patch_${crypto.randomUUID().slice(0, 8)}`,
      investigationId,
      description: `Call \`${reset.name}()\` from ${modulePath} in a beforeEach hook so \`${reset.resetVars.join(", ")}\` starts clean for every test in ${shape.testFile}.`,
      diff: makeUnifiedDiff(testRaw, edit.appliedContent, shape.testFile),
      status: "draft",
      baseline: `sha256-${contentHash(edit.originalContent)}`,
      targetPath: shape.testFile,
      edits: [edit],
    };
  }

  // Case 2: synthesize an exported reset in the stateful module, then wire it
  // into the test file. Both edits are recorded with their exact contents.
  for (const modulePath of importedStateModules) {
    const fact = analysis.facts[modulePath];
    const raw = fileTexts[modulePath] ?? "";
    if (!raw || raw.length > MAX_PATCH_FILE_BYTES) continue;
    const resetStatements = provableResetStatements(fact);
    if (!resetStatements) continue;

    const resetName = "breakpointResetState";
    const moduleLines = raw.split("\n");
    moduleLines.push("", "/** Added by Breakpoint: resets module-level state between tests. */", `export function ${resetName}() {`, `  ${resetStatements.join(" ")}`, `}`);
    const moduleEdited = moduleLines.join("\n");

    const testEdit = wireResetIntoTestFile(testRaw, modulePath, resetName, shape.testFile, hookApi);
    if (!testEdit) continue;

    return {
      id: `patch_${crypto.randomUUID().slice(0, 8)}`,
      investigationId,
      description: `Add \`${resetName}()\` to ${modulePath} and call it from a beforeEach hook in ${shape.testFile}, so every test starts from the modules' declared initial state.`,
      diff: `${makeUnifiedDiff(raw, moduleEdited, modulePath)}\n\n${makeUnifiedDiff(testEdit.originalContent, testEdit.appliedContent, shape.testFile)}`,
      status: "draft",
      baseline: `sha256-${contentHash(raw)}+${contentHash(testEdit.originalContent)}`,
      targetPath: modulePath,
      edits: [
        { targetPath: modulePath, originalContent: raw, appliedContent: moduleEdited },
        testEdit,
      ],
    };
  }

  return null;
}

/**
 * Builds the edited test-file content that imports and calls a reset function
 * in a beforeEach hook. Returns null when the import line cannot be extended
 * safely.
 *
 * @param {string} testRaw
 * @param {string} modulePath
 * @param {string} resetName
 * @param {string} testFileRel
 * @param {{ hook: string | null }} hookApi
 * @returns {{ targetPath: string, originalContent: string, appliedContent: string } | null}
 */
function wireResetIntoTestFile(testRaw, modulePath, resetName, testFileRel, hookApi) {
  if (!hookApi.hook) return null;
  const lines = testRaw.split("\n");
  const importLineIndex = lines.findIndex((line) => /^\s*import\b/.test(line) && /from\s*["'][^"']*["']/.test(line) && line.includes(modulePath));
  if (importLineIndex < 0) return null;
  const importLine = lines[importLineIndex];
  const alreadyImports = importLine.includes(resetName);
  if (!alreadyImports && !/\{/.test(importLine)) return null; // unusual import syntax: refuse
  if (!alreadyImports) {
    lines[importLineIndex] = importLine.replace(/\{([^}]*)\}/, (_all, inside) => `{ ${[...inside.split(",").map((part) => part.trim()).filter(Boolean), resetName].sort().join(", ")} }`);
  }
  const lastImport = lastImportLineIndex(lines);
  lines.splice(lastImport + 1, 0, "", `${hookApi.hook}(() => { ${resetName}(); });`);
  return { targetPath: testFileRel, originalContent: testRaw, appliedContent: lines.join("\n") };
}

/**
 * Returns statements that reset every discovered mutable var, or null when
 * any variable cannot be reset provably (opaque initializers, class instances).
 *
 * @param {import("./state-analysis.js").ModuleStateFact} fact
 * @returns {string[] | null}
 */
function provableResetStatements(fact) {
  /** @type {string[]} */
  const statements = [];
  for (const variable of fact.mutableVars) {
    const initializer = variable.initializer.trim();
    if (variable.kind === "container") {
      if (initializer.startsWith("{")) statements.push(`for (const key of Object.keys(${variable.name})) delete ${variable.name}[key];`);
      else if (initializer.startsWith("[")) statements.push(`${variable.name}.length = 0;`);
      else if (/new\s+(Map|Set|WeakMap|WeakSet)\b/.test(initializer)) statements.push(`${variable.name}.clear();`);
      else return null; // opaque container: refuse
    } else if (/^(null|undefined|true|false|\d|["'`]|\/)(\s|$)/.test(initializer) || initializer === "") {
      statements.push(`${variable.name} = ${initializer || "null"};`);
    } else if (/new\s+(Map|Set)\b/.test(initializer)) {
      statements.push(`${variable.name} = ${initializer};`);
    } else {
      return null; // opaque call initializer: refuse
    }
  }
  return statements.length > 0 ? statements : null;
}

/**
 * Applies a draft patch only when every on-disk target still matches its
 * recorded baseline byte-for-byte. All-or-nothing: any mismatch aborts
 * without writing anything.
 *
 * @param {ProposedPatch} patch
 * @param {Project} project
 * @returns {Promise<ProposedPatch>}
 */
export async function applyPatch(patch, project) {
  if (patch.status !== "draft") throw new ValidationError("Only a draft patch can be applied.");
  if (!patch.edits?.length) throw new ValidationError("This patch has no recorded apply content; redraft it.");
  const resolved = patch.edits.map((edit) => ({ edit, absolute: resolveInsideProject(project.root, edit.targetPath) }));
  for (const { edit, absolute } of resolved) {
    const current = await readFile(absolute, "utf8");
    if (current !== edit.originalContent) {
      throw new ConflictError(`Patch blocked: ${edit.targetPath} no longer matches the recorded baseline.`);
    }
  }
  for (const { edit, absolute } of resolved) {
    await writeFile(absolute, edit.appliedContent, "utf8");
  }
  return { ...patch, status: "applied" };
}

/**
 * Reverts an applied patch to its recorded baselines.
 *
 * @param {ProposedPatch} patch
 * @param {Project} project
 * @returns {Promise<ProposedPatch>}
 */
export async function revertPatch(patch, project) {
  if (patch.status !== "applied") throw new ValidationError("Only an applied patch can be reverted.");
  const resolved = patch.edits.map((edit) => ({ edit, absolute: resolveInsideProject(project.root, edit.targetPath) }));
  for (const { edit, absolute } of resolved) {
    const current = await readFile(absolute, "utf8");
    if (current !== edit.appliedContent) {
      throw new ConflictError(`Revert blocked: ${edit.targetPath} differs from the recorded applied content.`);
    }
  }
  for (const { edit, absolute } of resolved) {
    await writeFile(absolute, edit.originalContent, "utf8");
  }
  return { ...patch, status: "reverted" };
}

/**
 * @param {string} investigationId
 * @param {TestRun} run
 * @param {string} notes
 * @returns {VerificationResult}
 */
export function verifyRun(investigationId, run, notes) {
  return {
    id: `verify_${crypto.randomUUID().slice(0, 8)}`,
    investigationId,
    runId: run.id,
    result: run.status === "passed" ? "verified" : run.status === "failed" ? "not_verified" : "unknown",
    notes,
  };
}
