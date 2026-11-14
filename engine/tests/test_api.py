"""Tests for FastAPI endpoints."""

from fastapi.testclient import TestClient
from breakpoint.api import app

client = TestClient(app)


def test_api_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["engine"] == "breakpoint-python"
    assert data["version"] == "0.1.0"
    assert "subscribers" in data


def test_api_investigations_unsupported_action():
    response = client.post("/api/investigations", json={"action": "unknown-action"})
    assert response.status_code == 400
    data = response.json()
    assert "error" in data


def test_api_investigations_missing_project_id_for_start():
    response = client.post("/api/investigations", json={"action": "start-investigation"})
    assert response.status_code == 400
    data = response.json()
    assert "projectId is required" in data.get("error", "")
