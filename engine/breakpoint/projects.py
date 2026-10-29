"""Project registration safety gates and the static-analysis entry point.

Registration alone never executes anything; runs additionally require the
trusted flag to have been explicitly confirmed by a human in the same request.
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

from .discovery import detect_framework, discover_files, read_package_json
from .errors import ValidationError
from .patch_review import read_text_exact
from .state_analysis import analyze_project
from .store import read_store, write_store

FORBIDDEN_ROOTS = [
    "/", "/etc", "/usr", "/bin", "/sbin", "/var", "/System", "/Library",
    "/private/etc", "/opt/homebrew", "/Applications", "/cores",
    "/boot", "/proc", "/sys", "/dev",
]
MAX_ROOT_LENGTH = 512


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def register_project(root_input: str, trusted_explicit: bool) -> dict:
    """Validates and registers a local project directory.

    The path must exist, must not be a system prefix, and must plausibly
    contain tests.
    """
    if not isinstance(root_input, str) or not root_input or len(root_input) > MAX_ROOT_LENGTH:
        raise ValidationError("Provide a project path (an absolute directory on this machine).")
    root = os.path.realpath(root_input.strip())
    if not os.path.isabs(root):
        raise ValidationError("The project path must be absolute.")
    if root in FORBIDDEN_ROOTS or any(
        forbidden != "/" and (root == forbidden or root.startswith(f"{forbidden}/"))
        for forbidden in FORBIDDEN_ROOTS
    ):
        raise ValidationError("Refusing to register a system directory as a project.")
    info = Path(root)
    if not info.is_dir():
        raise ValidationError("That path is not a directory on this machine.")

    pkg = read_package_json(root)
    files = discover_files(root)
    if not files["testFiles"]:
        raise ValidationError("No test files were discovered there (looked for *.test.*, *.spec.* and test_*.py files).")
    if not os.access(root, os.R_OK):
        raise ValidationError("The project directory is not readable by this process.")

    pkg_name = pkg.get("name")
    name = pkg_name if isinstance(pkg_name, str) and pkg_name else Path(root).name
    framework = detect_framework(root, pkg)
    project = {
        "id": f"project_{uuid.uuid4().hex[:8]}",
        "name": name,
        "root": root,
        "trusted": trusted_explicit is True,
        "framework": framework,
        "testFiles": files["testFiles"],
        "createdAt": _now_iso(),
    }
    return {
        "project": project,
        "discovery": {
            "framework": framework,
            "testFiles": files["testFiles"],
            "sourceFiles": files["sourceFiles"],
            "stateFindingCount": 0,
            "truncated": files["truncated"],
        },
    }


def analyze_registered_project(project: dict) -> dict:
    """Runs the static state analysis for a project; never executes tests."""
    files = discover_files(project["root"])
    file_texts: dict[str, str] = {}
    for rel in [*files["testFiles"], *files["sourceFiles"]]:
        try:
            file_texts[rel] = read_text_exact(Path(project["root"]) / rel)
        except OSError:
            continue  # unreadable file: skip it; analysis proceeds with what it can read
    analysis = analyze_project(file_texts, files["testFiles"], files["sourceFiles"])
    return {"analysis": analysis, "fileTexts": file_texts}


def register_project_action(root_input: str, trusted_explicit: bool) -> dict:
    """Registers a project in the store (deduplicating by resolved root)."""
    data = read_store()
    outcome = register_project(root_input, trusted_explicit)
    project = outcome["project"]
    existing = next(
        (item for item in data["projects"] if os.path.realpath(item["root"]) == project["root"]),
        None,
    )
    if existing is not None:
        existing["framework"] = project["framework"]
        existing["testFiles"] = project["testFiles"]
        if trusted_explicit:
            existing["trusted"] = True
        write_store(data)
        return {"project": existing, "discovery": outcome["discovery"]}
    data["projects"].append(project)
    write_store(data)
    return outcome


def list_projects_action() -> list[dict]:
    """Lists registered projects (bootstrapping the demo project when absent)."""
    from . import investigations as _inv

    data = read_store()
    if not data["projects"]:
        _inv.bootstrap(data)
        write_store(data)
    return data["projects"]


def as_project(raw: object) -> dict | None:
    """Coerces an untrusted object into a Project or None."""
    if not isinstance(raw, dict):
        return None
    if not isinstance(raw.get("id"), str) or not isinstance(raw.get("root"), str):
        return None
    return raw
