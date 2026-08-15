"""Shared pytest fixtures and path setup for the VaidyaAI backend test suite.

Ensures the backend package root is importable regardless of the pytest
invocation directory, and provides small helpers for security tests.
"""
import asyncio
import os
import sys
import uuid

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture(scope="session", autouse=True)
def _test_database_lifecycle():
    """Create the relational schema and seed the canonical test clinic once per
    test session.

    The FastAPI lifespan (which normally calls ``init_db``) is NOT triggered by a
    module-level ``TestClient(app)`` created without a context manager, so in a
    clean CI runner the SQLite ``clinics`` table would never be created before a
    billing/analytics endpoint queries it. This fixture guarantees the schema
    exists and the ``cln_e2e_test_clinic`` row is present before any test runs,
    using the same ``DATABASE_URL`` the application engine was built with.
    """
    from database.postgres import init_db, AsyncSessionFactory
    from models.clinic import Clinic
    from sqlalchemy import select

    asyncio.run(init_db())

    async def _seed_clinic():
        async with AsyncSessionFactory() as db:
            res = await db.execute(
                select(Clinic).where(Clinic.firebase_clinic_id == "cln_e2e_test_clinic")
            )
            if not res.scalar_one_or_none():
                db.add(
                    Clinic(
                        id=uuid.uuid4(),
                        firebase_clinic_id="cln_e2e_test_clinic",
                        name="Tirupati General Clinic",
                        doctor_name="Dr. Test",
                        phone="+919999999999",
                        whatsapp_phone_id="test_whatsapp_phone_id",
                        speciality="General Medicine",
                        subscription_plan="essential",
                        is_active=True,
                        onboarding_complete=True,
                    )
                )
                await db.commit()

    asyncio.run(_seed_clinic())
    yield


@pytest.fixture(autouse=True)
def default_test_environment(monkeypatch):
    """Ensure tests run in development posture with isolated in-memory store by default."""
    from config import settings
    import database.firestore as fs

    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(fs, "_db", None)
    fs._in_memory_store.clear()
    return settings


@pytest.fixture
def production_settings(monkeypatch):
    """Force settings into a production posture for fail-closed assertions."""
    from config import settings

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    return settings


@pytest.fixture
def development_settings(monkeypatch):
    """Force settings into a development posture for mock-fallback assertions."""
    from config import settings

    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    return settings
