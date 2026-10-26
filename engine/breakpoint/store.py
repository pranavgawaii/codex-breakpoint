"""Local-first persistence for investigations.

The store is a single JSON document with camelCase keys, byte-compatible with
the original JavaScript engine so the existing web UI keeps working. Writes
are atomic (temporary file, then rename) with owner-only permissions.
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
import uuid
from pathlib import Path

STORE_FILE = "investigations.json"
MAX_STORE_BYTES = 20 * 1024 * 1024

_lock = threading.Lock()
_directory_cache: str | None = None


def empty_store() -> dict:
    """Fresh store shape. Every collection the engine persists."""
    return {
        "projects": [],
        "investigations": [],
        "runs": [],
        "evidence": [],
        "comparisons": [],
        "analyses": [],
        "hypotheses": [],
        "patches": [],
        "verifications": [],
        "toolInvocations": [],
    }


def get_data_directory() -> str:
    """Resolves (and creates) the data directory, preferring explicit config.

    BREAKPOINT_DATA_DIR wins; otherwise the process cwd's .breakpoint; finally
    the platform temp directory when the repository is read-only.
    """
    global _directory_cache
    with _lock:
        if _directory_cache:
            return _directory_cache
    configured = os.environ.get("BREAKPOINT_DATA_DIR", "").strip()
    candidates = [Path(configured)] if configured else [Path.cwd() / ".breakpoint"]
    candidates.append(Path(tempfile.gettempdir()) / "breakpoint-data")

    last_error: Exception | None = None
    for candidate in candidates:
        try:
            candidate.mkdir(parents=True, exist_ok=True)
            if not os.access(candidate, os.W_OK):
                raise PermissionError(f"{candidate} is not writable")
            with _lock:
                _directory_cache = str(candidate.resolve())
            return _directory_cache
        except OSError as error:  # unreadable/unwritable candidate
            last_error = error
    raise last_error or OSError("No writable directory is available for the investigation store.")


def data_file_path() -> Path:
    """Absolute path of the JSON store document."""
    return Path(get_data_directory()) / STORE_FILE


def _as_array(value: object) -> list:
    return value if isinstance(value, list) else []


def normalize_store(raw: object) -> dict:
    """Normalizes older or partial records so a schema addition cannot crash the UI."""
    data = dict(empty_store())
    if isinstance(raw, dict):
        for key in data:
            if key in raw:
                data[key] = raw[key]

    def with_id(items: object) -> list[dict]:
        return [item for item in _as_array(items) if isinstance(item, dict) and isinstance(item.get("id"), str)]

    data["projects"] = [
        item for item in with_id(data["projects"])
        if isinstance(item.get("root"), str)
    ]
    data["investigations"] = [
        {
            **item,
            "status": item["status"] if item.get("status") in ("verified", "needs_review") else "open",
            "goal": item.get("goal") if isinstance(item.get("goal"), str) else "",
            "target": item["target"] if isinstance(item.get("target"), dict) and isinstance(item["target"].get("testFile"), str) else None,
            "runIds": _as_array(item.get("runIds")),
            "evidenceIds": _as_array(item.get("evidenceIds")),
            "hypothesisIds": _as_array(item.get("hypothesisIds")),
            "comparisonIds": _as_array(item.get("comparisonIds")),
            "patchIds": _as_array(item.get("patchIds")),
            "verificationIds": _as_array(item.get("verificationIds")),
            "analysisIds": _as_array(item.get("analysisIds")),
        }
        for item in with_id(data["investigations"])
    ]
    data["runs"] = with_id(data["runs"])
    data["evidence"] = with_id(data["evidence"])
    data["comparisons"] = with_id(data["comparisons"])
    data["analyses"] = with_id(data["analyses"])
    data["hypotheses"] = [
        {
            **item,
            "source": "ai" if item.get("source") == "ai" else "deterministic",
            "supportingEvidenceIds": _as_array(item.get("supportingEvidenceIds")),
            "contradictingEvidenceIds": _as_array(item.get("contradictingEvidenceIds")),
            "alternativeExplanations": _as_array(item.get("alternativeExplanations")),
        }
        for item in with_id(data["hypotheses"])
    ]
    patches = []
    for item in with_id(data["patches"]):
        edits = [
            edit for edit in _as_array(item.get("edits"))
            if isinstance(edit, dict)
            and isinstance(edit.get("targetPath"), str)
            and isinstance(edit.get("originalContent"), str)
            and isinstance(edit.get("appliedContent"), str)
        ]
        # Legacy single-file patches carry their contents in flat fields.
        if (
            not edits
            and item.get("status") == "applied"
            and isinstance(item.get("originalContent"), str)
            and isinstance(item.get("appliedContent"), str)
            and isinstance(item.get("targetPath"), str)
        ):
            edits = [{
                "targetPath": item["targetPath"],
                "originalContent": item["originalContent"],
                "appliedContent": item["appliedContent"],
            }]
        patches.append({
            **item,
            "status": item["status"] if item.get("status") in ("applied", "reviewed", "reverted") else "draft",
            "edits": edits,
            "targetPath": item["targetPath"] if isinstance(item.get("targetPath"), str) else "",
        })
    data["patches"] = patches
    data["verifications"] = with_id(data["verifications"])
    data["toolInvocations"] = with_id(data["toolInvocations"])
    return data


def read_store() -> dict:
    """Loads and normalizes the store; an absent file yields an empty store."""
    file = data_file_path()
    try:
        raw_text = file.read_text(encoding="utf-8")
    except FileNotFoundError:
        return empty_store()
    if len(raw_text) > MAX_STORE_BYTES:
        raise RuntimeError("The local investigation store is unexpectedly large. Reset the store before continuing.")
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"The local investigation store is not valid JSON: {error}") from error
    if not isinstance(parsed, dict):
        raise RuntimeError("The local investigation store is not a JSON object.")
    return normalize_store(parsed)


def write_store(data: dict) -> None:
    """Atomically persists the store with owner-only permissions."""
    directory = Path(get_data_directory())
    file = directory / STORE_FILE
    temporary = directory / f"{STORE_FILE}.{os.getpid()}.{uuid.uuid4().hex}.tmp"
    text = json.dumps(data, indent=2)
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write(text)
    os.replace(temporary, file)
