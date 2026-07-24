import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from agents.base_agent import BaseAgent
from services.speech_to_text import SpeechToTextService
from prompts.soap_generation import build_soap_generation_prompt
from database.firestore import (
    get_document,
    set_document,
    update_document
)
from utils.phi_anonymiser import anonymise_for_llm
from utils.phone_utils import mask_phone

logger = logging.getLogger("vaidyaai.agents.clinical_scribe")


class ClinicalScribeAgent(BaseAgent):
    """
    Agent 2: ClinicalScribe
    Autonomous ambient clinical transcription, speaker diarization, SOAP note generation,
    ICD-10 clinical coding assistance, structured prescription extraction, and approval triggering.
    """

    def __init__(self):
        super().__init__("clinical_scribe")
        self.stt_service = SpeechToTextService()

    async def process_consultation_audio(
        self,
        consultation_id: str,
        clinic_id: str,
        appointment_id: str,
        chunk_paths: List[str],
        patient_history: str = "",
        vitals: str = "",
        language_code: str = "te-IN"
    ) -> Dict[str, Any]:
        """
        Ingests audio chunks, runs Speech-to-Text diarization, anonymises text,
        calls Gemini 1.5 Pro to generate SOAP note, and saves draft consultation in Firestore.
        """
        # 1. Speech-to-Text with Speaker Diarization
        stt_result = await self.stt_service.transcribe_audio_chunks(chunk_paths, language_code)
        raw_transcript = stt_result.get("transcript", "")
        
        # 2. Anonymise transcript for LLM call
        anonymised_transcript = anonymise_for_llm(raw_transcript)

        # 3. Call Gemini 1.5 Pro for SOAP note generation
        prompt = build_soap_generation_prompt(anonymised_transcript, patient_history, vitals)
        soap_data, latency_ms = await self._timed_gemini_json_call(
            task="soap_generation",
            prompt=prompt,
            model="gemini-1.5-pro"
        )

        now_utc = datetime.now(timezone.utc)
        consultation_doc = {
            "consultation_id": consultation_id,
            "clinic_id": clinic_id,
            "appointment_id": appointment_id,
            "transcript_raw": raw_transcript,
            "transcript_anonymised": anonymised_transcript,
            "soap_note": {
                "subjective": soap_data.get("subjective", ""),
                "objective": soap_data.get("objective", ""),
                "assessment": soap_data.get("assessment", ""),
                "plan": soap_data.get("plan", "")
            },
            "diagnoses": soap_data.get("diagnoses", []),
            "medications": soap_data.get("medications", []),
            "investigations": soap_data.get("investigations", []),
            "referrals": soap_data.get("referrals", []),
            "followup_days": soap_data.get("followup_days", 5),
            "status": "draft",
            "created_at": now_utc,
            "updated_at": now_utc
        }

        await set_document("consultations", consultation_id, consultation_doc)

        await self.logger.log_decision(
            decision_type="soap_generated",
            decision_made=f"Generated draft SOAP note with {len(soap_data.get('medications', []))} medications & {len(soap_data.get('diagnoses', []))} diagnoses",
            clinic_id=clinic_id,
            consultation_id=consultation_id,
            appointment_id=appointment_id,
            model_used="gemini-1.5-pro",
            latency_ms=latency_ms
        )

        return consultation_doc

    async def approve_consultation(
        self,
        consultation_id: str,
        clinic_id: str,
        edited_soap: Optional[Dict[str, Any]] = None,
        edited_medications: Optional[List[Dict[str, Any]]] = None,
        consultation_type: str = "new"
    ) -> Dict[str, Any]:
        """
        Invoked when doctor approves the draft SOAP note in the Dashboard.
        Transitions consultation status to 'approved', triggers BillingPulseAgent, and builds PDF.
        """
        consultation = await get_document("consultations", consultation_id)
        if not consultation:
            return {"error": "Consultation not found"}

        now_utc = datetime.now(timezone.utc)
        update_payload: Dict[str, Any] = {
            "status": "approved",
            "approved_at": now_utc,
            "updated_at": now_utc
        }

        if edited_soap:
            update_payload["soap_note"] = edited_soap
        if edited_medications:
            update_payload["medications"] = edited_medications

        await update_document("consultations", consultation_id, update_payload)

        # Retrieve appointment & patient details for billing trigger
        appointment_id = consultation.get("appointment_id")
        appointment = await get_document("appointments", appointment_id) if appointment_id else None
        patient_phone = appointment.get("patient_phone_masked") if appointment else None

        # Trigger Agent 3: BillingPulse to issue invoice & UPI payment link
        billing_result = None
        if patient_phone and patient_phone != "XXXX":
            try:
                from agents.billing_pulse import BillingPulseAgent
                billing_agent = BillingPulseAgent()
                billing_result = await billing_agent.on_consultation_close(
                    consultation_id=consultation_id,
                    clinic_id=clinic_id,
                    patient_phone=patient_phone,
                    consultation_type=consultation_type
                )
            except Exception as e:
                logger.error(f"Error triggering BillingPulse on SOAP approval: {e}")

        # Update appointment status to completed
        if appointment_id:
            await update_document("appointments", appointment_id, {
                "status": "completed",
                "completed_at": now_utc
            })

        await self.logger.log_decision(
            decision_type="soap_approved",
            decision_made=f"Doctor approved SOAP note for consultation {consultation_id}. Completed appointment.",
            clinic_id=clinic_id,
            consultation_id=consultation_id,
            appointment_id=appointment_id
        )

        return {
            "status": "approved",
            "consultation_id": consultation_id,
            "billing": billing_result
        }
