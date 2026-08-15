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
    monkeypatch.setattr(settings, "BACKEND_URL", "https://vaidya.ai")

    assert settings.production_config_errors() == []
    settings.validate_production()


def test_development_never_enforced(development_settings):
    settings = development_settings
    # No exception even though defaults are placeholders/sqlite.
    settings.validate_production()


def test_relative_sqlite_url_is_anchored_to_backend_dir():
    """A cwd-relative SQLite URL must resolve to one file regardless of cwd.

    Regression: the API server (started from backend/) and the seed script
    (started from the repo root) each created their own ./test.db, so seeded
    invoices were invisible to /billing/today.
    """
    from config import BACKEND_DIR, Settings

    resolved = Settings._anchor_relative_sqlite_path("sqlite+aiosqlite:///./test.db")
    assert resolved == f"sqlite+aiosqlite:///{BACKEND_DIR}/test.db"

    resolved_bare = Settings._anchor_relative_sqlite_path("sqlite:///data/app.db")
    assert resolved_bare == f"sqlite:///{BACKEND_DIR}/data/app.db"


@pytest.mark.parametrize(
    "url",
    [
        "sqlite+aiosqlite:///:memory:",
        "sqlite+aiosqlite:////var/lib/vaidyaai/test.db",
        "postgresql+asyncpg://user:pass@db:5432/vaidyaai",
    ],
)
def test_non_relative_database_urls_are_untouched(url):
    from config import Settings

    assert Settings._anchor_relative_sqlite_path(url) == url


def test_settings_database_url_is_absolute():
    from config import settings

    if settings.DATABASE_URL.lower().startswith("sqlite"):
        path = settings.DATABASE_URL.partition(":///")[2]
        assert path.startswith("/") or path.startswith(":memory:"), settings.DATABASE_URL
