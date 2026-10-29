"""Static shared-state analysis.

Python sources are scanned with the real ``ast`` module — module-level
mutable state, mutating functions and reset candidates are exact. JS/TS
sources use the noise-stripping regex scanner ported from the original
engine; findings stay factual ("this text mutates that name") rather than
speculative.
"""

from __future__ import annotations

import ast
import re
from pathlib import PurePosixPath

MAX_FINDINGS = 60

PY_MUTATION_METHODS = (
    "append", "extend", "insert", "pop", "remove", "clear", "add", "update",
    "discard", "popitem", "setdefault", "sort", "reverse", "move_to_end",
)
RESET_HINT = re.compile(r"^(clear|reset|restore|teardown|destroy|dispose|cleanup|deinit)", re.IGNORECASE)

# --- JS ports (from the original engine) -------------------------------------

JS_MUTATION_METHODS = ["push", "pop", "shift", "unshift", "splice", "set", "delete", "clear", "add", "assign", "fill", "sort", "reverse"]


def strip_noise(text: str, keep_strings: bool = False) -> str:
    """Blank comments (and optionally string bodies) while preserving line count."""
    out: list[str] = []
    mode = "code"
    index = 0
    length = len(text)
    while index < length:
        char = text[index]
        nxt = text[index + 1] if index + 1 < length else ""
        if char == "\n":
            out.append("\n")
            if mode == "line":
                mode = "code"
            index += 1
            continue
        if mode == "line":
            out.append(" ")
        elif mode == "block":
            if char == "*" and nxt == "/":
                out.append("  ")
                index += 1
                mode = "code"
            else:
                out.append(" ")
        elif mode == "single":
            if char == "\\":
                out.append("  ")
                index += 1
            elif char == "'":
                out.append("'" if keep_strings else " ")
                mode = "code"
            else:
                out.append(char if keep_strings else " ")
        elif mode == "double":
            if char == "\\":
                out.append("  ")
                index += 1
            elif char == '"':
                out.append('"' if keep_strings else " ")
                mode = "code"
            else:
                out.append(char if keep_strings else " ")
        elif mode == "template":
            if char == "\\":
                out.append("\\" if keep_strings else "  ")
                index += 1
            elif char == "`":
                out.append("`" if keep_strings else " ")
                mode = "code"
            else:
                out.append(char if keep_strings else " ")
        else:
            if char == "/" and nxt == "/":
                out.append("  ")
                index += 1
                mode = "line"
            elif char == "/" and nxt == "*":
                out.append("  ")
                index += 1
                mode = "block"
            elif char == "'":
                out.append("'" if keep_strings else " ")
                mode = "single"
            elif char == '"':
                out.append("\"" if keep_strings else " ")
                mode = "double"
            elif char == "`":
                out.append("`" if keep_strings else " ")
                mode = "template"
            else:
                out.append(char)
        index += 1
    return "".join(out)


