"""Security tests for /internal/* request authentication (verify_internal_request).

Covers the C-2 fix: internal task endpoints must fail closed. These tests call
the async dependency directly via asyncio.run so no pytest-asyncio plugin or live
Firebase credentials are required.
"""
import asyncio

import pytest
from fastapi import HTTPException

from api.auth import verify_internal_request, verify_clinic_access


def _run(coro):
    return asyncio.run(coro)


def test_valid_shared_secret_passes(monkeypatch):
    from config import settings

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "INTERNAL_TASK_SECRET", "a-real-strong-secret")

    # Matching shared secret must be accepted (returns None, no raise).
    result = _run(verify_internal_request(
        x_internal_task_secret="a-real-strong-secret",
        authorization=None,
    ))
    assert result is None


def test_wrong_shared_secret_rejected(monkeypatch):
    from config import settings

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "INTERNAL_TASK_SECRET", "a-real-strong-secret")

    with pytest.raises(HTTPException) as exc:
        _run(verify_internal_request(
            x_internal_task_secret="wrong-secret",
            authorization=None,
        ))
    assert exc.value.status_code == 401


def test_missing_credentials_rejected(monkeypatch):
    from config import settings

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "INTERNAL_TASK_SECRET", "a-real-strong-secret")

    with pytest.raises(HTTPException) as exc:
        _run(verify_internal_request(x_internal_task_secret=None, authorization=None))
    assert exc.value.status_code == 401


def test_placeholder_secret_fails_closed_in_production(monkeypatch):
    from config import settings

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "INTERNAL_TASK_SECRET", "placeholder_internal_secret")

    # Even presenting the placeholder must be rejected with 503 in production.
    with pytest.raises(HTTPException) as exc:
        _run(verify_internal_request(
            x_internal_task_secret="placeholder_internal_secret",
            authorization=None,
        ))
    assert exc.value.status_code == 503


def test_clinic_access_requires_clinic():
    with pytest.raises(HTTPException) as exc:
        verify_clinic_access("cln_123", current_user={"uid": "u1", "clinic_id": None})
    assert exc.value.status_code == 403


def test_clinic_access_denies_cross_tenant():
    with pytest.raises(HTTPException) as exc:
        verify_clinic_access("cln_123", current_user={"uid": "u1", "clinic_id": "cln_999"})
    assert exc.value.status_code == 403


def test_clinic_access_allows_matching_tenant():
    user = {"uid": "u1", "clinic_id": "cln_123"}
    assert verify_clinic_access("cln_123", current_user=user) is user
