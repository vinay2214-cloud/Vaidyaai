import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from agents.base_agent import BaseAgent
from prompts.referral_extraction import build_referral_extraction_prompt
from database.firestore import set_document, get_document, update_document
from database.postgres import AsyncSessionFactory
from models.consultation import ReferralTracking
from services.whatsapp import WhatsAppService
from utils.phi_anonymiser import anonymise_for_llm
from utils.phone_utils import mask_phone

logger = logging.getLogger("vaidyaai.agents.referral_coordinator")


class ReferralCoordinatorAgent(BaseAgent):
    """
    Agent 7: ReferralCoordinator
    Autonomous specialist referral generation, diagnostic lab order tracking,
    formal referral letter drafting, and multi-specialty care coordination.
    """

    def __init__(self):
        super().__init__("referral_coordinator")
        self.whatsapp_svc = WhatsAppService()

    async def generate_and_track_referral(
        self,
        consultation_id: str,
        clinic_id: str,
        patient_phone: str,
        speciality: Optional[str] = None
    ) -> Dict[str, Any]:
        consultation = await get_document("consultations", consultation_id)
        if not consultation:
            return {"error": "Consultation not found"}

        soap_note = consultation.get("soap_note", {})
        diagnoses = consultation.get("diagnoses", [])

        clinic_doc = await get_document("clinics", clinic_id) or {}
        doctor_name = clinic_doc.get("doctor_name", "Doctor")

        prompt = build_referral_extraction_prompt(
            soap_note=soap_note,
            diagnoses=diagnoses,
            patient_info=f"Phone: {mask_phone(patient_phone)}"
        )
        # C-7: anonymise any residual PHI before the payload leaves for the LLM.
        prompt = anonymise_for_llm(prompt)

        from config import settings
        referral_res, latency_ms = await self._timed_gemini_json_call(
            task="referral_extraction",
            prompt=prompt,
            model=settings.GEMINI_REASONING_MODEL
        )

        target_speciality = speciality or referral_res.get("speciality", "Specialist Consultation")
        urgency = referral_res.get("urgency", "routine")
        referral_letter = referral_res.get(
            "formal_referral_letter",
            f"Dear Doctor / Colleague,\n\nReferred patient for evaluation regarding {target_speciality}.\n\nThank you,\n{doctor_name}"
        )

        now_utc = datetime.now(timezone.utc)
        referral_id = f"ref_{consultation_id[-8:]}"

        referral_doc = {
            "referral_id": referral_id,
            "clinic_id": clinic_id,
            "consultation_id": consultation_id,
            "patient_phone_masked": mask_phone(patient_phone),
            "speciality": target_speciality,
            "urgency": urgency,
            "clinical_summary": referral_res.get("clinical_summary", ""),
            "reason_for_referral": referral_res.get("reason_for_referral", ""),
            "formal_referral_letter": referral_letter,
            "recommended_investigations": referral_res.get("recommended_investigations", []),
            "status": "pending",
            "created_at": now_utc
        }

        await set_document("referrals", referral_id, referral_doc)

        try:
            async with AsyncSessionFactory() as db:
                from sqlalchemy import select
                from models.clinic import Clinic
                res = await db.execute(select(Clinic.id).where(Clinic.firebase_clinic_id == clinic_id))
                clinic_pg_id = res.scalar_one_or_none() or 1

                referral_pg = ReferralTracking(
                    clinic_id=clinic_pg_id,
                    patient_phone_masked=mask_phone(patient_phone),
                    consultation_firestore_id=consultation_id,
                    referral_type="specialist",
                    description=f"{target_speciality}: {referral_letter[:200]}",
                    urgency=urgency,
                    suggested_provider=target_speciality,
                    status="pending",
                    created_at=now_utc
                )
                db.add(referral_pg)
                await db.commit()
        except Exception as e:
            logger.warning(f"Could not save referral to Postgres: {e}")

        whatsapp_msg = (
            f"Namaste! Dr. Ramesh from Tirupati Clinic has prepared a formal specialist referral letter for you.\n\n"
            f"Speciality: {target_speciality}\nUrgency: {urgency.upper()}\n\n"
            f"Referral Letter Summary:\n{referral_res.get('reason_for_referral', 'Specialist review requested')}"
        )
        try:
            await self.whatsapp_svc.send_text_message(
                to_phone=patient_phone,
                message=whatsapp_msg,
                clinic_id=clinic_id
            )
        except Exception as e:
            logger.warning(f"WhatsApp referral message send error: {e}")

        await self.logger.log_decision(
            decision_type="referral_generated",
            decision_made=f"Generated formal referral to {target_speciality} (Urgency: {urgency})",
            clinic_id=clinic_id,
            consultation_id=consultation_id,
            model_used=settings.GEMINI_REASONING_MODEL,
            latency_ms=latency_ms
        )

        return referral_doc

    async def update_referral_status(
        self,
        referral_id: str,
        clinic_id: str,
        new_status: str
    ) -> Dict[str, Any]:
        now_utc = datetime.now(timezone.utc)
        await update_document("referrals", referral_id, {
            "status": new_status,
            "updated_at": now_utc
        })

        await self.logger.log_decision(
            decision_type="referral_status_updated",
            decision_made=f"Updated referral {referral_id} status to '{new_status}'",
            clinic_id=clinic_id
        )

        return {"referral_id": referral_id, "status": new_status}
