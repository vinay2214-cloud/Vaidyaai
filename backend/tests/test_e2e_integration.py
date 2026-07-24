import pytest
import asyncio
from datetime import datetime, timezone

from agents.appointment_flow import AppointmentFlowAgent
from agents.clinical_scribe import ClinicalScribeAgent
from agents.prescription_safe import PrescriptionSafeAgent
from agents.billing_pulse import BillingPulseAgent
from agents.retention_radar import RetentionRadarAgent
from agents.referral_coordinator import ReferralCoordinatorAgent
from agents.insight_engine import InsightEngineAgent


@pytest.mark.asyncio
async def test_complete_7_agent_patient_journey():
    clinic_id = "cln_e2e_test_clinic"
    patient_phone = "+919876543210"

    # 1. Agent 1: AppointmentFlow — Intent Processing
    appointment_agent = AppointmentFlowAgent()
    appt_res = await appointment_agent.process_incoming_whatsapp(
        phone_number=patient_phone,
        message_text="Need appointment with doctor tomorrow morning for fever",
        clinic_id=clinic_id
    )

    assert appt_res["status"] in ["appointment_booked", "slots_offered", "other_responded", "processed"]
    appointment_id = appt_res.get("appointment_id", "app_e2e_1001")

    # 2. Agent 2: ClinicalScribe — Audio Transcription & SOAP Generation
    scribe_agent = ClinicalScribeAgent()
    consultation_id = "cons_e2e_2002"
    
    scribe_res = await scribe_agent.process_consultation_audio(
        consultation_id=consultation_id,
        clinic_id=clinic_id,
        appointment_id=appointment_id,
        chunk_paths=[],
        vitals="BP 120/80 mmHg, Temp 101.5F"
    )

    assert scribe_res["status"] == "draft"
    assert "soap_note" in scribe_res
    assert len(scribe_res.get("medications", [])) >= 1

    # 3. Agent 5: PrescriptionSafe — Drug Safety Evaluation
    safety_agent = PrescriptionSafeAgent()
    meds = scribe_res.get("medications", [{"drug_name": "Paracetamol", "dosage": "650mg"}])
    
    safety_res = await safety_agent.validate_prescription(
        consultation_id=consultation_id,
        clinic_id=clinic_id,
        medications=meds
    )

    assert "is_safe" in safety_res
    assert safety_res["confidence_score"] >= 0.80

    # 4. Doctor Approval -> Triggers Agent 3 BillingPulse
    approved_res = await scribe_agent.approve_consultation(
        consultation_id=consultation_id,
        clinic_id=clinic_id,
        consultation_type="new"
    )

    assert approved_res["status"] == "approved"

    # 5. Agent 7: ReferralCoordinator — Specialist Referral
    referral_agent = ReferralCoordinatorAgent()
    ref_res = await referral_agent.generate_and_track_referral(
        consultation_id=consultation_id,
        clinic_id=clinic_id,
        patient_phone=patient_phone,
        speciality="Pulmonology"
    )

    assert ref_res["speciality"] == "Pulmonology"
    assert ref_res["status"] == "pending"

    # 6. Agent 4: RetentionRadar — Patient Re-engagement
    retention_agent = RetentionRadarAgent()
    ret_res = await retention_agent.scan_and_run_daily_outreach(clinic_id=clinic_id)

    assert "outreach_sent_count" in ret_res

    # 7. Agent 6: InsightEngine — Weekly Practice Briefing
    insight_agent = InsightEngineAgent()
    report_res = await insight_agent.generate_weekly_insight_report(clinic_id=clinic_id)

    assert "health_score" in report_res
    assert report_res["health_score"] >= 80
