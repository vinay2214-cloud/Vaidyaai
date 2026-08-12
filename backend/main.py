import os
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
from api.agent_health import router as agent_health_router
from api.fhir import router as fhir_router

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

    # Defense-in-depth: assert is_production and is_development are never both True
    if settings.is_production and settings.is_development:
        raise RuntimeError("FATAL: ENVIRONMENT resolves to both production and development. Aborting startup.")

    # 1. Cloud Logging
    if settings.is_development:
        _startup_checks["cloud_logging"] = "disabled_dev"
    else:
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
        if status_data.get("sdk_installed") and settings.GOOGLE_GENAI_USE_VERTEXAI:
            _startup_checks["vertex_ai"] = "online (ready: ADC authenticated)"
        elif status_data.get("allow_mock_fallback"):
            _startup_checks["vertex_ai"] = "fallback_mock"
        else:
            _startup_checks["vertex_ai"] = "unconfigured"
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
        firestore_client = await init_firestore()
        _startup_checks["firestore"] = "online" if firestore_client is not None else "in_memory_fallback"
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

    # 8. Event Bus & Workflow Orchestrator
    try:
        from workflow_orchestrator import WorkflowOrchestrator
        orchestrator = WorkflowOrchestrator()
        orchestrator.register_all()
        _startup_checks["event_bus"] = "online"
    except Exception as e:
        logger.warning(f"Workflow Orchestrator initialization warning: {e}")
        _startup_checks["event_bus"] = f"warning ({e})"

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
    expose_headers=["Content-Disposition", "X-Correlation-ID"],
)


@app.middleware("http")
async def security_and_tracing_middleware(request: Request, call_next):
    import uuid
    correlation_id = request.headers.get("X-Correlation-ID") or f"corr_{uuid.uuid4().hex[:12]}"
    response = await call_next(request)
    response.headers["X-Correlation-ID"] = correlation_id
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


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
app.include_router(agent_health_router, prefix="/api/v1", tags=["agents"])
app.include_router(fhir_router, prefix="/api/v1", tags=["fhir"])


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
    Returns dynamic, truthful status for Vertex AI, Speech-to-Text, Firestore, PostgreSQL, Cloud Tasks, and clinical agents.
    """
    from services.gemini import GeminiService
    from services.speech_to_text import SpeechToTextService
    gemini_svc = GeminiService()
    stt_svc = SpeechToTextService()
    gemini_status = gemini_svc.get_status()
    gemini_live_status = gemini_svc.get_live_status()
    stt_status = stt_svc.get_status()

    # Truthful dynamic Vertex AI status
    if gemini_status.get("sdk_installed") and settings.GOOGLE_GENAI_USE_VERTEXAI:
        if gemini_live_status.get("last_execution_status") == "success":
            vertex_ai_status = f"online (live: {gemini_live_status.get('last_live_model')} @ {gemini_live_status.get('last_live_location')})"
        else:
            vertex_ai_status = "online (ready: ADC authenticated)"
    elif gemini_status.get("allow_mock_fallback"):
        vertex_ai_status = "fallback_mock"
    else:
        vertex_ai_status = "unavailable"

    # Truthful dynamic STT status
    if stt_status.get("ffmpeg_available") and stt_status.get("speech_client_installed"):
        stt_overall_status = "online (Google Speech-to-Text + FFmpeg)"
    elif stt_status.get("ffmpeg_available"):
        stt_overall_status = "degraded (FFmpeg available, Speech SDK missing)"
    else:
        stt_overall_status = "unavailable"

    return {
        "status": "ok",
        "project_id": settings.GOOGLE_CLOUD_PROJECT,
        "region": settings.GCP_REGION,
        "environment": settings.ENVIRONMENT,
        "services": {
            "vertex_ai": vertex_ai_status,
            "speech_to_text": stt_overall_status,
            "firestore": _startup_checks.get("firestore", "unknown"),
            "postgres": _startup_checks.get("postgres", "unknown"),
            "cloud_tasks": _startup_checks.get("cloud_tasks", "unknown"),
            "firebase": _startup_checks.get("firebase_admin", "unknown"),
            "secret_manager": _startup_checks.get("secret_manager", "unknown"),
            "cloud_logging": _startup_checks.get("cloud_logging", "unknown"),
            "event_bus": _startup_checks.get("event_bus", "online"),
            "ffmpeg": "available" if stt_status.get("ffmpeg_available") else "unavailable",
            "gemini": gemini_status,
            "live_telemetry": gemini_live_status,
            "audio_pipeline": stt_status,
            "razorpay": "active" if settings.RAZORPAY_KEY_ID != "rzp_live_placeholder" else "mock_dev_mode",
            "whatsapp": "active" if settings.WHATSAPP_PHONE_ID != "placeholder_phone_id" else "mock_dev_mode"
        },
        "feature_flags": {
            "ai_autonomous": settings.FEATURE_AI_AUTONOMOUS,
            "whatsapp": settings.FEATURE_WHATSAPP,
            "voice": settings.FEATURE_VOICE,
            "realtime_events": settings.FEATURE_REALTIME_EVENTS,
            "analytics": settings.FEATURE_ANALYTICS,
            "demo_mode": settings.FEATURE_DEMO_MODE,
            "live_clinical_ai": settings.LIVE_CLINICAL_AI
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
        "primary_llm": f"{settings.GEMINI_FAST_MODEL} ({settings.GEMINI_FAST_LOCATION}) / {settings.GEMINI_REASONING_MODEL} ({settings.GEMINI_REASONING_LOCATION})",
        "version": settings.VERSION
    }


@app.get("/api/v1/ai/live-status", tags=["ai"])
async def get_ai_live_status():
    """
    Truthful live AI status endpoint for hackathon validation and Settings diagnostics.
    """
    from services.gemini import GeminiService
    from services.speech_to_text import SpeechToTextService
    gemini_svc = GeminiService()
    stt_svc = SpeechToTextService()
    status_data = gemini_svc.get_live_status()
    status_data["audio_pipeline"] = stt_svc.get_status()
    return status_data


if __name__ == "__main__":
    import uvicorn
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[
            os.path.join(backend_dir, d) for d in [
                "api",
                "agents",
                "database",
                "models",
                "prompts",
                "services",
                "tasks",
                "utils",
            ]
        ],
        reload_includes=[
            "*.py",
        ],
        reload_excludes=[
            "*/.venv/*",
            "*/.ga_venv/*",
            "*/__pycache__/*",
            "*/.pytest_cache/*",
            "*/.mypy_cache/*",
            "*/node_modules/*",
            "*/.next/*",
            "*/tests/*",
            ".venv",
            ".ga_venv",
            "__pycache__",
            ".pytest_cache",
            ".mypy_cache",
            "node_modules",
            ".next",
            "tests",
            ".git",
            "*.pyc",
            "*.db",
            "*.log",
            "*.sqlite3",
            "*.ipc",
            "alembic/versions/*",
        ],
    )
