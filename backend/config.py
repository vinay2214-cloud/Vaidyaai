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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
