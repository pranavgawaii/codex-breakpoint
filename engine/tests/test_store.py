import os
import stat
from pathlib import Path
from breakpoint.store import empty_store, normalize_store, read_store, write_store, data_file_path
from breakpoint.discovery import detect_framework


def test_empty_store_structure():
    store = empty_store()
    for key in ("projects", "investigations", "runs", "evidence", "comparisons", "patches"):
        assert key in store
        assert isinstance(store[key], list)


def test_normalize_store_handles_legacy_or_malformed():
    raw = {
        "projects": [{"id": "p1", "root": "/tmp/test"}],
        "investigations": [{"id": "inv1", "status": "unknown_status"}],
        "patches": [{"id": "patch1", "status": "unknown"}],
    }
    normalized = normalize_store(raw)
    assert len(normalized["projects"]) == 1
    assert normalized["investigations"][0]["status"] == "open"
    assert normalized["patches"][0]["status"] == "draft"


def test_write_and_read_store_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setenv("BREAKPOINT_DATA_DIR", str(tmp_path))
    from breakpoint import store as store_module
    store_module._directory_cache = str(tmp_path)

    data = empty_store()
    data["projects"].append({
        "id": "proj_roundtrip",
        "name": "Test Project",
        "root": "/tmp/test",
        "trusted": True,
        "framework": "pytest",
        "testFiles": ["tests/test_flow.py"],
    })
    write_store(data)

    loaded = read_store()
    assert len(loaded["projects"]) == 1
    assert loaded["projects"][0]["id"] == "proj_roundtrip"

    # Verify atomic write permissions
    file_stat = os.stat(data_file_path())
    mode = stat.S_IMODE(file_stat.st_mode)
    assert mode == 0o600


def test_detect_framework_vitest_config(tmp_path):
    (tmp_path / "vitest.config.ts").write_text("export default {}", encoding="utf-8")
    fw = detect_framework(str(tmp_path), {})
    assert fw == "vitest"
