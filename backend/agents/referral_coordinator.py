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

# Canonical referral urgency vocabulary (matches the referral extraction prompt).
# The application must NEVER execute None.upper(), so any null/empty/invalid
# value is safely normalized to the default "routine".
REFERRAL_URGENCY_VOCABULARY = {"routine", "urgent"}
DEFAULT_REFERRAL_URGENCY = "routine"
# Out-of-vocabulary values that are clinically an escalation must never be
# silently downgraded to "routine" — they map onto the highest canonical level.
REFERRAL_URGENCY_ESCALATION_ALIASES = {
    "emergency", "emergent", "stat", "immediate", "immediately",
    "asap", "critical", "high",
}


def normalize_referral_urgency(raw_urgency: Any) -> str:
    """Safely normalize a referral urgency value to the canonical vocabulary.

    Handles None, empty strings, non-string types, and out-of-vocabulary values.
    Escalation synonyms (e.g. "emergency") map to "urgent" so urgency is never
    silently downgraded; anything else falls back to "routine". This guarantees
    the downstream ``urgency.upper()`` call can never receive None.
    """
    if raw_urgency is None:
        return DEFAULT_REFERRAL_URGENCY
    normalized = str(raw_urgency).strip().lower()
    if normalized in REFERRAL_URGENCY_VOCABULARY:
        return normalized
    if normalized in REFERRAL_URGENCY_ESCALATION_ALIASES:
        return "urgent"
    return DEFAULT_REFERRAL_URGENCY


# Canonical urgency levels ordered from least to most urgent.
REFERRAL_URGENCY_RANK = {"routine": 0, "urgent": 1}


def escalate_referral_urgency(
    model_urgency: Optional[str],
    requested_urgency: Optional[str] = None
) -> str:
    """Return the more urgent of the model's determination and the clinician's request.

    A clinician who explicitly asks for an emergency referral must never have it
    downgraded because the LLM judged the case routine. Conversely, a model
    escalation is preserved when the clinician left urgency unspecified.
    """
    candidates = [
        normalize_referral_urgency(value)
        for value in (model_urgency, requested_urgency)
        if value is not None
    ]
    if not candidates:
        return DEFAULT_REFERRAL_URGENCY
    return max(candidates, key=lambda level: REFERRAL_URGENCY_RANK.get(level, 0))


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
        speciality: Optional[str] = None,
        requested_urgency: Optional[str] = None
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
        # Normalize urgency safely: Gemini may return null/empty/invalid, which
        # must never reach urgency.upper() as None.
        # Never downgrade a clinician's explicit escalation to the model's guess:
        # take the more urgent of (clinician request, model determination).
        urgency = escalate_referral_urgency(
            normalize_referral_urgency(referral_res.get("urgency")),
            normalize_referral_urgency(requested_urgency) if requested_urgency else None,
        )
        # Gemini may return the key with a null value (not just omit it), so a
        # plain .get(default) would leave referral_letter as None and crash the
        # relational mirror below. Fall back to the default for both cases.
        referral_letter = referral_res.get("formal_referral_letter") or (
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
                clinic_pg_id = res.scalar_one_or_none()
                if clinic_pg_id is None:
                    # clinics.id is a UUID FK — a placeholder integer would raise
                    # on insert and the row would be dropped anyway. Skip the
                    # relational mirror explicitly; Firestore holds the referral.
                    raise LookupError(
                        f"clinic '{clinic_id}' is not registered in the relational store"
                    )

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
        except LookupError as e:
            logger.warning(
                f"Referral {referral_id} kept in Firestore only — relational mirror skipped: {e}"
            )
        except Exception as e:
            logger.error(
                f"Could not save referral {referral_id} to Postgres: {e}", exc_info=True
            )

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
