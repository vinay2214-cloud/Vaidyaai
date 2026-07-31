import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, Any

logger = logging.getLogger("vaidyaai.utils.agent_logger")

try:
    import google.cloud.logging
    cloud_client = google.cloud.logging.Client()
    gcp_logger = cloud_client.logger("vaidyaai-agents")
except Exception as e:
    logger.debug(f"Google Cloud Logging client not active: {e}")
    gcp_logger = None


def _log_to_gcp_sync(cloud_payload: Dict[str, Any], agent_name: str, clinic_id: str, success: bool):
    if gcp_logger:
        gcp_logger.log_struct(
            cloud_payload,
            severity="INFO" if success else "ERROR",
            labels={"agent": agent_name, "clinic_id": clinic_id}
        )


class AgentLogger:
    def __init__(self, agent_name: str):
        self.agent_name = agent_name

    async def log_decision(
        self,
        decision_type: str,
        decision_made: str,
        clinic_id: str,
        input_summary: str = "",
        output_summary: str = "",
        model_used: str = "gemini-1.5-flash",
        latency_ms: int = 0,
        patient_phone_masked: Optional[str] = None,
        appointment_id: Optional[str] = None,
        consultation_id: Optional[str] = None,
        patient_id: Optional[str] = None,
        visit_id: Optional[str] = None,
        correlation_id: Optional[str] = None,
        causation_id: Optional[str] = None,
        event_id: Optional[str] = None,
        resource: Optional[str] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        prompt_tokens: Optional[int] = None,
        completion_tokens: Optional[int] = None,
        extra: Optional[Dict[str, Any]] = None
    ):
        now = datetime.now(timezone.utc)
        extra_dict = extra or {}
        
        # Build structured payload
        payload = {
            "agent_name": self.agent_name,
            "decision_type": decision_type,
            "decision_made": decision_made,
            "clinic_id": clinic_id,
            "input_summary": input_summary,
            "output_summary": output_summary,
            "model_used": model_used,
            "latency_ms": latency_ms,
            "success": success,
            "created_at": now,
            **extra_dict
        }
        
        if patient_phone_masked:
            payload["patient_phone_masked"] = patient_phone_masked
        if appointment_id:
            payload["appointment_id"] = appointment_id
            payload["visit_id"] = appointment_id
        if visit_id:
            payload["visit_id"] = visit_id
        if consultation_id:
            payload["consultation_id"] = consultation_id
        if patient_id:
            payload["patient_id"] = patient_id
        if correlation_id:
            payload["correlation_id"] = correlation_id
        if causation_id:
            payload["causation_id"] = causation_id
        if event_id:
            payload["event_id"] = event_id
        if resource:
            payload["resource"] = resource
        if error_message:
            payload["error_message"] = error_message
        if prompt_tokens is not None:
            payload["prompt_tokens"] = prompt_tokens
        if completion_tokens is not None:
            payload["completion_tokens"] = completion_tokens

        # 1. Write to Cloud Logging (non-blocking)
        if gcp_logger:
            try:
                cloud_payload = {**payload, "created_at": now.isoformat()}
                await asyncio.to_thread(_log_to_gcp_sync, cloud_payload, self.agent_name, clinic_id, success)
            except Exception as e:
                logger.error(f"Cloud Logging write failed: {e}")

        # 2. Write to Firestore agent_logs collection (or in-memory store in dev)
        try:
            from database.firestore import get_firestore_client, set_document
            db = get_firestore_client()
            if db is not None:
                await asyncio.to_thread(
                    db.collection("agent_logs").add, payload
                )
            else:
                log_id = f"log_{int(now.timestamp() * 1000)}"
                await set_document("agent_logs", log_id, payload)
        except Exception as e:
            logger.debug(f"Firestore agent_logs write error: {e}")