def _js_scan_module_state(rel: str, raw: str) -> dict:
    """Faithful port of the original JS scanner: brace-depth scoped."""
    cleaned = strip_noise(raw)
    lines = cleaned.split("\n")
    raw_lines = raw.split("\n")

    mutable_vars: list[dict] = []
    functions: list[dict] = []
    reset_candidates: list[dict] = []

    depth = 0
    current_function: str | None = None
    current_function_exported = False
    function_entry_line = 0
    mutating_in_current: set[str] = set()

    def flush_function(_end_line: int) -> None:
        nonlocal current_function, current_function_exported, function_entry_line
        if current_function and mutating_in_current:
            functions.append({
                "name": current_function,
                "exported": current_function_exported,
                "line": function_entry_line,
                "mutates": sorted(mutating_in_current),
            })
        current_function = None
        current_function_exported = False
        mutating_in_current.clear()

    def named_function_on(line_text: str) -> dict | None:
        classic = re.match(r"^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)", line_text)
        if classic:
            return {"name": classic.group(1), "opensBody": bool(re.search(r"\{\s*$", line_text) or re.search(r"=>\s*\{", line_text))}
        arrow = re.match(r"^(?:export\s+)?(?:let|var|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)\s*|[A-Za-z_$][\w$]*\s*)=>\s*\{", line_text)
        if arrow:
            return {"name": arrow.group(1), "opensBody": True}
        return None

    def track_mutations(code_line: str) -> None:
        for variable in mutable_vars:
            name = variable["name"]
            rename = re.compile(rf"(?:^|[^\w$.]){name}\s*=\s*(?!=)")
            plus_minus = re.compile(rf"(?:^|[^\w$.]){name}\s*(?:\+=|-=)")
            method = re.compile(rf"(?:^|[^\w$.]){name}\s*\.\s*({'|'.join(JS_MUTATION_METHODS)})\s*\(")
            prop_assign = re.compile(rf"(?:^|[^\w$.]){name}\s*\.\s*[\w$]+\s*=\s*(?!=)")
            if rename.search(code_line) or plus_minus.search(code_line) or method.search(code_line) or prop_assign.search(code_line):
                mutating_in_current.add(name)

    def declarable_is_mutable(raw_line: str, is_container: bool) -> bool:
        if is_container:
            return True
        return bool(re.search(r"\b(let|var)\b", raw_line))

    for index, line in enumerate(lines):
        entering_depth = depth

        if entering_depth <= 0:
            # Top of file or a body just closed above: flush the finished
            # function, then look for declarations on this line.
            flush_function(index + 1)
            named = named_function_on(line)
            if named:
                current_function = named["name"]
                raw_line = raw_lines[index] if index < len(raw_lines) else ""
                current_function_exported = bool(re.match(r"^(\s*export\b|\s*module\.exports\b)", raw_line))
                function_entry_line = index + 1
                body_portion = line[line.index("{") + 1:] if "{" in line else ""
                if body_portion:
                    track_mutations(body_portion)
            else:
                declaration = re.match(r"^(?:export\s+)?(?:default\s+)?(?:let|var|const)\s+([A-Za-z_$][\w$]*)", line)
                if declaration and "=>" not in line:
                    name = declaration.group(1)
                    raw_line = raw_lines[index] if index < len(raw_lines) else ""
                    initializer_match = re.search(r"=\s*(.+?)\s*;?\s*$", raw_line)
                    initializer = initializer_match.group(1) if initializer_match else ""
                    is_container = bool(
                        re.match(r"^[{[]", initializer)
                        or re.search(r"\bnew\s+(Map|Set|WeakMap|WeakSet)\b", initializer)
                        or re.search(r"\bObject\.create\b", initializer)
                    )
                    if declarable_is_mutable(raw_line, is_container):
                        mutable_vars.append({
                            "name": name,
                            "kind": "container" if is_container else ("let" if re.search(r"\b(let|var)\b", line) else "const"),
                            "initializer": initializer[:60],
                            "exported": bool(re.match(r"^(\s*export\b|\s*module\.exports\b)", raw_line)),
                            "line": index + 1,
                        })
        elif current_function:
            track_mutations(line)

        # Count braces AFTER declaration handling so a function's opening
        # brace belongs to its body, not to the module scope.
        for char in line:
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
        if depth <= 0 and entering_depth > 0:
            flush_function(index + 1)  # body closed on this line

    flush_function(len(lines))

    for func in functions:
        if not RESET_HINT.match(func["name"]):
            continue
        matched = [name for name in func["mutates"] if any(variable["name"] == name for variable in mutable_vars)]
        if matched:
            reset_candidates.append({"name": func["name"], "line": func["line"], "resetVars": matched})

    return {"rel": rel, "mutableVars": mutable_vars, "functions": functions, "resetCandidates": reset_candidates}


# --- Python AST scanner -------------------------------------------------------

def _initializer_repr(node: ast.expr) -> str:
    try:
        return ast.unparse(node)
    except Exception:
        return ""


