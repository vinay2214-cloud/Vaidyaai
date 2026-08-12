import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from agents.base_agent import BaseAgent
from prompts.retention_outreach import build_retention_outreach_prompt
from database.firestore import query_documents, set_document, update_document
from database.postgres import AsyncSessionFactory
from models.patient import RetentionOutreach
from services.whatsapp import WhatsAppService
from utils.phi_anonymiser import anonymise_for_llm
from utils.phone_utils import mask_phone

logger = logging.getLogger("vaidyaai.agents.retention_radar")


class RetentionRadarAgent(BaseAgent):
    """
    Agent 4: RetentionRadar
    Autonomous patient re-engagement, chronic disease follow-up tracking,
    missed appointment recovery, and preventive care outreach.
    """

    def __init__(self):
        super().__init__("retention_radar")
        self.whatsapp_svc = WhatsAppService()

    async def scan_and_run_daily_outreach(
        self,
        clinic_id: str
    ) -> Dict[str, Any]:
        consultations = await query_documents(
            "consultations",
            [
                ("clinic_id", "==", clinic_id),
                ("status", "==", "approved")
            ],
            limit=20
        )

        sent_count = 0
        outreach_results = []
        now_utc = datetime.now(timezone.utc)

        for cons in consultations:
            followup_days = cons.get("followup_days", 5)
            created_at = cons.get("created_at")
            
            if cons.get("retention_contacted"):
                continue

            appointment_id = cons.get("appointment_id")
            diagnoses = cons.get("diagnoses", [])
            primary_diag = diagnoses[0].get("description", "Consultation") if diagnoses else "General Consultation"

            prompt = build_retention_outreach_prompt(
                patient_name="Patient",
                diagnosis=primary_diag,
                followup_days=followup_days,
                language_code="te"
            )
            # C-7: enforce the "all LLM payloads anonymised" invariant.
            prompt = anonymise_for_llm(prompt)

            from config import settings
            outreach_data, latency_ms = await self._timed_gemini_json_call(
                task="retention_outreach_generation",
                prompt=prompt,
                model=settings.GEMINI_FAST_MODEL
            )

            message_text = outreach_data.get(
                "message",
                f"Namaste! Dr. Ramesh garu from Tirupati Clinic is checking in. How is your recovery from {primary_diag}? Reply to book review."
            )

            outreach_id = f"ret_{cons['consultation_id'][-8:]}"
            
            outreach_doc = {
                "outreach_id": outreach_id,
                "clinic_id": clinic_id,
                "consultation_id": cons["consultation_id"],
                "appointment_id": appointment_id,
                "message_text": message_text,
                "priority_score": outreach_data.get("priority_score", 0.85),
                "outreach_type": outreach_data.get("outreach_type", "followup_review"),
                "status": "sent",
                "sent_at": now_utc
            }
            await set_document("retention_outreach", outreach_id, outreach_doc)
            await update_document("consultations", cons["consultation_id"], {"retention_contacted": True})

            try:
                async with AsyncSessionFactory() as db:
                    from sqlalchemy import select
                    from models.clinic import Clinic
                    res = await db.execute(select(Clinic.id).where(Clinic.firebase_clinic_id == clinic_id))
                    clinic_pg_id = res.scalar_one_or_none() or 1

                    outreach_pg = RetentionOutreach(
                        clinic_id=clinic_pg_id,
                        patient_phone_masked="XXXX",
                        outreach_type=outreach_data.get("outreach_type", "followup_review"),
                        scheduled_date=now_utc.date(),
                        status="sent",
                        message_sent=message_text,
                        sent_at=now_utc
                    )
                    db.add(outreach_pg)
                    await db.commit()
            except Exception as e:
                logger.warning(f"Could not log retention outreach to Postgres: {e}")

            await self.logger.log_decision(
                decision_type="retention_outreach_sent",
                decision_made=f"Sent re-engagement outreach for {primary_diag} (Priority: {outreach_data.get('priority_score')})",
                clinic_id=clinic_id,
                consultation_id=cons["consultation_id"],
                model_used=settings.GEMINI_FAST_MODEL,
                latency_ms=latency_ms
            )

            sent_count += 1
            outreach_results.append(outreach_doc)

        return {
            "clinic_id": clinic_id,
            "outreach_sent_count": sent_count,
            "outreach_details": outreach_results
        }
