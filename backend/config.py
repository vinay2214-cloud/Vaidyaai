import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App Config
    PROJECT_NAME: str = "VaidyaAI Agents API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")
    
    # GCP Config
    GOOGLE_CLOUD_PROJECT: str = os.getenv("GOOGLE_CLOUD_PROJECT", "vaidyaai-xprize")
    GCP_REGION: str = os.getenv("GCP_REGION", "asia-south1")
    GCS_BUCKET_CONSULTATIONS: str = os.getenv("GCS_BUCKET_CONSULTATIONS", "vaidyaai-xprize-consultations")
    GOOGLE_GENAI_USE_VERTEXAI: bool = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "true").lower() in ["true", "1", "yes"]
    LLM_REQUEST_TIMEOUT_SECONDS: float = float(os.getenv("LLM_REQUEST_TIMEOUT_SECONDS", "30"))
    
    # Firebase Config
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "vaidyaai-xprize")
    
    # WhatsApp Config
    WHATSAPP_PHONE_ID: str = os.getenv("WHATSAPP_PHONE_ID", "placeholder_phone_id")
    WHATSAPP_ACCESS_TOKEN: str = os.getenv("WHATSAPP_ACCESS_TOKEN", "placeholder_token")
    WHATSAPP_VERIFY_TOKEN: str = os.getenv("WHATSAPP_VERIFY_TOKEN", "vaidyaai_webhook_verify_2026")
    WHATSAPP_APP_SECRET: str = os.getenv("WHATSAPP_APP_SECRET", "placeholder_app_secret")
    
    # Razorpay Config
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "rzp_live_placeholder")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "placeholder_secret")
    RAZORPAY_WEBHOOK_SECRET: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "placeholder_webhook_secret")
    
    # Database Config
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite+aiosqlite:///./test.db"
    )
    
    # Internal task/scheduler authentication (Cloud Tasks / Cloud Scheduler shared secret)
    INTERNAL_TASK_SECRET: str = os.getenv("INTERNAL_TASK_SECRET", "placeholder_internal_secret")

    # Cloud Tasks Config
    CLOUD_TASKS_LOCATION: str = os.getenv("CLOUD_TASKS_LOCATION", "asia-south1")
    CLOUD_TASKS_QUEUE_REMINDERS: str = os.getenv("CLOUD_TASKS_QUEUE_REMINDERS", "appointment-reminders")
    CLOUD_TASKS_QUEUE_BILLING: str = os.getenv("CLOUD_TASKS_QUEUE_BILLING", "billing-followups")
    CLOUD_TASKS_QUEUE_RETENTION: str = os.getenv("CLOUD_TASKS_QUEUE_RETENTION", "retention-outreach")
    
    # Backend URL
    BACKEND_URL: str = os.getenv("BACKEND_URL", "https://vaidyaai-backend-placeholder.run.app")
    
    # CORS Config
    CORS_ORIGINS_RAW: str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS_RAW.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT.strip().lower() in ("development", "dev", "local", "test")

    def production_config_errors(self) -> List[str]:
        """Return misconfigurations that make the current settings unsafe for production."""
        errors: List[str] = []

        if self.DATABASE_URL.strip().lower().startswith("sqlite"):
            errors.append(
                "DATABASE_URL must point to a managed database (e.g. PostgreSQL), not SQLite."
            )

        placeholder_fields = {
            "INTERNAL_TASK_SECRET": self.INTERNAL_TASK_SECRET,
            "WHATSAPP_PHONE_ID": self.WHATSAPP_PHONE_ID,
            "WHATSAPP_ACCESS_TOKEN": self.WHATSAPP_ACCESS_TOKEN,
            "WHATSAPP_APP_SECRET": self.WHATSAPP_APP_SECRET,
            "RAZORPAY_KEY_ID": self.RAZORPAY_KEY_ID,
            "RAZORPAY_KEY_SECRET": self.RAZORPAY_KEY_SECRET,
            "RAZORPAY_WEBHOOK_SECRET": self.RAZORPAY_WEBHOOK_SECRET,
        }
        for name, value in placeholder_fields.items():
            if not value or "placeholder" in value.lower():
                errors.append(f"{name} is unset or still using a placeholder value.")

        return errors

    def validate_production(self) -> None:
        """Raise RuntimeError if configuration is unsafe when ENVIRONMENT=production."""
        if not self.is_production:
            return
        errors = self.production_config_errors()
        if errors:
            raise RuntimeError(
                "Refusing to start in production with invalid configuration:\n- "
                + "\n- ".join(errors)
            )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
