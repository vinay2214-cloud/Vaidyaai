import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from agents.base_agent import BaseAgent
from prompts.drug_safety import build_drug_safety_prompt
from database.firestore import get_document, update_document
from utils.phi_anonymiser import anonymise_for_llm
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
        # C-7: anonymise any PHI before it leaves for the LLM.
        prompt = anonymise_for_llm(prompt)

        now_utc = datetime.now(timezone.utc)

        # C-4: This is a safety-critical evaluation and MUST fail closed. If the
        # LLM is unavailable or returns an unusable result, do not assume the
        # prescription is safe — flag it for mandatory manual review.
        try:
            safety_res, latency_ms = await self._timed_gemini_json_call(
                task="prescription_safety_check",
                prompt=prompt,
                model="gemini-1.5-flash"
            )
        except Exception as e:
            logger.error(f"Drug safety evaluation failed; failing closed for consultation {consultation_id}: {e}")
            safety_eval = {
                "is_safe": False,
                "confidence_score": 0.0,
                "warnings_count": 1,
                "warnings": [{
                    "severity": "high",
                    "message": "Automated drug-safety check unavailable. Manual pharmacist/doctor review required before dispensing."
                }],
                "safety_summary": "Safety check could not be completed automatically. Manual review required.",
                "requires_manual_review": True,
                "evaluated_at": now_utc,
                "overridden": False
            }
            await update_document("consultations", consultation_id, {
                "safety_evaluation": safety_eval,
                "updated_at": now_utc
            })
            await self.logger.log_decision(
                decision_type="drug_safety_unavailable",
                decision_made=f"Drug safety check failed closed for {len(medications)} drugs. Manual review required.",
                clinic_id=clinic_id,
                consultation_id=consultation_id,
                model_used="gemini-1.5-flash"
            )
            return safety_eval

        # Fail closed if the model omits an explicit verdict.
        is_safe = safety_res.get("is_safe")
        if is_safe is None:
            is_safe = False
        warnings = safety_res.get("warnings", [])
        summary = safety_res.get("safety_summary", "Prescription safety check complete.")

        safety_eval = {
            "is_safe": is_safe,
            "confidence_score": safety_res.get("confidence_score", 0.0 if not is_safe else 0.95),
            "warnings_count": len(warnings),
            "warnings": warnings,
            "safety_summary": summary,
            "requires_manual_review": not is_safe,
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
