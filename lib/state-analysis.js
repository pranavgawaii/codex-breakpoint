import path from "node:path";

/** @typedef {import("./models.js").StateFinding} StateFinding */

/** Findings are capped so pathological repositories still finish. */
const MAX_FINDINGS = 60;

const MUTATION_METHODS = Array.from(new Set(["push", "pop", "shift", "unshift", "splice", "set", "delete", "clear", "add", "assign", "fill", "sort", "reverse"]));
const RESET_HINT = /^(clear|reset|restore|teardown|destroy|dispose|cleanup|deinit)/i;

/**
 * Replaces comments (and, unless keepStrings, the contents of string literals)
 * with spaces while preserving line count, so regex scanning is reliable AND
 * reported line numbers still match the original file.
 *
 * Double quote delimiters are always blanked, even with keepStrings; single
 * quotes inside scanned code are uncommon for these statements. When
 * keepStrings is true the string body itself is preserved so import
 * specifiers stay readable.
 *
 * @param {string} text
 * @param {boolean} [keepStrings]
 * @returns {string}
 */
export function stripNoise(text, keepStrings = false) {
  /** @type {string[]} */
  const out = [];
  /** @type {"code" | "line" | "block" | "single" | "double" | "template"} */
  let mode = "code";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\n") {
      out.push("\n");
      if (mode === "line") mode = "code";
      if (mode === "template") out.push("\n");
      continue;
    }
    switch (mode) {
      case "line":
        out.push(" ");
        break;
      case "block":
        if (char === "*" && next === "/") { out.push("  "); index += 1; mode = "code"; }
        else out.push(" ");
        break;
      case "single":
        if (char === "\\") { out.push("  "); index += 1; }
        else if (char === "'") { out.push(keepStrings ? "'" : " "); mode = "code"; }
        else out.push(keepStrings ? char : " ");
        break;
      case "double":
        if (char === "\\") { out.push("  "); index += 1; }
        else if (char === '"') { out.push('"'); mode = "code"; }
        else out.push(keepStrings ? char : " ");
        break;
      case "template":
        if (char === "\\") { out.push(keepStrings ? "\\" : "  "); index += 1; }
        else if (char === "`") { out.push(keepStrings ? "`" : " "); mode = "code"; }
        else out.push(keepStrings ? char : " ");
        break;
      default:
        if (char === "/" && next === "/") { out.push("  "); index += 1; mode = "line"; break; }
        if (char === "/" && next === "*") { out.push("  "); index += 1; mode = "block"; break; }
        if (char === "'") { out.push(keepStrings ? "'" : " "); mode = "single"; break; }
        if (char === '"') { out.push('"'); mode = "double"; break; }
        if (char === "`") { out.push(keepStrings ? "`" : " "); mode = "template"; break; }
        out.push(char);
    }
  }
  return out.join("");
}

/**
 * @typedef {object} ModuleStateFact
 * @property {string} rel
 * @property {Array<{ name: string, kind: string, initializer: string, line: number, exported: boolean }>} mutableVars
 * @property {Array<{ name: string, exported: boolean, line: number, mutates: string[] }>} functions
 * @property {Array<{ name: string, line: number, resetVars: string[] }>} resetCandidates
 */

/**
 * Scans one source file for module-level mutable state and the functions that
 * mutate it. Scope boundaries come from brace depth computed on
 * noise-stripped text. Known approximations: class bodies and getters/setters
 * are not traced, and AST-precision is not attempted — findings therefore
 * stay factual ("this text mutates that name") rather than speculative.
 *
 * @param {string} rel
 * @param {string} raw
 * @returns {ModuleStateFact}
 */
