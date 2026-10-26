"""Repository discovery: file walk, framework detection, run-command building.

Nothing third-party is globbed or spawned here. Detected binaries only ever
come from the project's own virtualenv/node_modules, never from the network.
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

from .errors import ValidationError

IGNORE_DIRS = {
    "node_modules", ".git", ".next", "dist", "build", "coverage", ".cache",
    "target", "vendor", "__pycache__", ".venv", "venv", ".tox", ".mypy_cache",
    ".pytest_cache", ".ruff_cache", "site-packages", ".breakpoint",
}
IGNORE_FILES = {"package-lock.json", "pnpm-lock.yaml"}
MAX_FILES = 400
MAX_TEST_FILES = 32

TEST_SUFFIX = re.compile(r"\.(test|spec)\.(js|mjs|cjs|jsx|ts|tsx)$")
PY_TEST_NAME = re.compile(r"(^|/)(test_[^/]*\.py|[^/]*_test\.py)$")
SOURCE_SUFFIX = re.compile(r"\.(js|mjs|cjs|jsx|ts|tsx)$")
PY_SUFFIX = re.compile(r"\.py$")

Frameworks = ("pytest", "node", "jest", "vitest")
RunningFramework = str  # one of Frameworks


def discover_files(root: str) -> dict:
    """Walks a project directory (symlink-safe) and splits files into tests and sources."""
    files: list[str] = []
    root_path = Path(root)

    def walk(directory: Path, rel: str) -> None:
        if len(files) >= MAX_FILES:
            return
        try:
            entries = sorted(
                (entry for entry in directory.iterdir()),
                key=lambda entry: entry.name,
            )
        except OSError:
            return  # unreadable subtree: skip, do not fail the whole discovery
        for entry in entries:
            if len(files) >= MAX_FILES:
                return
            if entry.name.startswith(".") and entry.is_dir():
                continue
            if entry.name in IGNORE_DIRS:
                continue
            rel_path = f"{rel}/{entry.name}" if rel else entry.name
            if entry.is_dir():
                if entry.is_symlink():
                    continue
                walk(entry, rel_path)
                continue
            if not entry.is_file() or entry.name in IGNORE_FILES:
                continue
            files.append(rel_path)

    walk(root_path, "")
    is_js_test = lambda file: bool(TEST_SUFFIX.search(file))  # noqa: E731
    is_py_test = lambda file: bool(PY_TEST_NAME.search(file))  # noqa: E731
    test_files = [file for file in files if is_js_test(file) or is_py_test(file)]
    source_files = [
        file for file in files
        if (SOURCE_SUFFIX.search(file) and not is_js_test(file) and not file.endswith(".d.ts"))
        or (PY_SUFFIX.search(file) and not is_py_test(file))
    ]
    return {
        "files": files,
        "testFiles": test_files[:MAX_TEST_FILES],
        "sourceFiles": source_files,
        "truncated": len(files) >= MAX_FILES,
    }


def read_package_json(root: str) -> dict:
    """Reads package.json when present and returns {} otherwise."""
    try:
        parsed = json.loads((Path(root) / "package.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def read_pyproject(root: str) -> dict:
    """Reads pyproject.toml when present and returns {} otherwise (stdlib tomllib)."""
    try:
        import tomllib
        parsed = tomllib.loads((Path(root) / "pyproject.toml").read_text(encoding="utf-8"))
    except (OSError, Exception):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def read_requirements(root: str) -> str:
    """Concatenated requirements*.txt text for dependency sniffing."""
    parts = []
    for name in ("requirements.txt", "requirements-dev.txt", "dev-requirements.txt"):
        try:
            parts.append((Path(root) / name).read_text(encoding="utf-8"))
        except OSError:
            continue
    return "\n".join(parts)


def detect_framework(root: str, pkg: dict) -> RunningFramework:
    """Detects the test framework from configs, dependencies and markers.

    pytest wins when any pytest marker exists (it is the dedicated product
    focus); otherwise jest/vitest configs; the default is Node's native runner.
    """
    pyproject = read_pyproject(root)
    dependency_text = json.dumps({**(pkg.get("dependencies") or {}), **(pkg.get("devDependencies") or {})})
    script_text = json.dumps(pkg.get("scripts") or {})
    python_dependency_text = " ".join([
        json.dumps(pyproject.get("project", {})),
        json.dumps(pyproject.get("tool", {})),
        json.dumps(pyproject.get("dependency-groups", {})),
    ])
    requirements_text = read_requirements(root)

    pytest_markers = (
        (Path(root) / "pytest.ini").exists()
        or (Path(root) / "conftest.py").exists()
        or "pytest" in python_dependency_text
        or "pytest" in requirements_text
        or "pytest" in json.dumps(pyproject.get("tool", {}))
        or (Path(root) / "tox.ini").exists() and "pytest" in (Path(root) / "tox.ini").read_text(encoding="utf-8")
    )
    if pytest_markers:
        return "pytest"

    try:
        entries = {entry.name for entry in Path(root).iterdir()}
    except OSError:
        entries = set()
    configs = [
        name for name in entries
        if re.match(r"^jest\.config\.", name) or re.match(r"^vitest\.config\.", name) or re.match(r"^vite\.config\.", name)
    ]
    if any(name.startswith("vitest") for name in configs) or re.search(r"(vitest|@vitest)", f"{dependency_text} {script_text}"):
        return "vitest"
    if any(name.startswith("jest") for name in configs) or re.search(r"(jest|@types/jest)", f"{dependency_text} {script_text}"):
        return "jest"
    return "node"


def _python_bin(root: str) -> str:
    """Prefers the project's own virtualenv interpreter; falls back to ours."""
    for name in (".venv", "venv"):
        candidate = Path(root) / name / "bin" / "python"
        if candidate.exists():
            return str(candidate)
    return sys.executable


