import os
import pytest
from config import settings
import database.firestore as fs

def test_pytest_uses_in_memory_store_by_default():
    """Verify that during pytest execution, Firestore client returns None to use process-isolated in-memory store."""
    assert fs._should_use_in_memory_store() is True
    client = fs.get_firestore_client()
    assert client is None

def test_production_fails_fast_on_missing_credentials(monkeypatch):
    """Verify that in production mode, if Firestore client cannot be created, get_firestore_client throws a descriptive RuntimeError."""
    monkeypatch.setattr(fs, "_use_in_memory", False)
    monkeypatch.setenv("USE_IN_MEMORY_STORE", "false")
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    # Force client init exception by mocking firestore.client
    def mock_client_fail():
        raise Exception("GCP credentials missing in test sandbox")

    monkeypatch.setattr(fs.firestore, "client", mock_client_fail)
    monkeypatch.setattr(fs, "_db", None)

    with pytest.raises(RuntimeError) as exc_info:
        fs.get_firestore_client()

    assert "Production Failure" in str(exc_info.value)
