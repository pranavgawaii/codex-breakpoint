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
