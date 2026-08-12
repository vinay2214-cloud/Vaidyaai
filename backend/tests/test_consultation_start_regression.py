"""Regression tests for the consultation-start P0 defect (initial_vitals NameError).

Verifies that POST /api/v1/consultations/start:
  * does NOT raise NameError: name 'initial_vitals' is not defined
  * returns HTTP 200 (not 500)
  * always returns vitals == {} for a freshly created consultation
  * does NOT copy appointment placeholder vitals into the consultation record
"""
import pytest
from fastapi.testclient import TestClient

from main import app
from database import firestore as fs


@pytest.fixture
def client():
    fs._in_memory_store.clear()
    return TestClient(app)


def _seed_appointment(fs_module, clinic_id="cln_e2e_test_clinic"):
    """Seed an appointment (without vitals) into the in-memory store."""
    import asyncio
    app_doc = {
        "appointment_id": "app_p0_regression",
        "clinic_id": clinic_id,
        "patient_id": "pat_p0_001",
        "patient_name": "Regression Patient",
        "complaint_summary": "fever",
        "consultation_type": "new",
        "status": "confirmed",
    }
    asyncio.run(fs_module.set_document("appointments", "app_p0_regression", app_doc))
    return app_doc


def test_start_consultation_returns_200_and_empty_vitals(client):
    _seed_appointment(fs)
    response = client.post(
        "/api/v1/consultations/start",
        json={
            "clinic_id": "cln_e2e_test_clinic",
            "appointment_id": "app_p0_regression",
        },
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "draft"
    # Critical: vitals must be an empty dict, never an undefined NameError
    assert body["vitals"] == {}, f"Expected empty vitals, got {body['vitals']!r}"
    assert body["consultation_id"]


def test_start_consultation_does_not_use_appointment_placeholder_vitals(client):
    """Even if the appointment document contains vitals, the consultation must
    start with an independent empty vitals dict (grounded encounter only)."""
    import asyncio
    app_doc = {
        "appointment_id": "app_with_vitals",
        "clinic_id": "cln_e2e_test_clinic",
        "patient_id": "pat_p0_002",
        "patient_name": "Vitals Patient",
        "complaint_summary": "headache",
        "consultation_type": "new",
        "status": "confirmed",
        # Appointment may carry placeholder triage data; it must NOT leak into the consultation.
        "vitals": {"bp": "140/90", "temp": "100.1F"},
    }
    asyncio.run(fs.set_document("appointments", "app_with_vitals", app_doc))

    response = client.post(
        "/api/v1/consultations/start",
        json={
            "clinic_id": "cln_e2e_test_clinic",
            "appointment_id": "app_with_vitals",
        },
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["vitals"] == {}, "Appointment placeholder vitals leaked into consultation"
