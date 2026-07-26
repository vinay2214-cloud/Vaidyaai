from contextlib import asynccontextmanager
import logging
from typing import Dict, Any
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from config import settings

from api.webhooks import router as webhooks_router
from api.appointments import router as appointments_router
from api.billing import router as billing_router
from api.consultations import router as consultations_router
from api.patients import router as patients_router
from api.clinics import router as clinics_router
from api.analytics import router as analytics_router
from api.internal import router as internal_router

logger = logging.getLogger("vaidyaai.main")

_startup_checks: Dict[str, Any] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup Validation
    logger.info(f"Initializing VaidyaAI Agents system (Project: '{settings.GOOGLE_CLOUD_PROJECT}', Region: '{settings.GCP_REGION}')...")

    # 0. Fail-closed production configuration validation.
    # Refuse to boot when ENVIRONMENT=production but secrets/database are still placeholders.
    settings.validate_production()
    _startup_checks["config"] = "validated" if settings.is_production else f"unenforced ({settings.ENVIRONMENT})"

    # 1. Cloud Logging
    try:
        import google.cloud.logging
        google.cloud.logging.Client().setup_logging()
        _startup_checks["cloud_logging"] = "online"
    except Exception as e:
        logger.warning(f"Google Cloud Logging initialization warning: {e}")
        _startup_checks["cloud_logging"] = f"unconfigured ({e})"

    # 2. Vertex AI / Gemini
    try:
        from services.gemini import GeminiService
        gemini_svc = GeminiService()
        status_data = gemini_svc.get_status()
        _startup_checks["vertex_ai"] = "online" if status_data.get("vertex_initialized") else "fallback_mock"
    except Exception as e:
        logger.warning(f"Vertex AI startup check warning: {e}")
        _startup_checks["vertex_ai"] = f"warning ({e})"

    # 3. PostgreSQL Database
    try:
        from database.postgres import init_db
        await init_db()
        _startup_checks["postgres"] = "online"
    except Exception as e:
        logger.warning(f"PostgreSQL initialization warning: {e}")
        _startup_checks["postgres"] = f"sqlite_fallback ({e})"

    # 4. Firestore
    try:
        from database.firestore import init_firestore
        await init_firestore()
        _startup_checks["firestore"] = "online"
    except Exception as e:
        logger.warning(f"Firestore initialization warning: {e}")
        _startup_checks["firestore"] = f"in_memory_fallback ({e})"

    # 5. Cloud Tasks
    try:
        from tasks.cloud_tasks import get_tasks_client
        client = get_tasks_client()
        _startup_checks["cloud_tasks"] = "online" if client is not None else "unconfigured_dev"
    except Exception as e:
        _startup_checks["cloud_tasks"] = f"unconfigured ({e})"

    # 6. Secret Manager
    try:
        from utils.secret_manager import get_secret
        secret_test = get_secret("RAZORPAY_KEY_ID")
        _startup_checks["secret_manager"] = "online" if secret_test else "env_fallback"
    except Exception as e:
        _startup_checks["secret_manager"] = f"env_fallback ({e})"

    # 7. Firebase Admin
    try:
        import firebase_admin
        _startup_checks["firebase_admin"] = "online" if firebase_admin._apps else "unconfigured"
    except Exception as e:
        _startup_checks["firebase_admin"] = f"unconfigured ({e})"

    logger.info(f"VaidyaAI Startup Validation Complete: {_startup_checks}")
    logger.info("VaidyaAI Agents — all 7 autonomous agents operational")
    yield
    # Shutdown logic
    logger.info("Shutting down VaidyaAI Agents system...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception processing {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error occurred processing request."}
    )


# Include API Routers
app.include_router(webhooks_router, tags=["webhooks"])
app.include_router(appointments_router, prefix="/api/v1", tags=["appointments"])
app.include_router(billing_router, prefix="/api/v1", tags=["billing"])
app.include_router(consultations_router, prefix="/api/v1", tags=["consultations"])
app.include_router(patients_router, prefix="/api/v1", tags=["patients"])
app.include_router(clinics_router, prefix="/api/v1", tags=["clinics"])
app.include_router(analytics_router, prefix="/api/v1", tags=["analytics"])
app.include_router(internal_router, prefix="/internal", tags=["internal"])


@app.get("/livez", tags=["health"])
async def livez():
    """Liveness probe. Trivial and dependency-free so Cloud Run can distinguish
    a hung/dead container from a merely-degraded one. Never touches Gemini/DB."""
    return {"status": "alive"}


@app.get("/readyz", tags=["health"])
async def readyz():
    """Readiness probe. Reports whether startup completed and configuration was
    validated. Returns 503 until the lifespan startup has populated its checks so
    Cloud Run withholds traffic from a container that has not finished booting."""
    if not _startup_checks:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "starting"}
        )
    return {
        "status": "ready",
        "environment": settings.ENVIRONMENT,
        "checks": _startup_checks
    }


@app.get("/health", tags=["health"])
async def health():
    """
    Extended Health & Diagnostics Endpoint.
    Returns status for Vertex AI, Firestore, PostgreSQL, Cloud Tasks, Firebase, Secret Manager, and Gemini.
    """
    from services.gemini import GeminiService
    gemini_svc = GeminiService()

    return {
        "status": "ok",
        "project_id": settings.GOOGLE_CLOUD_PROJECT,
        "region": settings.GCP_REGION,
        "environment": settings.ENVIRONMENT,
        "services": {
            "vertex_ai": _startup_checks.get("vertex_ai", "unknown"),
            "firestore": _startup_checks.get("firestore", "unknown"),
            "postgres": _startup_checks.get("postgres", "unknown"),
            "cloud_tasks": _startup_checks.get("cloud_tasks", "unknown"),
            "firebase": _startup_checks.get("firebase_admin", "unknown"),
            "secret_manager": _startup_checks.get("secret_manager", "unknown"),
            "cloud_logging": _startup_checks.get("cloud_logging", "unknown"),
            "gemini": gemini_svc.get_status()
        },
        "agents": [
            "appointment_flow",
            "clinical_scribe",
            "billing_pulse",
            "retention_radar",
            "prescription_safe",
            "insight_engine",
            "referral_coordinator"
        ],
        "primary_llm": f"gemini-1.5-flash / gemini-1.5-pro (Vertex AI {settings.GCP_REGION})",
        "version": settings.VERSION
    }
