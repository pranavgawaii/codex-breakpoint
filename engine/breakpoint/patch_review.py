"""Unified diffs, patch drafting, apply/revert with byte-exact baselines.

Drafts prefer the least invasive mechanical fix:
1. Wire an exported reset function of an imported stateful module into a
   before-hook of the target test file (one edit).
2. If none is exported, synthesize a provably-safe reset in the stateful
   module AND wire it into the test file (two edits).
3. Otherwise no patch is drafted — the engine refuses to guess.
"""

from __future__ import annotations

import difflib
import hashlib
import re
import uuid
from pathlib import Path, PurePosixPath

from .errors import ConflictError, ValidationError

MAX_PATCH_FILE_BYTES = 256 * 1024
MAX_DIFF_LINES = 600

PY_RESET_HINT_CALL = "breakpoint_reset_state"


def _new_patch_id() -> str:
    return f"patch_{uuid.uuid4().hex[:8]}"


def _read_text_raw(path: Path) -> str:
    """Reads text preserving original line endings exactly."""
    with open(path, "r", encoding="utf-8", newline="") as handle:
        return handle.read()


read_text_exact = _read_text_raw
"""Public alias: exact-bytes text read used by analysis and patching alike."""


def _write_text_raw(path: Path, text: str) -> None:
    """Writes text exactly as given, without newline translation."""
    with open(path, "w", encoding="utf-8", newline="") as handle:
        handle.write(text)


def _content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]


def _resolve_inside_project(root: str, relative_path: str) -> Path:
    root_path = Path(root).resolve()
    absolute = (root_path / relative_path).resolve()
    try:
        relative = absolute.relative_to(root_path)
    except ValueError as error:
        raise ValidationError("Patch target escapes the project root.") from error
    if absolute == root_path:
        raise ValidationError("Patch target escapes the project root.")
    return absolute


def make_unified_diff(before: str, after: str, target_path: str) -> str:
    """Line-level unified diff (difflib), display-only.

    Apply/revert always reconstructs files from stored full contents and
    baselines; the diff never drives disk writes. Beyond the cap the diff
    degrades to a suppressed summary, which stays honest.
    """
    old_lines = before.split("\n")
    new_lines = after.split("\n")
    if len(old_lines) > MAX_DIFF_LINES or len(new_lines) > MAX_DIFF_LINES:
        return f"--- a/{target_path}\n+++ b/{target_path}\n@@ (file exceeds {MAX_DIFF_LINES} lines; content suppressed) @@"
    diff = difflib.unified_diff(
        old_lines,
        new_lines,
        fromfile=f"a/{target_path}",
        tofile=f"b/{target_path}",
        lineterm="",
        n=3,
    )
    return "\n".join(diff)


def _content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]


def _last_import_line_index(lines: list[str], is_python: bool) -> int:
    last = -1
    for index, line in enumerate(lines):
        if is_python and re.match(r"^\s*(import|from)\s", line):
            last = index
        elif not is_python and re.match(r"^\s*import\b", line):
            last = index
    return last


def _hook_api_for(raw: str, is_python: bool) -> dict:
    """Detects the local test/hook naming style of a test file."""
    if is_python:
        imports_pytest = bool(re.search(r"^\s*import\s+pytest\b", raw, re.MULTILINE))
        uses_fixture = bool(re.search(r"@pytest\.fixture", raw))
        return {"pytest": True, "importsPytest": imports_pytest, "usesFixture": uses_fixture}
    if re.search(r"""from\s+["']node:test["']""", raw):
        default_import = re.search(r"""import\s+([A-Za-z_$][\w$]*)\s+from\s+["']node:test["']""", raw)
        return {"hook": f"{default_import.group(1) if default_import else 'test'}.beforeEach"}
    if re.search(r"""from\s+["']vitest["']""", raw):
        named = re.search(r"""import\s*\{([^}]*)\}\s*from\s+["']vitest["']""", raw)
        return {"hook": "beforeEach" if named and re.search(r"\bbeforeEach\b", named.group(1)) else None}
    return {"hook": "beforeEach"}


def _wire_reset_into_test_file(test_raw: str, module_path: str, reset_name: str, test_file_rel: str, hook_api: dict) -> dict | None:
    """Builds the edited test file that calls a reset in a before-hook."""
    is_python = test_file_rel.endswith(".py")
    if is_python:
        return _wire_reset_into_python_test(test_raw, module_path, reset_name, test_file_rel, hook_api)

    hook = hook_api.get("hook")
    if not hook:
        return None
    lines = test_raw.split("\n")
    import_line_index = next(
        (
            index for index, line in enumerate(lines)
            if re.match(r"^\s*import\b", line) and re.search(r"""from\s*["'][^"']*["']""", line) and module_path in line
        ),
        -1,
    )
    if import_line_index < 0:
        return None
    import_line = lines[import_line_index]
    already_imports = reset_name in import_line
    if not already_imports and "{" not in import_line:
        return None  # unusual import syntax: refuse
    if not already_imports:
        def extend_named(inside: str) -> str:
            names = [part.strip() for part in inside.split(",") if part.strip()]
            names.append(reset_name)
            return "{ " + ", ".join(sorted(names)) + " }"
        lines[import_line_index] = re.sub(r"\{([^}]*)\}", lambda match: extend_named(match.group(1)), import_line, count=1)
    last_import = _last_import_line_index(lines, False)
    lines.insert(last_import + 1, "")
    lines.insert(last_import + 2, f"{hook}(() => {{ {reset_name}(); }});")
    return {"targetPath": test_file_rel, "originalContent": test_raw, "appliedContent": "\n".join(lines)}


