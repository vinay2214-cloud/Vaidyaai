"""Shared pytest fixtures and path setup for the VaidyaAI backend test suite.

Ensures the backend package root is importable regardless of the pytest
invocation directory, and provides small helpers for security tests.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


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
