"""Regression tests for the consultation activity feed endpoint.

Verifies that GET /api/v1/consultations/{id}/activity returns ONLY real
agent_logs rows scoped to the consultation — never fabricated/hardcoded entries.
"""
import asyncio
import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from main import app
from database import firestore as fs


@pytest.fixture
def client():
    fs._in_memory_store.clear()
    return TestClient(app)


def _seed_consultation(fs_module, clinic_id="cln_e2e_test_clinic", cons_id="cons_act_001"):
    doc = {
        "consultation_id": cons_id,
        "clinic_id": clinic_id,
        "appointment_id": "app_act_001",
        "status": "draft",
        "vitals": {},
    }
    asyncio.run(fs_module.set_document("consultations", cons_id, doc))


def _seed_agent_log(fs_module, clinic_id, consultation_id, agent_name, decision, success=True):
    doc = {
        "agent_name": agent_name,
        "clinic_id": clinic_id,
        "consultation_id": consultation_id,
        "decision_type": "test_event",
        "decision_made": decision,
        "success": success,
        "created_at": datetime.now(timezone.utc),
    }
    asyncio.run(fs_module.set_document("agent_logs", f"log_{uuid.uuid4().hex[:12]}", doc))


def test_activity_returns_only_scoped_logs(client):
    _seed_consultation(fs)
    _seed_agent_log(fs, "cln_e2e_test_clinic", "cons_act_001", "clinical_scribe", "SOAP drafted")
    _seed_agent_log(fs, "cln_e2e_test_clinic", "cons_act_001", "prescription_safe", "Safety audit passed")
    # A log for a DIFFERENT consultation must not appear
    _seed_agent_log(fs, "cln_e2e_test_clinic", "cons_other_999", "billing_pulse", "Invoice for other")

    response = client.get(
        "/api/v1/consultations/cons_act_001/activity",
        params={"clinic_id": "cln_e2e_test_clinic"},
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["count"] == 2
    agents = {item["agent"] for item in body["items"]}
    assert agents == {"clinical_scribe", "prescription_safe"}
    assert "billing_pulse" not in agents


def test_activity_empty_when_no_logs(client):
    """No fabricated entries when zero agent logs exist for the consultation."""
    _seed_consultation(fs)
    response = client.get(
        "/api/v1/consultations/cons_act_001/activity",
        params={"clinic_id": "cln_e2e_test_clinic"},
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["count"] == 0
    assert body["items"] == []


def test_activity_404_when_consultation_missing(client):
    response = client.get(
        "/api/v1/consultations/nonexistent/activity",
        params={"clinic_id": "cln_e2e_test_clinic"},
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 404


def test_clinic_settings_returns_configured_fees(client):
    """GET /clinics/settings must return the configured consultation fees."""
    clinic_doc = {
        "name": "Test Clinic",
        "doctor_name": "Dr. Test",
        "phone": "+919876543210",
        "consultation_fees": {
            "new_patient_paise": 50000,
            "followup_paise": 20000,
            "procedure_paise": 100000,
        },
        "is_active": True,
    }
    asyncio.run(fs.set_document("clinics", "cln_e2e_test_clinic", clinic_doc))

    response = client.get(
        "/api/v1/clinics/settings",
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["clinic_id"] == "cln_e2e_test_clinic"
    assert body["consultation_fees"]["new_patient_paise"] == 50000
    assert body["consultation_fees"]["followup_paise"] == 20000
    assert body["consultation_fees"]["procedure_paise"] == 100000


def test_clinic_settings_defaults_when_not_configured(client):
    """When clinic doc has no fees, defaults consistent with BillingPulse are returned."""
    clinic_doc = {"name": "No Fees Clinic", "doctor_name": "Dr. NoFee", "phone": "+919999999999"}
    asyncio.run(fs.set_document("clinics", "cln_e2e_test_clinic", clinic_doc))

    response = client.get(
        "/api/v1/clinics/settings",
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    # Defaults: 30000 / 15000 / 50000 paise
    assert body["consultation_fees"]["new_patient_paise"] == 30000
    assert body["consultation_fees"]["followup_paise"] == 15000
    assert body["consultation_fees"]["procedure_paise"] == 50000
