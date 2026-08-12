"""
VaidyaAI Live Authentication & Tenant Isolation Regression Test Suite.

Covers:
1. Valid authenticated user + correct clinic -> 200
2. Missing Authorization header -> 401
3. Invalid Firebase token -> 401
4. Valid Firebase user without clinic membership -> 403
5. Valid user + correct clinic membership -> 200
6. Valid user + tampered clinic_id (cross-tenant access) -> 403
7. JWT without clinic_id claim + valid Firestore clinic_users/{uid} -> authorized ONLY for that server-side clinic
8. Production mode + dev_mock_id_token -> 401
9. Expired token -> 401
10. Duplicate/incorrect provisioning does not grant unauthorized access.
"""
import pytest
import asyncio
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import HTTPException
import firebase_admin
from firebase_admin import auth as firebase_auth

from main import app
from config import settings
from api.auth import get_current_user, verify_clinic_access
from database.firestore import set_document, get_document

client = TestClient(app)


def _run(coro):
    return asyncio.run(coro)


# ─── 1. Authenticated Patient & Billing & Clinic Settings Requests ──────────

def test_1_authenticated_patient_request_succeeds_in_dev(monkeypatch):
    """
    Valid authenticated user with correct clinic_id receives 200 on /patients.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    headers = {"Authorization": "Bearer dev_mock_id_token"}
    response = client.get("/api/v1/patients?clinic_id=cln_e2e_test_clinic", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_2_authenticated_billing_request_succeeds_in_dev(monkeypatch):
    """
    Valid authenticated user with correct clinic_id receives 200 on /billing/today.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    headers = {"Authorization": "Bearer dev_mock_id_token"}
    response = client.get("/api/v1/billing/today?clinic_id=cln_e2e_test_clinic", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_billed_rupees" in data
    assert "total_collected_rupees" in data


def test_3_authenticated_clinic_settings_succeeds_in_dev(monkeypatch):
    """
    Valid authenticated user receives 200 on /clinics/settings with clinic metadata.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    headers = {"Authorization": "Bearer dev_mock_id_token"}
    response = client.get("/api/v1/clinics/settings", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["clinic_id"] == "cln_e2e_test_clinic"
    assert "consultation_fees" in data


# ─── 2. Missing Authorization Header → 401 ───────────────────────────────────

def test_4_missing_authorization_rejected_with_401():
    """
    Unauthenticated request without Authorization header is rejected with 401.
    """
    response = client.get("/api/v1/patients?clinic_id=cln_e2e_test_clinic")
    assert response.status_code == 401
    assert "Authorization header missing" in response.json()["detail"]

    response_billing = client.get("/api/v1/billing/today?clinic_id=cln_e2e_test_clinic")
    assert response_billing.status_code == 401

    response_settings = client.get("/api/v1/clinics/settings")
    assert response_settings.status_code == 401


def test_5_invalid_auth_scheme_rejected_with_401():
    """
    Non-Bearer authorization scheme is rejected with 401.
    """
    response = client.get("/api/v1/patients?clinic_id=cln_e2e_test_clinic", headers={"Authorization": "Basic dXNlcjpwYXNz"})
    assert response.status_code == 401
    assert "Must be Bearer token" in response.json()["detail"]


# ─── 3. Invalid / Expired Firebase Tokens → 401 ──────────────────────────────

def test_6_invalid_firebase_token_rejected_with_401(monkeypatch):
    """
    Forged or malformed Firebase JWT is rejected with 401.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    with patch("firebase_admin.auth.verify_id_token", side_effect=firebase_auth.InvalidIdTokenError("Invalid token")):
        with pytest.raises(HTTPException) as exc:
            _run(get_current_user(authorization="Bearer forged_token_xyz"))
        assert exc.value.status_code == 401
        assert "Invalid or malformed" in exc.value.detail


def test_7_expired_firebase_token_rejected_with_401(monkeypatch):
    """
    Expired Firebase JWT is rejected with 401.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    with patch("firebase_admin.auth.verify_id_token", side_effect=firebase_auth.ExpiredIdTokenError("Expired", None)):
        with pytest.raises(HTTPException) as exc:
            _run(get_current_user(authorization="Bearer expired_token_xyz"))
        assert exc.value.status_code == 401
        assert "expired" in exc.value.detail


# ─── 4. Valid Firebase User Without Clinic Membership → 403 ─────────────────

def test_8_valid_token_without_clinic_membership_rejected_with_403(monkeypatch):
    """
    A valid Firebase user who has not been mapped to any clinic receives 403 Forbidden.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    mock_decoded = {
        "uid": "unonboarded_user_999",
        "phone_number": "+919999999999",
        # No clinic_id claim in JWT
    }
    with patch("firebase_admin.auth.verify_id_token", return_value=mock_decoded):
        # Also ensure no clinic_users doc in Firestore
        user = _run(get_current_user(authorization="Bearer valid_jwt_no_clinic"))
        assert user["clinic_id"] is None

        with pytest.raises(HTTPException) as exc:
            verify_clinic_access("cln_target_clinic", current_user=user)
        assert exc.value.status_code == 403
        assert "No clinic associated" in exc.value.detail


# ─── 5. Cross-Tenant Tampered Clinic ID → 403 ───────────────────────────────

def test_9_cross_tenant_tampering_rejected_with_403(monkeypatch):
    """
    An authenticated doctor of clinic A attempting to access clinic B is strictly rejected with 403.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    headers = {"Authorization": "Bearer dev_mock_id_token"}  # authenticated for cln_e2e_test_clinic
    
    # Attempting to access cln_other_tenant_clinic
    response = client.get("/api/v1/patients?clinic_id=cln_other_tenant_clinic", headers=headers)
    assert response.status_code == 403
    assert "Access denied" in response.json()["detail"]

    response_billing = client.get("/api/v1/billing/today?clinic_id=cln_other_tenant_clinic", headers=headers)
    assert response_billing.status_code == 403


# ─── 6. Firestore Fallback for Valid JWT Lacking Custom Claims ───────────────

def test_10_jwt_without_claim_resolves_via_firestore_and_allows_only_mapped_clinic(monkeypatch):
    """
    When custom claim is not yet in JWT, backend resolves membership from Firestore clinic_users/{uid}.
    Access is granted for the server-side mapped clinic, and denied for any other clinic.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    
    # 1. Provision Firestore mapping for uid_doctor_resolved
    _run(set_document("clinic_users", "uid_doctor_resolved", {
        "clinic_id": "cln_server_resolved_001",
        "doctor_name": "Dr. Resolved",
        "role": "doctor"
    }))

    mock_decoded = {
        "uid": "uid_doctor_resolved",
        "phone_number": "+919876543210"
        # No clinic_id in JWT claims
    }

    with patch("firebase_admin.auth.verify_id_token", return_value=mock_decoded):
        user = _run(get_current_user(authorization="Bearer valid_jwt_without_claim"))
        assert user["clinic_id"] == "cln_server_resolved_001"
        assert user["role"] == "doctor"

        # Matching clinic access succeeds
        verified = verify_clinic_access("cln_server_resolved_001", current_user=user)
        assert verified["clinic_id"] == "cln_server_resolved_001"

        # Cross-tenant access is rejected
        with pytest.raises(HTTPException) as exc:
            verify_clinic_access("cln_other_tenant_999", current_user=user)
        assert exc.value.status_code == 403


# ─── 7. Production Mode Disallows Dev Tokens ─────────────────────────────────

def test_11_production_mode_strictly_rejects_dev_mock_tokens(monkeypatch):
    """
    In production (ENVIRONMENT=production), dev tokens are rejected with 401.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    with patch("firebase_admin.auth.verify_id_token", side_effect=firebase_auth.InvalidIdTokenError("Invalid token")):
        with pytest.raises(HTTPException) as exc:
            _run(get_current_user(authorization="Bearer dev_mock_id_token"))
        assert exc.value.status_code == 401
