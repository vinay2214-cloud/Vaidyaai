"""Tests for LLM fail-closed behavior (C-4 / H-2).

The Gemini service must degrade to a mock response only in development and must
raise (fail closed) in any other environment when no model is available.
"""
import asyncio

import pytest

from services.gemini import GeminiService


def _run(coro):
    return asyncio.run(coro)


def test_generate_raises_when_unavailable_in_production(monkeypatch):
    from config import settings

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "GOOGLE_GENAI_USE_VERTEXAI", False)
    svc = GeminiService()

    with pytest.raises(RuntimeError):
        _run(svc.generate("any prompt"))


def test_generate_does_not_import_vertex_when_disabled(monkeypatch):
    """Regression: when GOOGLE_GENAI_USE_VERTEXAI=False the service must fail
    closed WITHOUT attempting to import/initialize the heavyweight Vertex SDK."""
    from config import settings
    import services.gemini as gemini_mod

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "GOOGLE_GENAI_USE_VERTEXAI", False)
    monkeypatch.setattr(settings, "AI_ALLOW_MOCK_FALLBACK", True)
    svc = GeminiService()

    # Reset the module-level import flag so this test measures this call only.
    monkeypatch.setattr(gemini_mod, "_vertex_import_attempted", False)

    with pytest.raises(RuntimeError):
        _run(svc.generate("any prompt"))

    # The heavyweight Vertex SDK must never have been imported on this path.
    assert gemini_mod._vertex_import_attempted is False


def test_generate_uses_mock_in_development(monkeypatch):
    from config import settings

    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "LIVE_CLINICAL_AI", False)
    monkeypatch.setattr(settings, "AI_ALLOW_MOCK_FALLBACK", True)
    monkeypatch.setattr(settings, "GOOGLE_GENAI_USE_VERTEXAI", False)
    svc = GeminiService()
    svc.models = {}  # simulate no configured model

    result = _run(svc.generate("appointment intent please"))
    assert isinstance(result, str)
    assert len(result) > 0
