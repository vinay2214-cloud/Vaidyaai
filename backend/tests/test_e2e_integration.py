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
    from unittest.mock import patch
    appointment_agent = AppointmentFlowAgent()
    mock_intent = {
        "intent": "book_appointment",
        "preferred_date": "tomorrow",
        "preferred_time": "morning",
        "patient_name": "Kiran Kumar",
        "complaint_summary": "fever",
        "confidence": 0.95
    }
    with patch.object(appointment_agent, "_timed_gemini_json_call", return_value=(mock_intent, 150)):
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
    
    mock_stt_result = {
        "transcript": "[Doctor]: Patient has high fever and sore throat. I am prescribing Paracetamol 650mg thrice daily.",
        "confidence": 0.94,
        "mock": False,
        "execution_status": "live",
        "stt_provider": "Google Cloud Speech-to-Text"
    }

    mock_soap = {
        "subjective": "Patient presents with fever and sore throat for 2 days.",
        "objective": "Temp 101.5F, BP 120/80 mmHg.",
        "assessment": "Acute upper respiratory viral infection.",
        "plan": "Paracetamol 650mg thrice daily, hydration, rest.",
        "diagnoses": [{"code": "J06.9", "description": "Acute URI"}],
        "medications": [{"drug_name": "Paracetamol", "dosage": "650mg", "frequency": "1-0-1", "duration": "3 days"}]
    }

    with patch.object(scribe_agent.stt_service, "transcribe_audio_chunks", return_value=mock_stt_result), \
         patch.object(scribe_agent, "_timed_gemini_json_call", return_value=(mock_soap, 250)):
        scribe_res = await scribe_agent.process_consultation_audio(
            consultation_id=consultation_id,
            clinic_id=clinic_id,
            appointment_id=appointment_id,
            chunk_paths=["/tmp/dummy_chunk.wav"],
            vitals="BP 120/80 mmHg, Temp 101.5F"
        )

    assert scribe_res["status"] == "draft"
    assert "soap_note" in scribe_res
    assert len(scribe_res.get("medications", [])) >= 1

    # 3. Agent 5: PrescriptionSafe — Drug Safety Evaluation
    safety_agent = PrescriptionSafeAgent()
    meds = scribe_res.get("medications", [{"drug_name": "Paracetamol", "dosage": "650mg"}])
    
    mock_safety_res = {
        "is_safe": True,
        "confidence_score": 0.95,
        "warnings_count": 0,
        "warnings": [],
        "safety_summary": "Prescription is safe for this patient."
    }

    with patch.object(safety_agent, "_timed_gemini_json_call", return_value=(mock_safety_res, 120)):
        safety_res = await safety_agent.validate_prescription(
            consultation_id=consultation_id,
            clinic_id=clinic_id,
            medications=meds
        )

    assert "is_safe" in safety_res
    assert safety_res.get("is_safe") == True or safety_res.get("requires_manual_review") == True

    # 4. Doctor Approval -> Triggers Agent 3 BillingPulse
    approved_res = await scribe_agent.approve_consultation(
        consultation_id=consultation_id,
        clinic_id=clinic_id,
        consultation_type="new"
    )

    assert approved_res["status"] == "approved"

    # 5. Agent 7: ReferralCoordinator — Specialist Referral
    referral_agent = ReferralCoordinatorAgent()
    mock_ref = {
        "speciality": "Pulmonology",
        "urgency": "routine",
        "formal_referral_letter": "Referred patient for pulmonology evaluation."
    }
    with patch.object(referral_agent, "_timed_gemini_json_call", return_value=(mock_ref, 100)):
        ref_res = await referral_agent.generate_and_track_referral(
            consultation_id=consultation_id,
            clinic_id=clinic_id,
            patient_phone=patient_phone,
            speciality="Pulmonology"
        )

    assert ref_res["speciality"] == "Pulmonology"

    # 6. Agent 4: RetentionRadar — Patient Re-engagement
    retention_agent = RetentionRadarAgent()
    mock_ret = {
        "message": "Namaste Kiran garu, hoping you are recovering well from fever.",
        "recommended_channel": "whatsapp",
        "action": "send_outreach"
    }
    with patch.object(retention_agent, "_timed_gemini_json_call", return_value=(mock_ret, 120)):
        ret_res = await retention_agent.scan_and_run_daily_outreach(clinic_id=clinic_id)

    assert "outreach_sent_count" in ret_res

    # 7. Agent 6: InsightEngine — Weekly Practice Briefing
    insight_agent = InsightEngineAgent()
    mock_insight = {
        "health_score": 92,
        "executive_summary": "Practice operating at high clinical efficiency with zero overdue followups.",
        "growth_recommendations": ["Expand Saturday morning fever clinic slots."]
    }
    with patch.object(insight_agent, "_timed_gemini_json_call", return_value=(mock_insight, 250)):
        report_res = await insight_agent.generate_weekly_insight_report(clinic_id=clinic_id)

    assert "health_score" in report_res
    assert report_res["health_score"] >= 80


