"""Engine test configuration: isolated store per test session."""

import os
import sys
import tempfile
from pathlib import Path

import pytest

ENGINE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ENGINE_DIR))


@pytest.fixture()
def isolated_store(monkeypatch):
    """Points BREAKPOINT_DATA_DIR at a fresh temp directory for one test."""
    directory = tempfile.mkdtemp(prefix="bp-engine-test-")
    monkeypatch.setenv("BREAKPOINT_DATA_DIR", directory)
    import breakpoint.store as store

    store._directory_cache = None
    yield directory
    store._directory_cache = None


@pytest.fixture()
def node_sample() -> dict:
    """The bundled Node sample project record."""
    repo_root = Path(__file__).resolve().parents[2]
    return {
        "id": "project_sample",
        "name": "session-sample",
        "root": str(repo_root / "sample-project"),
        "trusted": True,
        "framework": "node",
        "testFiles": [],
        "createdAt": "2026-01-01T00:00:00.000Z",
    }


@pytest.fixture()
def py_sample() -> dict:
    """The bundled pytest sample project record."""
    repo_root = Path(__file__).resolve().parents[2]
    return {
        "id": "project_py_sample",
        "name": "ledger-sample",
        "root": str(repo_root / "python-sample-project"),
        "trusted": True,
        "framework": "pytest",
        "testFiles": [],
        "createdAt": "2026-01-01T00:00:00.000Z",
    }
