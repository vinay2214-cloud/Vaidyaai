"""Regression tests for the agents/health endpoint (P1 — idle-agent crash).

Verifies the endpoint never returns HTTP 500 when telemetry is incomplete:
  - zero executions
  - one execution
  - multiple executions
  - failed execution
  - idle agent
  - active agent
"""
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
from fastapi.testclient import TestClient

from main import app
from database import firestore as fs
from utils.date_utils import get_today_ist_date_str


@pytest.fixture
def client():
    fs._in_memory_store.clear()
    return TestClient(app)


def _now_utc():
    return datetime.now(timezone.utc)


def _seed_log(clinic_id, agent_name, latency_ms=None, success=True, decision="", created_at=None):
    """Insert an agent_log document into the in-memory store."""
    doc = {
        "agent_name": agent_name,
        "clinic_id": clinic_id,
        "latency_ms": latency_ms,
        "success": success,
        "decision_made": decision,
        "created_at": created_at or _now_utc(),
    }
    import uuid
    log_id = f"log_{agent_name}_{uuid.uuid4().hex[:12]}"
    asyncio.run(fs.set_document("agent_logs", log_id, doc))


def test_agents_health_zero_executions_does_not_crash(client):
    """Idle agents with no executions must return 200, not 500."""
    response = client.get(
        "/api/v1/agents/health",
        params={"clinic_id": "cln_e2e_test_clinic"},
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    agents = body["agents"]
    assert len(agents) == 7
    for a in agents:
        assert a["status"] == "Idle"
        assert a["avg_latency_ms"] is None
        assert a["tasks_today"] == 0
        assert a["failures_today"] == 0
        assert a["success_rate_pct"] is None


def test_agents_health_one_execution(client):
    _seed_log("cln_e2e_test_clinic", "clinical_scribe", latency_ms=1200, success=True, decision="SOAP generated")
    response = client.get(
        "/api/v1/agents/health",
        params={"clinic_id": "cln_e2e_test_clinic"},
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    clinicians = [a for a in body["agents"] if a["id"] == "clinical_scribe"]
    assert len(clinicians) == 1
    assert clinicians[0]["tasks_today"] == 1
    assert clinicians[0]["avg_latency_ms"] == 1200
    assert clinicians[0]["success_rate_pct"] == 100.0
    assert clinicians[0]["status"] == "Healthy"


def test_agents_health_multiple_executions(client):
    for i in range(5):
        _seed_log("cln_e2e_test_clinic", "billing_pulse", latency_ms=100 * (i + 1), success=True)
    response = client.get(
        "/api/v1/agents/health",
        params={"clinic_id": "cln_e2e_test_clinic"},
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    billers = [a for a in body["agents"] if a["id"] == "billing_pulse"]
    assert billers[0]["tasks_today"] == 5
    assert billers[0]["avg_latency_ms"] == round((100 + 200 + 300 + 400 + 500) / 5)
    assert billers[0]["success_rate_pct"] == 100.0


def test_agents_health_failed_execution(client):
    _seed_log("cln_e2e_test_clinic", "prescription_safe", latency_ms=None, success=False, decision="blocked")
    response = client.get(
        "/api/v1/agents/health",
        params={"clinic_id": "cln_e2e_test_clinic"},
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    agents = {a["id"]: a for a in body["agents"]}
    assert agents["prescription_safe"]["failures_today"] == 1
    # All failures and no successes => Failed
    assert agents["prescription_safe"]["status"] == "Failed"
    assert agents["prescription_safe"]["avg_latency_ms"] is None


def test_agents_health_mixed_idle_and_active(client):
    _seed_log("cln_e2e_test_clinic", "clinical_scribe", latency_ms=900, success=True)
    _seed_log("cln_e2e_test_clinic", "billing_pulse", latency_ms=50, success=True)
    response = client.get(
        "/api/v1/agents/health",
        params={"clinic_id": "cln_e2e_test_clinic"},
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    agents = {a["id"]: a for a in body["agents"]}
    assert agents["clinical_scribe"]["status"] == "Healthy"
    assert agents["billing_pulse"]["status"] == "Healthy"
    assert agents["appointment_flow"]["status"] == "Idle"


def test_agents_health_none_latency_does_not_crash(client):
    """Specifically test that avg_latency_ms=None comparisons don't raise TypeError."""
    _seed_log("cln_e2e_test_clinic", "retention_radar", latency_ms=None, success=True)
    _seed_log("cln_e2e_test_clinic", "retention_radar", latency_ms=None, success=True)
    response = client.get(
        "/api/v1/agents/health",
        params={"clinic_id": "cln_e2e_test_clinic"},
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    agents = {a["id"]: a for a in body["agents"]}
    assert agents["retention_radar"]["avg_latency_ms"] is None