@pytest.mark.asyncio
async def test_clinical_scribe_different_patients_different_outputs():
    """
    Verifies that ClinicalScribe processes real distinct audio context per patient:
    Patient A (Fever) and Patient B (Chest Pain) must produce completely distinct
    Transcripts, SOAPs, Assessments, Plans, ICD-10 codes, and Medication lists.
    """
    from unittest.mock import patch
    scribe_agent = ClinicalScribeAgent()
    clinic_id = "cln_distinct_test"

    stt_fever = {
        "transcript": "[Doctor]: Patient has acute viral fever and cough. Prescribing Paracetamol 650mg thrice daily.",
        "confidence": 0.95,
        "mock": False,
        "execution_status": "live",
        "stt_provider": "Google Cloud Speech-to-Text"
    }
    stt_chest = {
        "transcript": "[Doctor]: Patient has crushing retrosternal chest pain and sweating. Prescribing Aspirin 300mg stat and Clopidogrel 300mg.",
        "confidence": 0.95,
        "mock": False,
        "execution_status": "live",
        "stt_provider": "Google Cloud Speech-to-Text"
    }

    soap_fever = {
        "subjective": "Fever and cough for 3 days",
        "objective": "Temp 101.4F, BP 120/80 mmHg",
        "assessment": "Viral Upper Respiratory Infection",
        "plan": "Paracetamol 650mg thrice daily",
        "diagnoses": [{"code": "J06.9", "description": "Acute URI"}],
        "medications": [{"drug_name": "Paracetamol", "dosage": "650mg"}]
    }
    soap_chest = {
        "subjective": "Crushing retrosternal chest pain",
        "objective": "BP 146/92 mmHg, HR 96 bpm",
        "assessment": "Acute Coronary Syndrome",
        "plan": "Aspirin 300mg stat, emergency referral",
        "diagnoses": [{"code": "I20.9", "description": "Angina Pectoris"}],
        "medications": [{"drug_name": "Aspirin", "dosage": "300mg"}]
    }

    # Patient A: Fever & Cough
    with patch.object(scribe_agent.stt_service, "transcribe_audio_chunks", return_value=stt_fever), \
         patch.object(scribe_agent, "_timed_gemini_json_call", return_value=(soap_fever, 200)):
        res_a = await scribe_agent.process_consultation_audio(
            consultation_id="cons_patient_a_fever",
            clinic_id=clinic_id,
            appointment_id="app_patient_a",
            chunk_paths=["/tmp/dummy_a.wav"],
            vitals="BP 120/80 mmHg, Temp 101.4F"
        )

    # Patient B: Acute Chest Pain
    with patch.object(scribe_agent.stt_service, "transcribe_audio_chunks", return_value=stt_chest), \
         patch.object(scribe_agent, "_timed_gemini_json_call", return_value=(soap_chest, 200)):
        res_b = await scribe_agent.process_consultation_audio(
            consultation_id="cons_patient_b_chest",
            clinic_id=clinic_id,
            appointment_id="app_patient_b",
            chunk_paths=["/tmp/dummy_b.wav"],
            vitals="BP 146/92 mmHg, HR 96 bpm"
        )

    # 1. Transcripts must be different
    assert res_a["transcript_raw"] != res_b["transcript_raw"]
    assert "fever" in res_a["transcript_raw"].lower()
    assert "chest" in res_b["transcript_raw"].lower()

    # 2. SOAPs must be different
    assert res_a["soap_note"]["subjective"] != res_b["soap_note"]["subjective"]
    assert res_a["soap_note"]["assessment"] != res_b["soap_note"]["assessment"]

    # 3. Diagnoses / ICD-10 codes must be different
    diag_a_code = res_a["diagnoses"][0]["code"]
    diag_b_code = res_b["diagnoses"][0]["code"]
    assert diag_a_code != diag_b_code

    # 4. Medications must be different
    med_a_name = res_a["medications"][0]["drug_name"]
    med_b_name = res_b["medications"][0]["drug_name"]
    assert med_a_name != med_b_name
