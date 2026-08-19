"""
VaidyaAI production onboarding regression suite.

Covers the "authenticated Firebase user with no clinic mapping" path that the
production login flow depends on:

1. POST /clinics/setup requires authentication (401 without a credential).
2. POST /clinics/setup provisions the tenant against the UID from the *verified*
   token, never a client-supplied identity.
3. Setup writes the Firestore clinic_users/{uid} mapping that useAuth() reads.
4. Setup sets the Firebase custom claims (clinic_id, role) that Firestore
   security rules and the backend authorization fallback rely on.
5. Setup is idempotent -- a second call returns the existing clinic instead of
   creating a duplicate tenant.
6. After setup, the newly mapped clinic authorizes and other clinics do not.

These guard the regression where onboarding appeared to succeed but the browser
kept an ID token with no clinic_id claim, so every subsequent tenant-scoped
request/listener failed.
"""
import asyncio
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from main import app
from config import settings
from api.auth import get_current_user, verify_clinic_access
from database.firestore import get_document

client = TestClient(app)


def _run(coro):
    return asyncio.run(coro)


SETUP_PAYLOAD = {
    "clinic_name": "Arogya Wellness Clinic",
    "doctor_name": "Dr. Onboard Test",
    "phone": "+919812345678",
    "location": "Tirupati, AP",
    "consultation_fees": {
        "new_patient_paise": 30000,
        "followup_paise": 15000,
        "procedure_paise": 50000,
    },
    "whatsapp_phone_id": "default_phone_id",
}


def test_setup_requires_authentication():
    """An unauthenticated onboarding attempt is rejected with 401."""
    response = client.post("/api/v1/clinics/setup", json=SETUP_PAYLOAD)
    assert response.status_code == 401


def test_setup_derives_tenant_owner_from_verified_token(monkeypatch):
    """
    The clinic owner UID comes from the verified Firebase token, and the
    resulting Firestore mapping + custom claims are written for that UID.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    uid = "uid_onboarding_owner_001"
    mock_decoded = {"uid": uid, "phone_number": "+919812345678"}

    with patch("firebase_admin.auth.verify_id_token", return_value=mock_decoded), \
         patch("firebase_admin.auth.set_custom_user_claims") as mock_claims:
        response = client.post(
            "/api/v1/clinics/setup",
            json=SETUP_PAYLOAD,
            headers={"Authorization": "Bearer valid_jwt_new_doctor"},
        )

        assert response.status_code == 200, response.text
        clinic_id = response.json()["clinic_id"]
        assert clinic_id

        # Custom claims must be set for the authenticated UID so that the
        # refreshed ID token carries clinic_id (required by Firestore rules).
        mock_claims.assert_called_once()
        claim_uid, claim_payload = mock_claims.call_args[0]
        assert claim_uid == uid
        assert claim_payload["clinic_id"] == clinic_id
        assert claim_payload["role"] == "doctor"

        # Firestore clinic_users/{uid} mapping is what useAuth() reads on load.
        mapping = _run(get_document("clinic_users", uid))
        assert mapping is not None
        assert mapping["clinic_id"] == clinic_id


def test_setup_is_idempotent_and_does_not_duplicate_tenant(monkeypatch):
    """A repeated setup call returns the existing clinic rather than a new one."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    uid = "uid_onboarding_idempotent_002"
    mock_decoded = {"uid": uid, "phone_number": "+919812345679"}

    with patch("firebase_admin.auth.verify_id_token", return_value=mock_decoded), \
         patch("firebase_admin.auth.set_custom_user_claims"):
        first = client.post(
            "/api/v1/clinics/setup",
            json=SETUP_PAYLOAD,
            headers={"Authorization": "Bearer valid_jwt_idempotent"},
        )
        assert first.status_code == 200, first.text
        first_clinic_id = first.json()["clinic_id"]

        second = client.post(
            "/api/v1/clinics/setup",
            json=SETUP_PAYLOAD,
            headers={"Authorization": "Bearer valid_jwt_idempotent"},
        )
        assert second.status_code == 200, second.text
        assert second.json()["clinic_id"] == first_clinic_id


def test_authorization_after_onboarding_is_scoped_to_new_clinic(monkeypatch):
    """
    After onboarding, the doctor is authorized for their own clinic and rejected
    for any other -- even when their ID token still lacks the clinic_id claim
    (the backend resolves membership from Firestore).
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    uid = "uid_onboarding_scoped_003"
    mock_decoded = {"uid": uid, "phone_number": "+919812345680"}

    with patch("firebase_admin.auth.verify_id_token", return_value=mock_decoded), \
         patch("firebase_admin.auth.set_custom_user_claims"):
        created = client.post(
            "/api/v1/clinics/setup",
            json=SETUP_PAYLOAD,
            headers={"Authorization": "Bearer valid_jwt_scoped"},
        )
        assert created.status_code == 200, created.text
        clinic_id = created.json()["clinic_id"]

        # Token deliberately carries NO clinic_id claim.
        user = _run(get_current_user(authorization="Bearer valid_jwt_scoped"))
        assert user["clinic_id"] == clinic_id

        assert verify_clinic_access(clinic_id, current_user=user)["clinic_id"] == clinic_id

        with pytest.raises(HTTPException) as exc:
            verify_clinic_access("cln_someone_elses_clinic", current_user=user)
        assert exc.value.status_code == 403


def test_setup_never_grants_the_development_clinic(monkeypatch):
    """
    Production onboarding must never map a real user onto the dev/demo clinic.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    uid = "uid_onboarding_no_devclinic_004"
    mock_decoded = {"uid": uid, "phone_number": "+919812345681"}

    with patch("firebase_admin.auth.verify_id_token", return_value=mock_decoded), \
         patch("firebase_admin.auth.set_custom_user_claims"):
        response = client.post(
            "/api/v1/clinics/setup",
            json=SETUP_PAYLOAD,
            headers={"Authorization": "Bearer valid_jwt_no_devclinic"},
        )
        assert response.status_code == 200, response.text
        assert response.json()["clinic_id"] != "cln_e2e_test_clinic"
