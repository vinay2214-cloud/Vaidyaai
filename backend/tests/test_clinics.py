import pytest
from fastapi.testclient import TestClient
from main import app
from config import settings

client = TestClient(app)


def test_dev_provision_endpoint_in_development():
    """
    Verify POST /api/v1/clinics/dev-provision returns provisioned clinic mapping in dev environment.
    """
    response = client.post("/api/v1/clinics/dev-provision", json={
        "uid": "test_dev_user_999",
        "clinic_id": "cln_e2e_test_clinic",
        "doctor_name": "Dr. Ramesh",
        "clinic_name": "Tirupati General Clinic",
        "role": "doctor"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["clinic_id"] == "cln_e2e_test_clinic"


def test_dev_provision_idempotency():
    """
    Verify POST /api/v1/clinics/dev-provision is idempotent across repeated logins.
    """
    res1 = client.post("/api/v1/clinics/dev-provision", json={
        "uid": "test_dev_user_idempotent",
        "clinic_id": "cln_e2e_test_clinic"
    })
    assert res1.status_code == 200

    res2 = client.post("/api/v1/clinics/dev-provision", json={
        "uid": "test_dev_user_idempotent",
        "clinic_id": "cln_e2e_test_clinic"
    })
    assert res2.status_code == 200
    assert res2.json()["clinic_id"] == "cln_e2e_test_clinic"


def test_dev_provision_rejected_in_production(monkeypatch):
    """
    Verify POST /api/v1/clinics/dev-provision returns HTTP 403 Forbidden in production.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    response = client.post("/api/v1/clinics/dev-provision", json={
        "uid": "test_dev_user_999"
    })
    assert response.status_code == 403
    assert "strictly disabled" in response.json()["detail"]