def _py_scan_module_state(rel: str, raw: str) -> dict:
    """Scans a Python source file with the ast module.

    - module-level assignments to simple names (mutable module state)
    - module-level functions that mutate those names (exported = public name)
    - reset candidates: functions whose names hint at reset and mutate state
    """
    try:
        tree = ast.parse(raw)
    except SyntaxError:
        return {"rel": rel, "mutableVars": [], "functions": [], "resetCandidates": []}

    raw_lines = raw.split("\n")
    module_assignments: dict[str, dict] = {}
    functions: list[dict] = []
    reset_candidates: list[dict] = []

    for node in tree.body:
        targets: list[tuple[str, ast.expr]] = []
        if isinstance(node, ast.Assign):
            targets = [(t.id, node.value) for t in node.targets if isinstance(t, ast.Name)]
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and node.value is not None:
            targets = [(node.target.id, node.value)]

        for name, value in targets:
            kind = "container" if isinstance(value, (ast.List, ast.Dict, ast.Set, ast.Call)) else "let"
            module_assignments[name] = {
                "name": name,
                "kind": kind,
                "initializer": _initializer_repr(value)[:60],
                "exported": not name.startswith("_"),
                "line": node.lineno,
            }

        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            mutating: set[str] = set()
            for inner in ast.walk(node):
                if isinstance(inner, ast.Assign):
                    for target in inner.targets:
                        if isinstance(target, ast.Name) and target.id in module_assignments:
                            mutating.add(target.id)
                        elif isinstance(target, ast.Subscript) and isinstance(target.value, ast.Name) and target.value.id in module_assignments:
                            mutating.add(target.value.id)
                        elif isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name) and target.value.id in module_assignments:
                            mutating.add(target.value.id)
                elif isinstance(inner, ast.AugAssign) and isinstance(inner.target, ast.Name) and inner.target.id in module_assignments:
                    mutating.add(inner.target.id)
                elif (
                    isinstance(inner, ast.Call)
                    and isinstance(inner.func, ast.Attribute)
                    and isinstance(inner.func.value, ast.Name)
                    and inner.func.value.id in module_assignments
                    and inner.func.attr in PY_MUTATION_METHODS
                ):
                    mutating.add(inner.func.value.id)
            if mutating:
                functions.append({
                    "name": node.name,
                    "exported": not node.name.startswith("_"),
                    "line": node.lineno,
                    "mutates": sorted(mutating),
                })

    for func in functions:
        if not RESET_HINT.match(func["name"]):
            continue
        matched = [name for name in func["mutates"] if name in module_assignments]
        if matched:
            reset_candidates.append({"name": func["name"], "line": func["line"], "resetVars": matched})

    return {
        "rel": rel,
        "mutableVars": list(module_assignments.values()),
        "functions": functions,
        "resetCandidates": reset_candidates,
    }


def scan_module_state(rel: str, raw: str) -> dict:
    """Dispatches on file extension: ast for Python, ported scanner for JS."""
    if rel.endswith(".py"):
        return _py_scan_module_state(rel, raw)
    return _js_scan_module_state(rel, raw)


def ordered_test_names(raw: str, is_python: bool | None = None) -> list[str]:
    """Parses declared test names in source order.

    Python: ``def test_*`` definitions. JS: ``test("...")`` / ``it('...')``.
    """
    if is_python is None:
        is_python = "def test_" in raw or "def _test_" in raw
    if is_python:
        names = []
        for match in re.finditer(r"^\s*(?:async\s+)?def\s+(test_[A-Za-z0-9_]*)", raw, re.MULTILINE):
            names.append(match.group(1))
        return names
    names = []
    pattern = re.compile(r"""\b(?:test|it)\s*\(\s*(["'`])((?:[^\\]|\\.){1,160}?)\1""")
    for match in pattern.finditer(raw):
        name = re.sub(r"\\([\"'`\\])", r"\1", match.group(2)).strip()
        names.append(name)
    return names


# --- imports audit ------------------------------------------------------------

def audit_imports(file: str, raw: str, resolver) -> list[dict]:
    """Reads import statements (Python ast or JS regex) with resolution.

    ``resolver`` is the namespace built by :func:`make_resolver`; Python files
    use ``resolver.py``, JS files use ``resolver.js``.
    """
    audits: list[dict] = []
    if file.endswith(".py"):
        try:
            tree = ast.parse(raw)
        except SyntaxError:
            return audits
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                module = node.module or ""
                resolved = resolver.py(module, PurePosixPath(file).parent.as_posix(), node.level)
                names = [alias.name for alias in node.names if alias.name != "*"]
                audits.append({
                    "file": file,
                    "specifier": ("." * node.level) + module,
                    "resolved": resolved,
                    "defaultName": "",
                    "named": names,
                })
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    resolved = resolver.py(alias.name, PurePosixPath(file).parent.as_posix(), 0)
                    audits.append({
                        "file": file,
                        "specifier": alias.name,
                        "resolved": resolved,
                        "defaultName": alias.asname or alias.name.split(".")[0],
                        "named": [],
                    })
            if len(audits) >= 64:
                break
        return audits

    comment_free = strip_noise(raw, True)
    pattern = re.compile(
        r"""^\s*import\s+(?:([A-Za-z_$][\w$]*)\s*,\s*)?(?:\{([^}]*)\}\s*(?:,\s*([A-Za-z_$][\w$]*)\s*)?;?)?from\s*["']([^"']+)["']""",
        re.MULTILINE,
    )
    for match in pattern.finditer(comment_free):
        default_name, named_block, named_default, specifier = match.groups()
        from_dir = PurePosixPath(file).parent.as_posix()
        audits.append({
            "file": file,
            "specifier": specifier,
            "resolved": resolver.js(specifier, from_dir),
            "defaultName": default_name or named_default or "",
            "named": [
                part.strip().split(" as ")[0]
                for part in (named_block or "").split(",")
                if re.fullmatch(r"[A-Za-z_$][\w$]*", part.strip().split(" as ")[0])
            ],
        })
        if len(audits) >= 64:
            break
    return audits


