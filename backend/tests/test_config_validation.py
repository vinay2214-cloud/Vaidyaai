"""Tests for fail-closed production configuration validation (M-3)."""
import pytest


def test_production_rejects_placeholder_secrets_and_sqlite(production_settings):
    settings = production_settings
    errors = settings.production_config_errors()

    assert any("DATABASE_URL" in e for e in errors)
    assert any("INTERNAL_TASK_SECRET" in e for e in errors)

    with pytest.raises(RuntimeError):
        settings.validate_production()


def test_production_accepts_fully_configured_settings(production_settings, monkeypatch):
    settings = production_settings

    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql+asyncpg://user:pass@db:5432/vaidyaai")
    monkeypatch.setattr(settings, "INTERNAL_TASK_SECRET", "s3cret-internal-value")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_ID", "1234567890")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "real-access-token")
    monkeypatch.setattr(settings, "WHATSAPP_APP_SECRET", "real-app-secret")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_live_realid")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "real-razorpay-secret")
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", "real-webhook-secret")

    assert settings.production_config_errors() == []
    settings.validate_production()


def test_development_never_enforced(development_settings):
    settings = development_settings
    # No exception even though defaults are placeholders/sqlite.
    settings.validate_production()
