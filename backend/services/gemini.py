import os
import re
import json
import asyncio
import logging
from typing import Dict, Any, Optional

try:
    import vertexai
    from vertexai.generative_models import GenerativeModel, GenerationConfig
except ImportError:
    vertexai = None
    GenerativeModel = None
    GenerationConfig = None

from config import settings

logger = logging.getLogger("vaidyaai.services.gemini")

_vertex_initialized = False


def _init_vertex():
    global _vertex_initialized
    if not _vertex_initialized and vertexai is not None:
        try:
            if settings.GOOGLE_GENAI_USE_VERTEXAI:
                vertexai.init(
                    project=settings.GOOGLE_CLOUD_PROJECT,
                    location=settings.GCP_REGION
                )
                _vertex_initialized = True
                logger.info(f"Vertex AI initialized for project '{settings.GOOGLE_CLOUD_PROJECT}' in region '{settings.GCP_REGION}' using ADC.")
        except Exception as e:
            logger.warning(f"Vertex AI initialization warning: {e}")


class GeminiService:
    def __init__(self):
        _init_vertex()
        if GenerativeModel is not None:
            try:
                self.models = {
                    "gemini-1.5-flash": GenerativeModel(
                        "gemini-1.5-flash-001",
                        generation_config=GenerationConfig(
                            temperature=0.2,
                            top_p=0.95,
                            max_output_tokens=2048
                        )
                    ),
                    "gemini-1.5-pro": GenerativeModel(
                        "gemini-1.5-pro-001",
                        generation_config=GenerationConfig(
                            temperature=0.1,
                            top_p=0.9,
                            max_output_tokens=4096
                        )
                    )
                }
            except Exception as e:
                logger.warning(f"Could not initialize GenerativeModel instances: {e}")
                self.models = {}
        else:
            self.models = {}

    def get_status(self) -> Dict[str, Any]:
        """Returns Vertex AI readiness status."""
        return {
            "sdk_installed": vertexai is not None,
            "vertex_initialized": _vertex_initialized,
            "project_id": settings.GOOGLE_CLOUD_PROJECT,
            "region": settings.GCP_REGION,
            "use_vertexai": settings.GOOGLE_GENAI_USE_VERTEXAI,
            "models_available": list(self.models.keys()) if self.models else []
        }

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: str = "gemini-1.5-flash"
    ) -> str:
        if not self.models or model not in self.models:
            if settings.is_development:
                logger.warning(f"Vertex AI model '{model}' unavailable. Using mock fallback (development only).")
                return self._mock_fallback_response(prompt)
            logger.error(f"Vertex AI model '{model}' unavailable or unconfigured in a non-development environment.")
            raise RuntimeError(f"LLM model '{model}' is unavailable")

        model_name = model
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt

        last_error: Optional[Exception] = None
        for attempt in range(3):
            try:
                generative_model = self.models[model_name]
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        generative_model.generate_content, full_prompt
                    ),
                    timeout=settings.LLM_REQUEST_TIMEOUT_SECONDS
                )
                return response.text.strip()
            except asyncio.TimeoutError as e:
                last_error = e
                logger.warning(
                    f"Gemini call attempt {attempt + 1} timed out after "
                    f"{settings.LLM_REQUEST_TIMEOUT_SECONDS}s"
                )
                if attempt < 2:
                    await asyncio.sleep(1)
            except Exception as e:
                last_error = e
                logger.warning(f"Gemini call attempt {attempt + 1} failed: {e}")
                if attempt < 2:
                    await asyncio.sleep(1)

        # All retries exhausted. Only degrade to a mock response in development;
        # fail closed in every other environment so callers can react safely.
        if settings.is_development:
            logger.warning("Gemini call failed after retries. Using mock fallback (development only).")
            return self._mock_fallback_response(prompt)
        logger.error(f"Gemini call failed after retries in a non-development environment: {last_error}")
        raise RuntimeError(f"LLM generation failed: {last_error}")

    def _mock_fallback_response(self, prompt: str) -> str:
        """Fallback mock responses when Vertex AI credentials are not present locally."""
        p_lower = prompt.lower()
        if "intent" in p_lower or "appointment" in p_lower:
            return json.dumps({"intent": "book_appointment", "confidence": 0.95, "slot_date": "2026-07-25", "slot_time_str": "10:00 AM", "language": "te"})
        elif "soap" in p_lower or "subjective" in p_lower:
            return json.dumps({
                "subjective": "Fever & cough for 2 days",
                "objective": "BP 120/80, Temp 101F",
                "assessment": "Acute Upper Respiratory Infection",
                "plan": "Paracetamol 650mg 1-0-1 for 5 days",
                "diagnoses": [{"code": "J06.9", "description": "Acute URI", "confidence": 0.95}],
                "medications": [{"drug_name": "Paracetamol", "dosage": "650mg", "frequency": "1-0-1", "duration": "5 days", "instructions": "After food"}],
                "investigations": [],
                "referrals": [],
                "followup_days": 5
            })
        elif "safety" in p_lower or "drug" in p_lower:
            return json.dumps({"is_safe": True, "confidence_score": 0.96, "warnings": [], "safety_summary": "Prescription safety verified."})
        elif "retention" in p_lower or "outreach" in p_lower:
            return json.dumps({"message": "Namaste! Dr. Ramesh checking in.", "priority_score": 0.85, "outreach_type": "followup_review", "suggested_action": "Schedule review"})
        elif "referral" in p_lower:
            return json.dumps({"is_referral_needed": True, "speciality": "Pulmonology", "urgency": "routine", "clinical_summary": "URI", "reason_for_referral": "Specialist opinion", "formal_referral_letter": "Dear Doctor,\nReferred patient."})
        elif "insight" in p_lower or "report" in p_lower:
            return json.dumps({"health_score": 94, "executive_summary": "Strong performance", "growth_recommendations": ["Expand slots"], "whatsapp_report_text": "Weekly briefing"})
        return json.dumps({"status": "success"})

    async def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: str = "gemini-1.5-flash"
    ) -> Dict[str, Any]:
        raw = await self.generate(prompt, system_prompt, model)
        clean = re.sub(r'```(?:json)?\n?', '', raw).strip().rstrip('```').strip()
        
        try:
            return json.loads(clean)
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', clean, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass

        # Fail closed: never fabricate a success-shaped payload from an unparseable
        # response. Safety-critical callers (e.g. prescription_safe) depend on this
        # raising so they can escalate to mandatory manual review.
        logger.error(f"Unable to parse JSON from LLM response (first 200 chars): {clean[:200]!r}")
        raise ValueError("LLM returned an unparseable JSON response")