def build_run_command(
    root: str,
    framework: RunningFramework,
    test_files: list[str] | None = None,
    test_name_pattern: str | None = None,
) -> dict:
    """Builds the exact argv for a run spec plus its output parser.

    pytest targets are narrowed with ``file::test`` node ids and parsed from
    junitxml written to a temp path (never inside the project).
    """
    test_files = test_files or []
    if framework == "pytest":
        import tempfile

        descriptor, junit_path = tempfile.mkstemp(prefix="breakpoint-junit-", suffix=".xml")
        import os

        os.close(descriptor)
        argv = [_python_bin(root), "-m", "pytest", "-p", "no:cacheprovider", "--junitxml", junit_path, "-q"]
        if test_files:
            argv.extend(test_files)
        return {"argv": argv, "parser": "junit", "junitPath": junit_path}

    if framework == "node":
        node_bin = shutil.which("node")
        if not node_bin:
            raise ValidationError("node is not available on PATH for this process.")
        argv = [node_bin, "--test", "--test-concurrency=1"]
        if test_name_pattern:
            argv.extend(["--test-name-pattern", test_name_pattern])
        argv.extend(test_files)
        return {"argv": argv, "parser": "tap"}

    if framework in ("vitest", "jest"):
        bin_name = "vitest" if framework == "vitest" else "jest"
        bin_path = Path(root) / "node_modules" / ".bin" / bin_name
        if not bin_path.exists():
            raise ValidationError(
                f"{bin_name} is not installed inside this project; install dependencies or use the default node:test runner."
            )
        argv = [str(bin_path)]
        if framework == "vitest":
            argv.extend(["run", "--reporter=tap", "--no-color"])
        else:
            argv.extend(["--runInBand", "--silent"])
        if test_name_pattern:
            argv.extend(["--testNamePattern", test_name_pattern])
        argv.extend(test_files)
        return {"argv": argv, "parser": "tap" if framework == "vitest" else "jest"}

    return {"argv": test_files, "parser": "none"}
