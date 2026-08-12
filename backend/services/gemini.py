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

_current_vertex_location: Optional[str] = None
_last_live_execution: Dict[str, Any] = {
    "timestamp": None,
    "model": None,
    "location": None,
    "latency_ms": None,
    "status": "idle",
    "error": None
}


def _ensure_vertex(location: str):
    """Initializes Vertex AI for a specific regional endpoint if not already configured for it."""
    global _current_vertex_location
    if vertexai is not None and settings.GOOGLE_GENAI_USE_VERTEXAI:
        if _current_vertex_location != location:
            try:
                vertexai.init(
                    project=settings.GOOGLE_CLOUD_PROJECT,
                    location=location
                )
                _current_vertex_location = location
                logger.info(f"Vertex AI initialized for project '{settings.GOOGLE_CLOUD_PROJECT}' in region '{location}' using ADC.")
            except Exception as e:
                logger.warning(f"Vertex AI initialization warning for region '{location}': {e}")


class GeminiService:
    def __init__(self):
        # Configure model locations and generation configs
        self.model_locations: Dict[str, str] = {
            settings.GEMINI_REASONING_MODEL: settings.GEMINI_REASONING_LOCATION,
            "gemini-2.5-pro": settings.GEMINI_REASONING_LOCATION,
            settings.GEMINI_FAST_MODEL: settings.GEMINI_FAST_LOCATION,
            "gemini-2.5-flash": settings.GEMINI_FAST_LOCATION,
        }

    def _get_generation_config(self, model_name: str) -> Optional[Any]:
        if GenerationConfig is None:
            return None
        if "pro" in model_name.lower():
            return GenerationConfig(
                temperature=settings.GEMINI_TEMPERATURE_CLINICAL,
                top_p=settings.GEMINI_TOP_P,
                max_output_tokens=settings.GEMINI_MAX_OUTPUT_TOKENS
            )
        return GenerationConfig(
            temperature=settings.GEMINI_TEMPERATURE_FAST,
            top_p=0.95,
            max_output_tokens=2048
        )

    def get_status(self) -> Dict[str, Any]:
        """Returns Vertex AI readiness status and model configuration."""
        return {
            "sdk_installed": vertexai is not None,
            "vertex_initialized": _current_vertex_location is not None,
            "project_id": settings.GOOGLE_CLOUD_PROJECT,
            "reasoning_model": settings.GEMINI_REASONING_MODEL,
            "reasoning_location": settings.GEMINI_REASONING_LOCATION,
            "fast_model": settings.GEMINI_FAST_MODEL,
            "fast_location": settings.GEMINI_FAST_LOCATION,
            "live_clinical_ai": settings.LIVE_CLINICAL_AI,
            "allow_mock_fallback": settings.AI_ALLOW_MOCK_FALLBACK and settings.is_development and not settings.LIVE_CLINICAL_AI,
            "models_available": list(self.model_locations.keys())
        }

    def get_live_status(self) -> Dict[str, Any]:
        """Returns truthful status for live AI verification endpoint."""
        return {
            "vertex_ai_initialized": _current_vertex_location is not None,
            "authentication": "valid" if _current_vertex_location is not None else "unconfigured",
            "reasoning_model": settings.GEMINI_REASONING_MODEL,
            "reasoning_location": settings.GEMINI_REASONING_LOCATION,
            "fast_model": settings.GEMINI_FAST_MODEL,
            "fast_location": settings.GEMINI_FAST_LOCATION,
            "last_live_execution": _last_live_execution.get("timestamp"),
            "last_live_model": _last_live_execution.get("model"),
            "last_live_location": _last_live_execution.get("location"),
            "last_live_latency_ms": _last_live_execution.get("latency_ms"),
            "last_execution_status": _last_live_execution.get("status", "idle"),
            "live_clinical_ai_enabled": settings.LIVE_CLINICAL_AI,
            "mock_fallback_allowed": settings.AI_ALLOW_MOCK_FALLBACK and settings.is_development and not settings.LIVE_CLINICAL_AI
        }

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: Optional[str] = None
    ) -> str:
        import time
        from datetime import datetime, timezone
        target_model = model or settings.GEMINI_FAST_MODEL
        target_location = self.model_locations.get(target_model, settings.GEMINI_FAST_LOCATION)

        # Non-negotiable Live Clinical AI check
        can_use_mock = (
            settings.AI_ALLOW_MOCK_FALLBACK and
            settings.is_development and
            not settings.LIVE_CLINICAL_AI
        )

        if vertexai is None or GenerativeModel is None or not settings.GOOGLE_GENAI_USE_VERTEXAI:
            if can_use_mock:
                logger.warning(f"Vertex AI unavailable. Using developer mock fallback (AI_ALLOW_MOCK_FALLBACK=true).")
                return self._mock_fallback_response(prompt)
            logger.error(f"Vertex AI unavailable for model '{target_model}' in live mode.")
            raise RuntimeError(f"Vertex AI SDK or configuration unavailable for '{target_model}'. Live AI execution required.")

        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        gen_config = self._get_generation_config(target_model)

        last_error: Optional[Exception] = None
        start_t = time.monotonic()
        timeout_val = 55.0 if "pro" in target_model.lower() else 25.0

        for attempt in range(2):
            try:
                # Ensure Vertex AI client is set for target region
                _ensure_vertex(target_location)
                generative_model = GenerativeModel(target_model, generation_config=gen_config)

                if hasattr(generative_model, "generate_content_async"):
                    response = await asyncio.wait_for(
                        generative_model.generate_content_async(full_prompt),
                        timeout=timeout_val
                    )
                else:
                    response = await asyncio.wait_for(
                        asyncio.to_thread(
                            generative_model.generate_content, full_prompt
                        ),
                        timeout=timeout_val
                    )

                latency_ms = int((time.monotonic() - start_t) * 1000)
                # Update live telemetry metrics
                _last_live_execution["timestamp"] = datetime.now(timezone.utc).isoformat()
                _last_live_execution["model"] = target_model
                _last_live_execution["location"] = target_location
                _last_live_execution["latency_ms"] = latency_ms
                _last_live_execution["status"] = "success"
                _last_live_execution["error"] = None
                _last_live_execution["attempt_count"] = attempt + 1

                finish_reason = "STOP"
                if hasattr(response, "candidates") and response.candidates:
                    c0 = response.candidates[0]
                    if hasattr(c0, "finish_reason"):
                        finish_reason = str(c0.finish_reason)
                _last_live_execution["finish_reason"] = finish_reason

                usage_meta = None
                if hasattr(response, "usage_metadata") and response.usage_metadata:
                    um = response.usage_metadata
                    usage_meta = {
                        "prompt_token_count": getattr(um, "prompt_token_count", None),
                        "candidates_token_count": getattr(um, "candidates_token_count", None),
                        "total_token_count": getattr(um, "total_token_count", None)
                    }
                _last_live_execution["usage_metadata"] = usage_meta

                return response.text.strip()
            except asyncio.TimeoutError as e:
                last_error = e
                logger.warning(f"Gemini call attempt {attempt + 1} timed out for model {target_model} @ {target_location} after {timeout_val}s")
                if attempt < 1:
                    await asyncio.sleep(0.5)
            except Exception as e:
                last_error = e
                logger.warning(f"Gemini call attempt {attempt + 1} failed for {target_model} @ {target_location}: {e}")
                if attempt < 1:
                    await asyncio.sleep(0.5)

        # All retries exhausted
        latency_ms = int((time.monotonic() - start_t) * 1000)
        _last_live_execution["timestamp"] = datetime.now(timezone.utc).isoformat()
        _last_live_execution["model"] = target_model
        _last_live_execution["location"] = target_location
        _last_live_execution["latency_ms"] = latency_ms
        _last_live_execution["status"] = "failed"
        _last_live_execution["error"] = str(last_error)

        if can_use_mock:
            logger.warning(f"Gemini {target_model} call failed after retries. Using dev mock fallback (AI_ALLOW_MOCK_FALLBACK=true).")
            return self._mock_fallback_response(prompt)

        logger.error(f"Live Gemini inference failed after retries for '{target_model}' @ '{target_location}': {last_error}")
        raise RuntimeError(f"Live Gemini inference failed for model '{target_model}' @ '{target_location}': {last_error}")

    def _mock_fallback_response(self, prompt: str) -> str:
        """Dynamic contextual fallback responses when LLM credentials are not present locally."""
        p_lower = prompt.lower()
        if "insight" in p_lower:
            return json.dumps({
                "health_score": 94,
                "executive_summary": "Strong clinical operations performance with 94% retention rate and healthy throughput.",
                "growth_recommendations": ["Expand Saturday morning slots", "Implement digital lab report review"],
                "whatsapp_report_text": "Weekly briefing: 42 appointments completed, ₹18,500 collected via Razorpay UPI."
            })
        elif "intent" in p_lower or "appointment" in p_lower:
            return json.dumps({
                "intent": "book_appointment",
                "confidence": 0.96,
                "slot_date": "2026-08-09",
                "slot_time_str": "10:30 AM",
                "language": "te"
            })
        elif "soap" in p_lower or "subjective" in p_lower:
            # Extract transcript section to avoid prompt template overlap
            transcript_section = prompt
            if "CONSULTATION TRANSCRIPT:" in prompt:
                transcript_section = prompt.split("CONSULTATION TRANSCRIPT:")[-1]
            t_lower = transcript_section.lower()

            # Stress Test Case 1: Acute Coronary Syndrome / Chest Pain
            if "chest" in t_lower or "angina" in t_lower or "cardiac" in t_lower or "heart" in t_lower:
                return json.dumps({
                    "subjective": "Patient presents with acute retrosternal crushing chest pain radiating to left arm and jaw for 1 hour, accompanied by diaphoresis and breathlessness.",
                    "objective": "BP 148/92 mmHg, HR 96 bpm, SpO2 95% on room air. Temp 98.4°F. ECG shows ST-segment elevation in anterior leads V1-V4.",
                    "assessment": "Acute Anterior Wall ST-Elevation Myocardial Infarction (STEMI)",
                    "plan": "Stat loading: Aspirin 300mg chewable + Clopidogrel 300mg + Atorvastatin 80mg. Immediate emergency transfer to Cath Lab for Primary PCI.",
                    "diagnoses": [{"code": "I21.0", "description": "ST elevation myocardial infarction involving anterior wall", "confidence": 0.98}],
                    "medications": [
                        {"drug_name": "Aspirin", "dosage": "300mg", "frequency": "Stat", "duration": "1 day", "instructions": "Chew immediately"},
                        {"drug_name": "Clopidogrel", "dosage": "300mg", "frequency": "Stat", "duration": "1 day", "instructions": "Take immediately"},
                        {"drug_name": "Atorvastatin", "dosage": "80mg", "frequency": "0-0-1", "duration": "30 days", "instructions": "At bedtime"}
                    ],
                    "investigations": ["Emergency 12-Lead ECG", "Serum Troponin I / T", "Echocardiography (Bedside)"],
                    "referrals": [{"speciality": "Interventional Cardiology", "urgency": "emergency", "reason": "Immediate Primary Percutaneous Coronary Intervention"}],
                    "followup_days": 1
                })
            # Stress Test Case 2: Type-2 Diabetes Mellitus
            elif "diabet" in t_lower or "glucose" in t_lower or "hba1c" in t_lower or "sugar" in t_lower:
                return json.dumps({
                    "subjective": "Patient presents for quarterly Type-2 Diabetes review. Reports mild polyuria, fatigue, compliant with oral hypoglycemic agents.",
                    "objective": "BP 128/78 mmHg, HR 74 bpm, Weight 74 kg. Fasting blood sugar: 146 mg/dL, HbA1c: 7.8%. Monofilament sensory foot examination normal.",
                    "assessment": "Type 2 Diabetes Mellitus without complications, suboptimally controlled",
                    "plan": "Continue Metformin 500mg BD. Add Teneligliptin 20mg OD. Low glycemic index diabetic diet and 30 minutes daily brisk walking.",
                    "diagnoses": [{"code": "E11.9", "description": "Type 2 diabetes mellitus without complications", "confidence": 0.96}],
                    "medications": [
                        {"drug_name": "Metformin", "dosage": "500mg", "frequency": "1-0-1", "duration": "90 days", "instructions": "With meals"},
                        {"drug_name": "Teneligliptin", "dosage": "20mg", "frequency": "1-0-0", "duration": "90 days", "instructions": "Before breakfast"}
                    ],
                    "investigations": ["HbA1c", "Serum Creatinine & eGFR", "Urine Spot Microalbumin / Creatinine Ratio", "Lipid Profile"],
                    "referrals": [{"speciality": "Ophthalmology / Diabetic Retinopathy", "urgency": "routine", "reason": "Annual dilated fundus examination"}],
                    "followup_days": 90
                })
            # Stress Test Case 3: Bronchial Asthma / COPD
            elif "asthma" in t_lower or "wheez" in t_lower or "breathless" in t_lower or "copd" in t_lower:
                return json.dumps({
                    "subjective": "Patient reports worsening nocturnal cough, bilateral wheezing, and shortness of breath triggered by dust and cold weather for 3 days.",
                    "objective": "BP 124/80 mmHg, HR 88 bpm, SpO2 96% on room air, RR 22/min. Auscultation reveals bilateral expiratory polyphonic wheeze.",
                    "assessment": "Acute Exacerbation of Moderate Persistent Bronchial Asthma",
                    "plan": "Budesonide + Formoterol (200/6 mcg) 2 puffs BD via MDI with spacer. Salbutamol 100 mcg MDI 2 puffs PRN for acute breathlessness.",
                    "diagnoses": [{"code": "J45.41", "description": "Moderate persistent asthma with (acute) exacerbation", "confidence": 0.95}],
                    "medications": [
                        {"drug_name": "Budesonide / Formoterol Inhaler", "dosage": "200/6mcg", "frequency": "2 puffs BD", "duration": "30 days", "instructions": "Inhale with spacer; rinse mouth after use"},
                        {"drug_name": "Salbutamol Inhaler", "dosage": "100mcg", "frequency": "PRN (2 puffs)", "duration": "As needed", "instructions": "For acute wheezing"}
                    ],
                    "investigations": ["Spirometry / Peak Expiratory Flow Rate (PEFR)", "Chest X-Ray PA View"],
                    "referrals": [],
                    "followup_days": 14
                })
            # Stress Test Case 4: Acute Upper Respiratory Tract Infection (Fever & Cough)
            elif "fever" in t_lower or "cough" in t_lower or "cold" in t_lower or "throat" in t_lower or "j06" in t_lower:
                return json.dumps({
                    "subjective": "Patient complains of high-grade fever, dry cough, and generalised myalgia for 2 days. No shortness of breath or chest pain.",
                    "objective": "BP 120/80 mmHg, HR 84 bpm, Temp 101.4°F, SpO2 98%. Oropharynx mildly congested, lung fields clear to auscultation bilaterally.",
                    "assessment": "Acute Upper Respiratory Tract Infection (Viral Pharyngitis)",
                    "plan": "Prescribed Paracetamol 650mg for fever control. Steam inhalation twice daily, warm saline gargles, adequate hydration, and rest for 5 days.",
                    "diagnoses": [{"code": "J06.9", "description": "Acute upper respiratory infection, unspecified", "confidence": 0.95}],
                    "medications": [
                        {"drug_name": "Paracetamol", "dosage": "650mg", "frequency": "1-0-1", "duration": "5 days", "instructions": "After food for fever > 100°F"}
                    ],
                    "investigations": ["Complete Blood Count (CBC) with Differential", "Rapid Malaria Antigen / Dengue NS1 (if fever persists > 3 days)"],
                    "referrals": [],
                    "followup_days": 5
                })
            # Stress Test Case 5: Essential Hypertension
            elif "hypertens" in t_lower or "blood pressure" in t_lower or "bp " in t_lower or "headache" in t_lower:
                return json.dumps({
                    "subjective": "Patient presents for routine hypertension follow-up. Reports occasional occipital morning headaches, no visual disturbances or chest pain.",
                    "objective": "BP 154/96 mmHg (Right arm, sitting), HR 78 bpm. Fundoscopy: Grade 1 hypertensive retinopathy. Systemic exam clear.",
                    "assessment": "Essential (Primary) Hypertension - Stage 2 Uncontrolled",
                    "plan": "Increase Telmisartan from 40mg to 80mg OD. Add Amlodipine 5mg OD. Strict low-salt diet (<5g/day), weight management, daily BP log.",
                    "diagnoses": [{"code": "I10", "description": "Essential (primary) hypertension", "confidence": 0.97}],
                    "medications": [
                        {"drug_name": "Telmisartan", "dosage": "80mg", "frequency": "1-0-0", "duration": "60 days", "instructions": "Morning after food"},
                        {"drug_name": "Amlodipine", "dosage": "5mg", "frequency": "0-0-1", "duration": "60 days", "instructions": "At bedtime"}
                    ],
                    "investigations": ["Serum Electrolytes (Sodium, Potassium)", "Renal Function Test", "Electrocardiogram (ECG)"],
                    "referrals": [],
                    "followup_days": 30
                })
            else:
                # Standard clinical fallback for general medical triage
                return json.dumps({
                    "subjective": "Patient presents for general outpatient consultation. Reports mild fatigue and malaise for 3 days.",
                    "objective": "BP 120/80 mmHg, HR 78 bpm, Temp 98.6°F, SpO2 99%. General physical examination unremarkable.",
                    "assessment": "General Outpatient Clinical Evaluation",
                    "plan": "Symptomatic care, oral rehydration, multivitamins, and rest.",
                    "diagnoses": [{"code": "R69", "description": "Illness, unspecified", "confidence": 0.90}],
                    "medications": [
                        {"drug_name": "Multivitamin & Mineral Complex", "dosage": "1 Tab", "frequency": "1-0-0", "duration": "10 days", "instructions": "After food"}
                    ],
                    "investigations": ["Complete Blood Count (CBC)"],
                    "referrals": [],
                    "followup_days": 7
                })
        elif "safety" in p_lower or "drug" in p_lower:
            return json.dumps({
                "is_safe": True,
                "confidence_score": 0.97,
                "warnings": [],
                "safety_summary": "Prescription safety verified: No critical drug-drug interactions or allergy conflicts detected."
            })
        elif "retention" in p_lower or "outreach" in p_lower:
            return json.dumps({
                "message": "Namaste! Dr. Ramesh garu from VaidyaAI Clinic is checking in on your recovery. Please reply if you need medication renewal or doctor consultation.",
                "priority_score": 0.88,
                "outreach_type": "followup_review",
                "suggested_action": "Schedule follow-up review"
            })
        elif "referral" in p_lower:
            return json.dumps({
                "is_referral_needed": True,
                "speciality": "Specialist Consultation",
                "urgency": "routine",
                "clinical_summary": "Patient requires specialist diagnostic and management review.",
                "reason_for_referral": "Tertiary evaluation and specialized care coordination.",
                "formal_referral_letter": "Dear Colleague,\n\nReferred patient for specialized diagnostic evaluation and clinical management.\n\nThank you,\nDr. Ramesh"
            })
        return json.dumps({"status": "success"})

    async def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        raw = await self.generate(prompt, system_prompt, model)
        text = raw.strip()

        # 1. Direct JSON parse
        try:
            return json.loads(text)
        except Exception:
            pass

        # 2. Extract ```json ... ``` code fence if present
        fence_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
        if fence_match:
            try:
                return json.loads(fence_match.group(1).strip())
            except Exception:
                pass

        # 3. Extract outermost { ... }
        brace_match = re.search(r'(\{[\s\S]*\})', text)
        if brace_match:
            try:
                return json.loads(brace_match.group(1).strip())
            except Exception:
                pass

        # 4. Strip stray backticks
        clean = re.sub(r'```(?:json)?\n?', '', text).strip().rstrip('```').strip()
        try:
            return json.loads(clean)
        except Exception:
            pass

        # Fail closed: never fabricate a success-shaped payload from an unparseable response
        logger.error(f"Unable to parse JSON from LLM response (first 200 chars): {text[:200]!r}")
        raise ValueError("LLM returned an unparseable JSON response")