export function scanModuleState(rel, raw) {
  const cleaned = stripNoise(raw);
  const lines = cleaned.split("\n");
  const rawLines = raw.split("\n");

  /** @type {ModuleStateFact["mutableVars"]} */
  const mutableVars = [];
  /** @type {ModuleStateFact["functions"]} */
  const functions = [];
  /** @type {ModuleStateFact["resetCandidates"]} */
  const resetCandidates = [];

  let depth = 0;
  /** @type {string | null} */
  let currentFunction = null;
  let currentFunctionExported = false;
  let functionEntryLine = 0;
  /** @type {Set<string>} */
  const mutatingInCurrent = new Set();
  /** @param {number} endLine */
  function flushFunction(endLine) {
    if (currentFunction && mutatingInCurrent.size > 0) {
      functions.push({ name: currentFunction, exported: currentFunctionExported, line: functionEntryLine, mutates: [...mutatingInCurrent] });
    }
    void endLine;
    currentFunction = null;
    currentFunctionExported = false;
    mutatingInCurrent.clear();
  }

  /** Names found via module function/arrow function declarations. */
  function namedFunctionOn(lineText) {
    const classic = lineText.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/);
    if (classic) return { name: classic[1], opensBody: /\{\s*$/.test(lineText) || /=>\s*\{/.test(lineText) };
    const arrow = lineText.match(/^(?:export\s+)?(?:let|var|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)\s*|[A-Za-z_$][\w$]*\s*)=>\s*\{/);
    if (arrow) return { name: arrow[1], opensBody: true };
    return null;
  }

  /** Detects mutations of any current mutable module var on a code line. */
  function trackMutations(codeLine) {
    for (const variable of mutableVars) {
      const rename = new RegExp(`(?:^|[^\\w$.])${variable.name}\\s*=\\s*(?!=)`);
      const plusMinus = new RegExp(`(?:^|[^\\w$.])${variable.name}\\s*(?:\\+=|-=)`);
      const method = new RegExp(`(?:^|[^\\w$.])${variable.name}\\s*\\.\\s*(${MUTATION_METHODS.join("|")})\\s*\\(`);
      const propAssign = new RegExp(`(?:^|[^\\w$.])${variable.name}\\s*\\.\\s*[\\w$]+\\s*=\\s*(?!=)`);
      if (rename.test(codeLine) || plusMinus.test(codeLine) || method.test(codeLine) || propAssign.test(codeLine)) {
        mutatingInCurrent.add(variable.name);
      }
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const previousDepth = depth;
    for (const char of line) {
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
    }
    const bizarreExit = depth <= 0 && previousDepth > 0;

    if (depth <= 0) {
      // Module scope: declarations and function entries live here.
      flushFunction(index + 1);
      const named = namedFunctionOn(line);
      if (named) {
        currentFunction = named.name;
        currentFunctionExported = /^(\s*export\b|\s*module\.exports\b)/.test(rawLines[index] ?? "");
        functionEntryLine = index + 1;
        // A single-line body ({ activeUser = null; }) closes before we ever
        // reach the depth > 0 branch, so scan its tail for mutations here.
        const bodyPortion = line.slice(line.indexOf("{") + 1);
        if (bodyPortion) trackMutations(bodyPortion);
      } else {
        const declaration = line.match(/^(?:export\s+)?(?:default\s+)?(?:let|var|const)\s+([A-Za-z_$][\w$]*)/);
        if (declaration && !line.includes("=>")) {
          const name = declaration[1];
          const rawLine = rawLines[index] ?? "";
          const initializerMatch = rawLine.match(/=\s*(.+?)\s*;?\s*$/);
          const initializer = initializerMatch ? initializerMatch[1] : "";
          const isContainer = /^[{[]|\bnew\s+(Map|Set|WeakMap|WeakSet)\b/.test(initializer) || /\bObject\.create\b/.test(initializer);
          if (declarableIsMutable(rawLine, isContainer)) {
            mutableVars.push({ name, kind: isContainer ? "container" : /\b(let|var)\b/.test(line) ? "let" : "const", initializer: initializer.slice(0, 60), exported: /^(\s*export\b|\s*module\.exports\b)/.test(rawLine), line: index + 1 });
          }
        }
      }
      if (bizarreExit) flushFunction(index + 1);
      continue;
    }

    // Inside a function body: track which known state names get mutated,
    // including on the same line a function opens its body.
    if (currentFunction) trackMutations(line);
    if (bizarreExit) flushFunction(index + 1);
  }
  flushFunction(lines.length);

  for (const func of functions) {
    if (!RESET_HINT.test(func.name)) continue;
    const matched = func.mutates.filter((name) => mutableVars.some((variable) => variable.name === name));
    if (matched.length > 0) {
      resetCandidates.push({ name: func.name, line: func.line, resetVars: matched });
    }
  }

  return { rel, mutableVars, functions, resetCandidates };
}

/**
 * @param {string} rawLine
 * @param {boolean} isContainer
 * @returns {boolean}
 */
function declarableIsMutable(rawLine, isContainer) {
  if (isContainer) return true; // const containers are mutated through their methods
  return /\b(let|var)\b/.test(rawLine); // reassigned primitives
}

/**
 * Parses ordered test names from a test file's raw text.
 *
 * @param {string} raw
 * @returns {string[]}
 */
export function orderedTestNames(raw) {
  /** @type {string[]} */
  const names = [];
  const pattern = /\b(?:test|it)\s*\(\s*(["'`])((?:[^\\]|\\.){1,160}?)\1/g;
  let match;
  while ((match = pattern.exec(raw)) !== null) {
    names.push(match[2].replace(/\\(["'`\\])/g, "$1").trim());
  }
  return names;
}

/**
 * @typedef {object} ImportAudit
 * @property {string} file
 * @property {string} specifier
 * @property {string | null} resolved
 * @property {string} defaultName
 * @property {string[]} named
 */

/**
 * Reads import statements from a test file's raw text (comments are stripped;
 * string bodies are kept so specifiers survive).
 *
 * @param {string} file
 * @param {string} raw
 * @param {(specifier: string, fromDir: string) => string | null} resolver
 * @returns {ImportAudit[]}
 */
export function auditImports(file, raw, resolver) {
  const commentFree = stripNoise(raw, true);
  const fromDir = path.posix.dirname(file);
  /** @type {ImportAudit[]} */
  const audits = [];
  const pattern = /^\s*import\s+(?:([A-Za-z_$][\w$]*)\s*,\s*)?(?:\{([^}]*)\}\s*(?:,\s*([A-Za-z_$][\w$]*)\s*)?;?)?from\s*["']([^"']+)["']/gm;
  let match;
  while ((match = pattern.exec(commentFree)) !== null) {
    const [, defaultName, namedBlock, namedDefault, specifier] = match;
    audits.push({
      file,
      specifier,
      resolved: resolver(specifier, fromDir),
      defaultName: defaultName ?? namedDefault ?? "",
      named: (namedBlock ?? "")
        .split(",")
        .map((part) => part.trim().split(/\s+as\s+/)[0])
        .filter((part) => /^[A-Za-z_$][\w$]*$/.test(part)),
    });
    if (audits.length >= 64) break;
  }
  return audits;
}

/**
 * Builds a resolver that maps relative ESM specifiers onto files discovered
 * for the project. Bare package specifiers are explicitly not project files.
 *
 * @param {Set<string>} relFiles
 * @returns {(specifier: string, fromDir: string) => string | null}
 */
export function makeResolver(relFiles) {
  return (specifier, fromDir) => {
    if (!specifier.startsWith(".") && !specifier.startsWith("/")) return null;
    const combined = path.posix.normalize(path.posix.join(fromDir, specifier));
    if (relFiles.has(combined)) return combined;
    for (const extension of ["js", "mjs", "cjs", "jsx", "ts", "tsx"]) {
      if (relFiles.has(`${combined}.${extension}`)) return `${combined}.${extension}`;
    }
    for (const extension of ["js", "mjs", "cjs", "jsx", "ts", "tsx"]) {
      const withIndex = path.posix.normalize(path.posix.join(combined, `index.${extension}`));
      if (relFiles.has(withIndex)) return withIndex;
    }
    return null;
  };
}

/**
 * Scans the whole project and wires per-file suspicion scores.
 *
 * @param {object} options
 * @param {Record<string, string>} fileTexts rel -> raw file content (sources and tests)
 * @param {string[]} testFiles
 * @param {string[]} sourceFiles
 * @returns {{ facts: Record<string, ModuleStateFact>, importsByTest: Record<string, ImportAudit[]>, findings: StateFinding[], scores: Record<string, number> }}
 */
export function analyzeProject(options) {
  const { fileTexts, testFiles, sourceFiles } = options;

  /** @type {Record<string, ModuleStateFact>} */
  const facts = {};
  for (const rel of sourceFiles) {
    facts[rel] = scanModuleState(rel, fileTexts[rel] ?? "");
  }

  const resolver = makeResolver(new Set(Object.keys(fileTexts)));
  /** @type {Record<string, ImportAudit[]>} */
  const importsByTest = {};
  for (const rel of testFiles) {
    importsByTest[rel] = auditImports(rel, fileTexts[rel] ?? "", resolver);
  }

  /** @type {StateFinding[]} */
  const findings = [];
  let idCounter = 0;
  function pushFinding(kind, file, line, snippet, statement, certainty) {
    if (findings.length >= MAX_FINDINGS) return;
    findings.push({ id: `st_f${idCounter++}`, kind, file, line, snippet: snippet.slice(0, 160), statement, certainty });
  }

  /** Which test files import each stateful module? */
  const importersOf = /** @type {Record<string, string[]>} */ ({});
  for (const test of testFiles) {
    for (const audit of importsByTest[test] ?? []) {
      if (!audit.resolved) continue;
      importersOf[audit.resolved] = [...(importersOf[audit.resolved] ?? []), test];
    }
  }

  for (const fact of Object.values(facts).filter((item) => item.mutableVars.length > 0)) {
    const importers = importersOf[fact.rel] ?? [];
    for (const variable of fact.mutableVars) {
      pushFinding(
        "module-state",
        fact.rel,
        variable.line,
        (fileTexts[fact.rel] ?? "").split("\n")[variable.line - 1]?.trim() ?? "",
        `Module-level ${variable.kind} variable \`${variable.name}\` in ${fact.rel} survives test processes; it is initialized to \`${variable.initializer || "(uninitialized)"}\`.`,
        "observed"
      );
    }
    for (const func of fact.functions) {
      const mutatingState = func.mutates.filter((name) => fact.mutableVars.some((variable) => variable.name === name));
      if (mutatingState.length === 0) continue;
      if (func.exported) {
        pushFinding(
          "exported-mutator",
          fact.rel,
          func.line,
          `export ${func.name}()`,
          `Exported function \`${func.name}\` mutates module state: ${mutatingState.map((name) => `\`${name}\``).join(", ")}.`,
          "observed"
        );
      } else {
        pushFinding(
          "internal-mutator",
          fact.rel,
          func.line,
          `function ${func.name}()`,
          `Internal function \`${func.name}\` mutates module state: ${mutatingState.map((name) => `\`${name}\``).join(", ")}.`,
          "observed"
        );
      }
    }
    for (const test of importers) {
      const rawTest = fileTexts[test] ?? "";
      const hookUsage = /(test\.(?:beforeEach|afterEach|before|after)\s*\(|it\.(?:beforeEach|afterEach|before|after)\s*\()/.test(rawTest);
      const namedInTest = (importsByTest[test] ?? []).filter((audit) => audit.resolved === fact.rel).flatMap((audit) => audit.named);
      const resetReferenced = fact.resetCandidates.some((candidate) => namedInTest.includes(candidate.name));
      if (!hookUsage) {
        pushFinding(
          "no-hooks",
          test,
          1,
          "",
          `${test} imports state from ${fact.rel} but declares no beforeEach/afterEach hooks; nothing resets \`${fact.mutableVars.map((variable) => variable.name).join(", ")}\` between tests.`,
          "observed"
        );
      } else if (!resetReferenced) {
        pushFinding(
          "hooks-without-reset",
          test,
          1,
          "",
          `${test} declares hooks but never calls a reset function for ${fact.rel} (${fact.resetCandidates.map((candidate) => candidate.name).join(", ") || "none exported"}).`,
          "observed"
        );
      } else {
        pushFinding("reset-note", test, 1, "", `${test} already calls \`${fact.resetCandidates[0].name}\` in a hook.`, "observed");
      }
    }
  }

  /** Suspicion scores per test file. */
  /** @type {Record<string, number>} */
  const scores = {};
  for (const test of testFiles) {
    let score = 0;
    const rawText = fileTexts[test] ?? "";
    const testCount = orderedTestNames(rawText).length;
    const ownStateFacts = (importsByTest[test] ?? [])
      .map((audit) => audit.resolved)
      .filter((resolved) => resolved !== null && facts[resolved]?.mutableVars.length > 0);
    score += ownStateFacts.length * 3 + Math.max(0, testCount - 1);
    if (ownStateFacts.length > 0 && !/(test\.(?:beforeEach|afterEach)|it\.(?:beforeEach|afterEach))/.test(stripNoise(rawText))) score += 3;
    const sharedWith = testFiles.filter((other) => other !== test && (importsByTest[other] ?? []).some((audit) => ownStateFacts.includes(audit.resolved ?? "")));
    score += sharedWith.length;
    scores[test] = score;
  }

  return { facts, importsByTest, findings, scores };
}

/**
 * Chooses the investigation target: the highest-suspicion test file, the last
 * declared test as the failing candidate, and the test declared before it.
 *
 * @param {ReturnType<typeof analyzeProject>} analysis
 * @param {Record<string, string>} fileTexts
 * @param {string[]} fallbackTestFiles
 * @returns {{ testFile: string, targetTest: string | null, predecessorTest: string | null, reasoning: string } | null}
 */
export function chooseTarget(analysis, fileTexts, fallbackTestFiles) {
  const ranked = Object.entries(analysis.scores).sort((a, b) => b[1] - a[1]);
  const testFile = ranked[0]?.[0] ?? fallbackTestFiles[0];
  if (!testFile) return null;

  const names = orderedTestNames(fileTexts[testFile] ?? "");
  if (names.length === 0) {
    return { testFile, targetTest: null, predecessorTest: null, reasoning: `No named tests were parsed in ${testFile}; the whole file becomes the run target.` };
  }
  const targetTest = names.length > 1 ? names[names.length - 1] : names[0];
  const predecessorTest = names.length > 1 ? names[names.length - 2] : null;
  const reasoning = names.length > 1
    ? `Ranked ${testFile} highest for shared-state suspicion; the last declared test is the target, with its predecessor kept separate for isolation runs.`
    : `Ranked ${testFile} highest for shared-state suspicion; it declares a single named test.`;
  return { testFile, targetTest, predecessorTest, reasoning };
}