def _wire_reset_into_python_test(test_raw: str, module_path: str, reset_name: str, test_file_rel: str, hook_api: dict) -> dict | None:
    lines = test_raw.split("\n")

    # Extend an existing `from module import ...` line, or add one.
    import_line_index = next(
        (
            index for index, line in enumerate(lines)
            if re.match(r"^\s*from\s+", line) and re.search(rf"\b{re.escape(_module_stem(module_path))}\b", line)
        ),
        -1,
    )
    if import_line_index < 0:
        return None
    import_line = lines[import_line_index]
    already_imports = re.search(rf"\b{re.escape(reset_name)}\b", import_line) is not None
    if not already_imports:
        extended = re.sub(
            r"^(\s*from\s+[\w.]+\s+import\s+)(.*)$",
            lambda match: f"{match.group(1)}{', '.join(sorted([part.strip() for part in match.group(2).split(',') if part.strip()] + [reset_name]))}",
            import_line,
            count=1,
        )
        lines[import_line_index] = extended

    # Ensure `import pytest` exists for the autouse fixture.
    if not hook_api.get("importsPytest"):
        pytest_index = next((index for index, line in enumerate(lines) if re.match(r"^\s*import\s+pytest\b", line)), -1)
        if pytest_index < 0:
            lines.insert(0, "import pytest")

    last_import = _last_import_line_index(lines, True)
    fixture = [
        "",
        "@pytest.fixture(autouse=True)",
        "def _breakpoint_reset_state():",
        f"    {reset_name}()",
        "    yield",
        f"    {reset_name}()",
    ]
    lines[last_import + 1:last_import + 1] = fixture
    return {"targetPath": test_file_rel, "originalContent": test_raw, "appliedContent": "\n".join(lines)}


def _module_stem(module_path: str) -> str:
    """`src/billing.py` -> `billing`; `pkg/__init__.py` -> `pkg`."""
    path = PurePosixPath(module_path)
    return "pkg" if path.name == "__init__.py" and path.parent.as_posix() else path.stem


def _provable_reset_statements(fact: dict) -> list[str] | None:
    """Python reset statements per module var, or None when not provable."""
    statements: list[str] = []
    for variable in fact["mutableVars"]:
        initializer = variable["initializer"].strip()
        kind = variable["kind"]
        if kind == "container":
            if re.match(r"^(\{\}|\{\s*\}|dict\(\))", initializer):
                statements.append(f"{variable['name']}.clear()")
            elif re.match(r"^(\[\]|\[\s*\]|list\(\))", initializer):
                statements.append(f"{variable['name']}.clear()")
            elif re.match(r"^(set\(\)|\{[^:]*\})", initializer):
                statements.append(f"{variable['name']}.clear()")
            else:
                return None  # opaque container: refuse
        elif initializer in ("None", "True", "False", "0", '""', "''") or re.match(r"^-?\d+(\.\d+)?$", initializer) or re.match(r"^['\"].*['\"]$", initializer) or initializer == "":
            statements.append(f"{variable['name']} = {initializer or 'None'}")
        else:
            return None  # opaque call initializer: refuse
    return statements or None


