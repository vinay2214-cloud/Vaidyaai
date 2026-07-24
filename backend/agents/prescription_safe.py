import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from agents.base_agent import BaseAgent
from prompts.drug_safety import build_drug_safety_prompt
from database.firestore import get_document, update_document
from utils.phone_utils import mask_phone

logger = logging.getLogger("vaidyaai.agents.prescription_safe")


class PrescriptionSafeAgent(BaseAgent):
    """
    Agent 5: PrescriptionSafe
    Autonomous real-time drug interaction checker, allergy conflict validator,
    duplicate therapy detector, and clinical safety auditor.
    """

    def __init__(self):
        super().__init__("prescription_safe")

    async def validate_prescription(
        self,
        consultation_id: str,
        clinic_id: str,
        medications: List[Dict[str, Any]],
        patient_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Validates medication list for interactions, allergy conflicts, and dose safety risks.
        Saves result to Firestore consultation document.
        """
        # Fetch patient background if available
        allergies: List[str] = []
        chronic_conditions: List[str] = []
        age: Optional[int] = None
        gender: Optional[str] = None

        if patient_id:
            patient = await get_document("patients", patient_id)
            if patient:
                allergies = patient.get("allergies", [])
                chronic_conditions = patient.get("chronic_conditions", [])
                age = patient.get("age")
                gender = patient.get("gender")

        # Build prompt & call Gemini 1.5 Flash
        prompt = build_drug_safety_prompt(
            medications=medications,
            known_allergies=allergies,
            chronic_conditions=chronic_conditions,
            patient_age=age,
            patient_gender=gender
        )

        safety_res, latency_ms = await self._timed_gemini_json_call(
            task="prescription_safety_check",
            prompt=prompt,
            model="gemini-1.5-flash"
        )

        is_safe = safety_res.get("is_safe", True)
        warnings = safety_res.get("warnings", [])
        summary = safety_res.get("safety_summary", "Prescription safety check complete.")

        now_utc = datetime.now(timezone.utc)
        safety_eval = {
            "is_safe": is_safe,
            "confidence_score": safety_res.get("confidence_score", 0.95),
            "warnings_count": len(warnings),
            "warnings": warnings,
            "safety_summary": summary,
            "evaluated_at": now_utc,
            "overridden": False
        }

        # Save to Firestore consultation document
        await update_document("consultations", consultation_id, {
            "safety_evaluation": safety_eval,
            "updated_at": now_utc
        })

        await self.logger.log_decision(
            decision_type="drug_safety_evaluated",
            decision_made=f"Evaluated {len(medications)} drugs for safety. Safe: {is_safe}. Warnings: {len(warnings)}",
            clinic_id=clinic_id,
            consultation_id=consultation_id,
            model_used="gemini-1.5-flash",
            latency_ms=latency_ms
        )

        return safety_eval

    async def override_safety_warning(
        self,
        consultation_id: str,
        clinic_id: str,
        doctor_uid: str,
        override_reason: str
    ) -> Dict[str, Any]:
        """
        Allows doctor to override safety warnings with mandatory clinical audit reason.
        """
        consultation = await get_document("consultations", consultation_id)
        if not consultation:
            return {"error": "Consultation not found"}

        now_utc = datetime.now(timezone.utc)
        safety_eval = consultation.get("safety_evaluation", {})
        safety_eval["overridden"] = True
        safety_eval["override_reason"] = override_reason
        safety_eval["overridden_by"] = doctor_uid
        safety_eval["overridden_at"] = now_utc

        await update_document("consultations", consultation_id, {
            "safety_evaluation": safety_eval,
            "updated_at": now_utc
        })

        await self.logger.log_decision(
            decision_type="drug_safety_overridden",
            decision_made=f"Doctor '{doctor_uid}' overridden safety warning for consultation {consultation_id}. Reason: {override_reason}",
            clinic_id=clinic_id,
            consultation_id=consultation_id
        )

        return {"status": "overridden", "consultation_id": consultation_id}
