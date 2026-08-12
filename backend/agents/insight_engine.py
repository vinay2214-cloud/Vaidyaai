import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from agents.base_agent import BaseAgent
from prompts.insight_report import build_insight_report_prompt
from database.firestore import query_documents, set_document, get_document
from database.postgres import AsyncSessionFactory
from services.whatsapp import WhatsAppService
from utils.phi_anonymiser import anonymise_for_llm

logger = logging.getLogger("vaidyaai.agents.insight_engine")


class InsightEngineAgent(BaseAgent):
    """
    Agent 6: InsightEngine
    Autonomous business intelligence, operational analytics, financial benchmarking,
    and weekly executive briefing delivery for solo clinic practices.
    """

    def __init__(self):
        super().__init__("insight_engine")
        self.whatsapp_svc = WhatsAppService()

    async def generate_weekly_insight_report(
        self,
        clinic_id: str
    ) -> Dict[str, Any]:
        """
        Aggregates past 7-day practice metrics across Firestore & Postgres,
        invokes Gemini 2.5 Flash for executive insights, and delivers WhatsApp report.
        """
        clinic_doc = await get_document("clinics", clinic_id) or {}
        clinic_name = clinic_doc.get("name", "VaidyaAI Clinic")
        doctor_name = clinic_doc.get("doctor_name", "Doctor")

        # 1. Aggregate Firestore metrics for past 7 days
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

        def _is_recent(doc: dict) -> bool:
            ca = doc.get("created_at")
            if not isinstance(ca, datetime):
                return True
            if ca.tzinfo is None:
                ca = ca.replace(tzinfo=timezone.utc)
            return ca >= seven_days_ago

        appointments = [d for d in await query_documents("appointments", [("clinic_id", "==", clinic_id)], limit=100) if _is_recent(d)]
        consultations = [d for d in await query_documents("consultations", [("clinic_id", "==", clinic_id)], limit=100) if _is_recent(d)]
        retentions = [d for d in await query_documents("retention_outreach", [("clinic_id", "==", clinic_id)], limit=50) if _is_recent(d)]
        referrals = [d for d in await query_documents("referrals", [("clinic_id", "==", clinic_id)], limit=50) if _is_recent(d)]
        agent_logs = [d for d in await query_documents("agent_logs", [("clinic_id", "==", clinic_id)], limit=100) if _is_recent(d)]

        total_appts = len(appointments)
        completed_consults = len([c for c in consultations if c.get("status") == "approved"])
        no_shows = len([a for a in appointments if a.get("status") == "no_show"])

        # Calculate financial metrics from Postgres
        total_billed_paise = 0
        total_collected_paise = 0
        upi_collected_paise = 0
        
        try:
            async with AsyncSessionFactory() as db:
                from sqlalchemy import select, func
                from models.clinic import Clinic
                from models.billing import Invoice

                res = await db.execute(select(Clinic.id).where(Clinic.firebase_clinic_id == clinic_id))
                clinic_pg_id = res.scalar_one_or_none()
                if clinic_pg_id:
                    inv_res = await db.execute(
                        select(Invoice).where(
                            Invoice.clinic_id == clinic_pg_id,
                            Invoice.created_at >= seven_days_ago
                        )
                    )
                    invoices = inv_res.scalars().all()
                    for inv in invoices:
                        if inv.status == "waived":
                            continue
                        total_billed_paise += inv.amount_paise
                        if inv.status == "paid":
                            total_collected_paise += inv.amount_paise
                            if inv.payment_method == "upi":
                                upi_collected_paise += inv.amount_paise
        except Exception as e:
            logger.warning(f"Could not aggregate Postgres financial metrics: {e}")

        total_billed_rupees = total_billed_paise / 100.0
        total_collected_rupees = total_collected_paise / 100.0
        upi_percentage = round((upi_collected_paise / total_collected_paise * 100), 1) if total_collected_paise > 0 else 0.0

        metrics_summary = {
            "total_appointments": total_appts,
            "completed_consultations": completed_consults,
            "no_show_count": no_shows,
            "total_billed_rupees": total_billed_rupees,
            "total_collected_rupees": total_collected_rupees,
            "upi_percentage": upi_percentage,
            "safety_warnings_count": len([l for l in agent_logs if l.get("decision_type") == "drug_safety_evaluated"]),
            "retention_outreaches": len(retentions),
            "referrals_count": len(referrals)
        }

        # Compute deterministic health score from real metrics as fallback for LLM output
        if total_appts > 0:
            completion_rate = completed_consults / total_appts
            no_show_rate = no_shows / total_appts
            collection_rate = total_collected_paise / total_billed_paise if total_billed_paise > 0 else 0
            fallback_health_score = round(completion_rate * 50 + collection_rate * 30 + (1 - no_show_rate) * 20)
            fallback_health_score = max(0, min(100, fallback_health_score))
        else:
            fallback_health_score = 0

        # 2. Call Gemini 2.5 Pro for executive report generation & clinical analytics
        from config import settings
        prompt = build_insight_report_prompt(clinic_name, doctor_name, metrics_summary)
        # C-7: defensively strip any PHI before the payload leaves for the LLM.
        prompt = anonymise_for_llm(prompt)
        insight_res, latency_ms = await self._timed_gemini_json_call(
            task="weekly_insight_report",
            prompt=prompt,
            model=settings.GEMINI_REASONING_MODEL
        )

        now_utc = datetime.now(timezone.utc)
        report_id = f"rpt_{int(now_utc.timestamp())}"

        whatsapp_text = insight_res.get(
            "whatsapp_report_text",
            f"📊 *Weekly Executive Briefing — {clinic_name}*\n\n"
            f"• Health Score: {insight_res.get('health_score', fallback_health_score)}/100\n"
            f"• Total Consultations: {metrics_summary['completed_consultations']}\n"
            f"• Revenue Collected: ₹{metrics_summary['total_collected_rupees']:.2f} ({upi_percentage}% UPI)\n\n"
            f"Keep up the great practice!"
        )

        report_doc = {
            "report_id": report_id,
            "clinic_id": clinic_id,
            "health_score": insight_res.get("health_score", fallback_health_score),
            "executive_summary": insight_res.get("executive_summary", "Strong weekly practice performance."),
            "growth_recommendations": insight_res.get("growth_recommendations", []),
            "whatsapp_report_text": whatsapp_text,
            "metrics": metrics_summary,
            "generated_at": now_utc
        }

        # 3. Save report to Firestore
        await set_document("insight_reports", report_id, report_doc)

        # 4. Deliver report to doctor via WhatsApp
        doctor_phone = clinic_doc.get("phone", "")
        if not doctor_phone:
            self.log.warning(f"No doctor phone found for clinic {clinic_id}, skipping WhatsApp report delivery")
        try:
            if not doctor_phone:
                raise ValueError("No doctor phone configured for this clinic")
            await self.whatsapp_svc.send_text_message(
                to_phone=doctor_phone,
                message=whatsapp_text,
                clinic_id=clinic_id
            )
        except Exception as e:
            logger.warning(f"Could not deliver weekly insight report via WhatsApp: {e}")

        await self.logger.log_decision(
            decision_type="weekly_report_generated",
            decision_made=f"Generated weekly executive report (Health Score: {insight_res.get('health_score', 92)}/100)",
            clinic_id=clinic_id,
            model_used=settings.GEMINI_REASONING_MODEL,
            latency_ms=latency_ms
        )

        return report_doc