def draft_cleanup_patch(
    investigation_id: str,
    analysis: dict,
    file_texts: dict[str, str],
    shape: dict,
) -> dict | None:
    """Drafts a cleanup patch from recorded static analysis (no disk writes)."""
    test_file = shape["testFile"]
    test_raw = file_texts.get(test_file, "")
    if not test_raw:
        raise ValidationError("The target test file could not be read for patch drafting.")
    if len(test_raw.encode("utf-8")) > MAX_PATCH_FILE_BYTES:
        raise ValidationError("The target test file is too large to patch safely.")

    hook_api = _hook_api_for(test_raw, test_file.endswith(".py"))
    if not test_file.endswith(".py") and not hook_api.get("hook"):
        return None

    imported_state_modules = [
        audit["resolved"]
        for audit in analysis["importsByTest"].get(test_file, [])
        if audit["resolved"] and analysis["facts"].get(audit["resolved"], {}).get("mutableVars")
    ]

    # Case 1: an exported reset already exists on an imported stateful module.
    for module_path in imported_state_modules:
        fact = analysis["facts"][module_path]
        reset = fact["resetCandidates"][0] if fact["resetCandidates"] else None
        if not reset:
            continue
        edit = _wire_reset_into_test_file(test_raw, module_path, reset["name"], test_file, hook_api)
        if not edit:
            continue
        return {
            "id": _new_patch_id(),
            "investigationId": investigation_id,
            "description": (
                f"Call `{reset['name']}()` from {module_path} in a before-hook so "
                f"`{', '.join(reset['resetVars'])}` starts clean for every test in {test_file}."
            ),
            "diff": make_unified_diff(test_raw, edit["appliedContent"], test_file),
            "status": "draft",
            "baseline": f"sha256-{_content_hash(edit['originalContent'])}",
            "targetPath": test_file,
            "edits": [edit],
        }

    # Case 2: synthesize an exported reset in the stateful module, then wire it.
    for module_path in imported_state_modules:
        fact = analysis["facts"][module_path]
        raw = file_texts.get(module_path, "")
        if not raw or len(raw.encode("utf-8")) > MAX_PATCH_FILE_BYTES:
            continue
        reset_statements = _provable_reset_statements(fact)
        if not reset_statements:
            continue

        if module_path.endswith(".py"):
            reset_name = PY_RESET_HINT_CALL
            module_lines = raw.split("\n")
            module_lines.extend([
                "",
                "",
                "def " + reset_name + "():",
                "    \"\"\"Resets module-level state between tests (added by Breakpoint).\"\"\"",
                *[f"    {statement}" for statement in reset_statements],
            ])
            module_edited = "\n".join(module_lines)
        else:
            reset_name = "breakpointResetState"
            module_lines = raw.split("\n")
            module_lines.extend([
                "",
                "/** Added by Breakpoint: resets module-level state between tests. */",
                f"export function {reset_name}() {{",
                f"  {' '.join(reset_statements)}",
                "}",
            ])
            module_edited = "\n".join(module_lines)

        test_edit = _wire_reset_into_test_file(test_raw, module_path, reset_name, test_file, hook_api)
        if not test_edit:
            continue

        return {
            "id": _new_patch_id(),
            "investigationId": investigation_id,
            "description": (
                f"Add `{reset_name}()` to {module_path} and call it from a before-hook in {test_file}, "
                "so every test starts from the module's declared initial state."
            ),
            "diff": (
                f"{make_unified_diff(raw, module_edited, module_path)}\n\n"
                f"{make_unified_diff(test_edit['originalContent'], test_edit['appliedContent'], test_file)}"
            ),
            "status": "draft",
            "baseline": f"sha256-{_content_hash(raw)}+{_content_hash(test_edit['originalContent'])}",
            "targetPath": module_path,
            "edits": [
                {"targetPath": module_path, "originalContent": raw, "appliedContent": module_edited},
                test_edit,
            ],
        }

    return None


def apply_patch(patch: dict, project: dict) -> dict:
    """Applies a draft only when every on-disk target matches its baseline.

    All-or-nothing: any mismatch aborts without writing anything.
    """
    if patch["status"] != "draft":
        raise ValidationError("Only a draft patch can be applied.")
    edits = patch.get("edits") or []
    if not edits:
        raise ValidationError("This patch has no recorded apply content; redraft it.")
    resolved = [{"edit": edit, "absolute": _resolve_inside_project(project["root"], edit["targetPath"])} for edit in edits]
    for item in resolved:
        current = _read_text_raw(item["absolute"])
        if current != item["edit"]["originalContent"]:
            raise ConflictError(f"Patch blocked: {item['edit']['targetPath']} no longer matches the recorded baseline.")
    for item in resolved:
        _write_text_raw(item["absolute"], item["edit"]["appliedContent"])
    return {**patch, "status": "applied"}


def revert_patch(patch: dict, project: dict) -> dict:
    """Reverts an applied patch to its recorded baselines."""
    if patch["status"] != "applied":
        raise ValidationError("Only an applied patch can be reverted.")
    resolved = [{"edit": edit, "absolute": _resolve_inside_project(project["root"], edit["targetPath"])} for edit in patch.get("edits") or []]
    for item in resolved:
        current = _read_text_raw(item["absolute"])
        if current != item["edit"]["appliedContent"]:
            raise ConflictError(f"Revert blocked: {item['edit']['targetPath']} differs from the recorded applied content.")
    for item in resolved:
        _write_text_raw(item["absolute"], item["edit"]["originalContent"])
    return {**patch, "status": "reverted"}


def verify_run(investigation_id: str, run: dict, notes: str) -> dict:
    """Turns a post-patch rerun into a VerificationResult record."""
    from datetime import datetime, timezone

    return {
        "id": f"verify_{uuid.uuid4().hex[:8]}",
        "investigationId": investigation_id,
        "runId": run["id"],
        "result": "verified" if run["status"] == "passed" else "not_verified" if run["status"] == "failed" else "unknown",
        "notes": notes,
        "recordedAt": datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
    }