def make_resolver(rel_files: set[str]):
    """Builds resolvers mapping import specifiers onto discovered files.

    Returns a namespace with ``js`` and ``py`` resolvers; callers choose by
    source-file language, never by specifier shape (a JS relative import also
    starts with a dot).
    """

    class Resolver:
        @staticmethod
        def js(specifier: str, from_dir: str) -> str | None:
            if not specifier.startswith(".") and not specifier.startswith("/"):
                return None
            combined = str(PurePosixPath(from_dir, specifier)) if from_dir else PurePosixPath(specifier).as_posix()
            parts: list[str] = []
            for segment in PurePosixPath(combined).parts:
                if segment == "..":
                    if parts:
                        parts.pop()
                elif segment != ".":
                    parts.append(segment)
            combined = "/".join(parts)
            if combined in rel_files:
                return combined
            for extension in ("js", "mjs", "cjs", "jsx", "ts", "tsx"):
                if f"{combined}.{extension}" in rel_files:
                    return f"{combined}.{extension}"
            for extension in ("js", "mjs", "cjs", "jsx", "ts", "tsx"):
                with_index = f"{combined}/index.{extension}"
                if with_index in rel_files:
                    return with_index
            return None

        @staticmethod
        def py(module: str, from_dir: str, level: int) -> str | None:
            def probe(base_parts: tuple[str, ...]) -> str | None:
                if module:
                    target = "/".join((*base_parts, *PurePosixPath(module).parts))
                else:
                    target = "/".join(base_parts)
                if f"{target}.py" in rel_files:
                    return f"{target}.py"
                if f"{target}/__init__.py" in rel_files:
                    return f"{target}/__init__.py"
                return None

            if level:
                base_parts = PurePosixPath(from_dir).parts
                for _ in range(max(0, level - 1)):
                    base_parts = base_parts[:-1] if base_parts else base_parts
                return probe(base_parts)
            # Absolute import: resolve from the project root first, then the
            # importing file's directory (script-style repositories).
            return probe(()) or probe(PurePosixPath(from_dir).parts)

    return Resolver()


# --- whole-project analysis ---------------------------------------------------

def analyze_project(file_texts: dict[str, str], test_files: list[str], source_files: list[str]) -> dict:
    """Scans the whole project and wires per-file suspicion scores."""
    facts: dict[str, dict] = {}
    for rel in source_files:
        facts[rel] = scan_module_state(rel, file_texts.get(rel, ""))

    resolver = make_resolver(set(file_texts.keys()))
    imports_by_test: dict[str, list[dict]] = {}
    for rel in test_files:
        imports_by_test[rel] = audit_imports(rel, file_texts.get(rel, ""), resolver)

    findings: list[dict] = []
    id_counter = 0

    def push_finding(kind: str, file: str, line: int, snippet: str, statement: str, certainty: str) -> None:
        nonlocal id_counter
        if len(findings) >= MAX_FINDINGS:
            return
        findings.append({
            "id": f"st_f{id_counter}",
            "kind": kind,
            "file": file,
            "line": line,
            "snippet": snippet[:160],
            "statement": statement,
            "certainty": certainty,
        })
        id_counter += 1

    importers_of: dict[str, list[str]] = {}
    for test in test_files:
        for audit in imports_by_test.get(test, []):
            if audit["resolved"]:
                importers_of.setdefault(audit["resolved"], []).append(test)

    for fact in [item for item in facts.values() if item["mutableVars"]]:
        importers = importers_of.get(fact["rel"], [])
        is_python = fact["rel"].endswith(".py")
        source_lines = file_texts.get(fact["rel"], "").split("\n")
        for variable in fact["mutableVars"]:
            raw_line = source_lines[variable["line"] - 1] if 0 < variable["line"] <= len(source_lines) else ""
            push_finding(
                "module-state",
                fact["rel"],
                variable["line"],
                raw_line.strip(),
                (
                    f"Module-level {variable['kind']} variable `{variable['name']}` in {fact['rel']} survives test processes; "
                    f"it is initialized to `{variable['initializer'] or '(uninitialized)'}`."
                ),
                "observed",
            )
        for func in fact["functions"]:
            mutating_state = [name for name in func["mutates"] if any(v["name"] == name for v in fact["mutableVars"])]
            if not mutating_state:
                continue
            if func["exported"]:
                push_finding(
                    "exported-mutator",
                    fact["rel"],
                    func["line"],
                    f"def {func['name']}()" if is_python else f"export {func['name']}()",
                    f"Exported function `{func['name']}` mutates module state: {', '.join(f'`{name}`' for name in mutating_state)}.",
                    "observed",
                )
            else:
                push_finding(
                    "internal-mutator",
                    fact["rel"],
                    func["line"],
                    f"def {func['name']}()" if is_python else f"function {func['name']}()",
                    f"Internal function `{func['name']}` mutates module state: {', '.join(f'`{name}`' for name in mutating_state)}.",
                    "observed",
                )
        for test in importers:
            raw_test = file_texts.get(test, "")
            if is_python:
                hook_usage = bool(
                    re.search(r"autouse\s*=\s*True", raw_test)
                    or re.search(r"def\s+setup_(method|function|module)\b", raw_test)
                    or re.search(r"@pytest\.fixture", raw_test)
                )
            else:
                hook_usage = bool(
                    re.search(r"(test\.(?:beforeEach|afterEach|before|after)\s*\(|it\.(?:beforeEach|afterEach|before|after)\s*\()", raw_test)
                )
            named_in_test = [
                name
                for audit in imports_by_test.get(test, [])
                if audit["resolved"] == fact["rel"]
                for name in audit["named"]
            ]
            reset_referenced = any(candidate["name"] in named_in_test for candidate in fact["resetCandidates"])
            state_names = ", ".join(f"`{v['name']}`" for v in fact["mutableVars"])
            if not hook_usage:
                push_finding(
                    "no-hooks",
                    test,
                    1,
                    "",
                    f"{test} imports state from {fact['rel']} but declares no reset hooks; nothing resets {state_names} between tests.",
                    "observed",
                )
            elif not reset_referenced:
                candidate_names = ", ".join(candidate["name"] for candidate in fact["resetCandidates"]) or "none exported"
                push_finding(
                    "hooks-without-reset",
                    test,
                    1,
                    "",
                    f"{test} declares hooks but never calls a reset function for {fact['rel']} ({candidate_names}).",
                    "observed",
                )
            else:
                push_finding("reset-note", test, 1, "", f"{test} already calls `{fact['resetCandidates'][0]['name']}` in a hook.", "observed")

    scores: dict[str, int] = {}
    for test in test_files:
        score = 0
        raw_text = file_texts.get(test, "")
        test_count = len(ordered_test_names(raw_text))
        own_state_facts = [
            audit["resolved"]
            for audit in imports_by_test.get(test, [])
            if audit["resolved"] and facts.get(audit["resolved"], {}).get("mutableVars")
        ]
        score += len(own_state_facts) * 3 + max(0, test_count - 1)
        test_is_python = test.endswith(".py")
        if own_state_facts:
            if test_is_python:
                no_hooks = not re.search(r"autouse\s*=\s*True", raw_text) and not re.search(r"def\s+setup_(method|function)\b", raw_text)
            else:
                no_hooks = not re.search(r"test\.(?:beforeEach|afterEach)|it\.(?:beforeEach|afterEach)", strip_noise(raw_text))
            if no_hooks:
                score += 3
        shared_with = [
            other for other in test_files
            if other != test and any(
                audit["resolved"] in own_state_facts
                for audit in imports_by_test.get(other, [])
            )
        ]
        score += len(shared_with)
        scores[test] = score

    return {"facts": facts, "importsByTest": imports_by_test, "findings": findings, "scores": scores}


def choose_target(analysis: dict, file_texts: dict[str, str], fallback_test_files: list[str]) -> dict | None:
    """Chooses the investigation target from suspicion ranking."""
    ranked = sorted(analysis["scores"].items(), key=lambda item: item[1], reverse=True)
    test_file = ranked[0][0] if ranked else (fallback_test_files[0] if fallback_test_files else None)
    if not test_file:
        return None

    names = ordered_test_names(file_texts.get(test_file, ""))
    if not names:
        return {
            "testFile": test_file,
            "targetTest": None,
            "predecessorTest": None,
            "reasoning": f"No named tests were parsed in {test_file}; the whole file becomes the run target.",
        }
    target_test = names[-1] if len(names) > 1 else names[0]
    predecessor_test = names[-2] if len(names) > 1 else None
    reasoning = (
        f"Ranked {test_file} highest for shared-state suspicion; the last declared test is the target, "
        "with its predecessor kept separate for isolation runs."
        if len(names) > 1
        else f"Ranked {test_file} highest for shared-state suspicion; it declares a single named test."
    )
    return {"testFile": test_file, "targetTest": target_test, "predecessorTest": predecessor_test, "reasoning": reasoning}
