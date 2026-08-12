import json
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
        calls Gemini 2.5 Pro to generate SOAP note, and saves draft consultation in Firestore.
        Logs latency, confidence, timestamp, and model telemetry for every execution.
        """
        import time
        start_total = time.monotonic()

        # 1. Speech-to-Text with Speaker Diarization
        start_stt = time.monotonic()
        stt_result = await self.stt_service.transcribe_audio_chunks(chunk_paths, language_code)
        stt_latency_ms = int((time.monotonic() - start_stt) * 1000)
        raw_transcript = stt_result.get("transcript", "")
        stt_confidence = stt_result.get("confidence", 0.95)
        
        # 2. Anonymise transcript for LLM call
        anonymised_transcript = anonymise_for_llm(raw_transcript)

        # 3. Call Gemini 2.5 Pro for SOAP note generation & ICD-10 clinical coding
        from config import settings
        prompt = build_soap_generation_prompt(anonymised_transcript, patient_history, vitals)

        try:
            soap_data, llm_latency_ms = await self._timed_gemini_json_call(
                task="soap_generation",
                prompt=prompt,
                model=settings.GEMINI_REASONING_MODEL
            )
        except Exception as e:
            total_latency_ms = int((time.monotonic() - start_total) * 1000)
            now_utc = datetime.now(timezone.utc)
            logger.error(f"ClinicalScribe LLM generation failed: {e}", exc_info=True)
            
            # Log failure in AgentLogger
            await self.logger.log_decision(
                decision_type="soap_generation_failed",
                decision_made=f"Live ClinicalScribe generation failed for consultation {consultation_id}: {str(e)[:120]}",
                clinic_id=clinic_id,
                consultation_id=consultation_id,
                appointment_id=appointment_id,
                model_used=settings.GEMINI_REASONING_MODEL,
                latency_ms=total_latency_ms,
                success=False,
                error_message=str(e)
            )
            
            # Record failed consultation state in database
            failed_scribe_metadata = {
                "generated_by": "ClinicalScribe (Agent 2)",
                "provider": "Google Cloud Vertex AI",
                "model_used": settings.GEMINI_REASONING_MODEL,
                "location": settings.GEMINI_REASONING_LOCATION,
                "project_id": settings.GOOGLE_CLOUD_PROJECT,
                "correlation_id": f"corr_scribe_{consultation_id[-8:]}",
                "generated_at": now_utc.isoformat(),
                "timestamp": now_utc.isoformat(),
                "latency_ms": total_latency_ms,
                "stt_latency_ms": stt_latency_ms,
                "llm_latency_ms": None,
                "speech_recognition_confidence": round(stt_confidence, 2),
                "execution_status": "failed",
                "source_type": "Vertex AI",
                "error_state": str(e)
            }
            await set_document("consultations", consultation_id, {
                "consultation_id": consultation_id,
                "clinic_id": clinic_id,
                "appointment_id": appointment_id,
                "status": "ai_failed",
                "transcript_raw": raw_transcript,
                "transcript_anonymised": anonymised_transcript,
                "scribe_metadata": failed_scribe_metadata,
                "error_message": f"Live AI ClinicalScribe inference failed: {e}",
                "updated_at": now_utc
            })
            raise RuntimeError(f"Live ClinicalScribe generation failed on {settings.GEMINI_REASONING_MODEL} @ {settings.GEMINI_REASONING_LOCATION}: {e}")

        total_latency_ms = int((time.monotonic() - start_total) * 1000)
        now_utc = datetime.now(timezone.utc)

        # Retrieve patient_id explicitly from appointment
        patient_id = None
        if appointment_id:
            appt_doc = await get_document("appointments", appointment_id)
            if appt_doc:
                patient_id = appt_doc.get("patient_id")

        # Deterministic Grounding & Evidence Validation Layer (Zero-Fabrication Enforcement)
        from utils.grounding_validator import validate_and_sanitize_clinical_facts
        soap_data, rejected_facts = validate_and_sanitize_clinical_facts(
            transcript=raw_transcript,
            raw_data=soap_data,
            consultation_id=consultation_id
        )

        # Grounding rejection threshold: if too many facts are rejected, escalate for review
        GROUNDING_REJECTION_THRESHOLD = 5
        grounding_requires_review = len(rejected_facts) > GROUNDING_REJECTION_THRESHOLD
        if grounding_requires_review:
            logger.warning(
                f"Grounding rejection threshold exceeded for consultation {consultation_id}: "
                f"{len(rejected_facts)} rejections > {GROUNDING_REJECTION_THRESHOLD} threshold. "
                f"Escalating for clinician review."
            )

        # Extract grounded clinical facts
        clinical_facts = soap_data.get("clinical_facts", {})
        
        # 4. Allergy Grounding & Safety Gate
        raw_allergies = clinical_facts.get("allergies", [])
        extracted_allergies = []
        for a in raw_allergies:
            if isinstance(a, dict) and a.get("allergen"):
                extracted_allergies.append(str(a["allergen"]))
            elif isinstance(a, str) and a.strip():
                extracted_allergies.append(a.strip())

        if extracted_allergies:
            allergy_review_status = "REQUIRES_CLINICIAN_CONFIRMATION"
            allergy_alert = f"Patient-reported {', '.join(extracted_allergies)} allergy detected in conversation — clinician confirmation mandatory before dispensing."
        else:
            allergy_review_status = "NOT_DOCUMENTED"
            allergy_alert = None

        # 5. STT Confidence Tiers & Warnings
        if stt_confidence < 0.60:
            confidence_tier = "LOW"
            confidence_warning = f"Low Speech Recognition Confidence ({int(stt_confidence * 100)}%) — Clinician transcript review mandatory before approval."
            requires_transcript_review = True
        elif stt_confidence < 0.75:
            confidence_tier = "MODERATE"
            confidence_warning = f"Moderate Speech Recognition Confidence ({int(stt_confidence * 100)}%) — Please verify transcript details."
            requires_transcript_review = False
        else:
            confidence_tier = "HIGH"
            confidence_warning = None
            requires_transcript_review = False

        # 6. Grounded Vitals Extraction (never fabricate unstated numbers)
        raw_v = clinical_facts.get("vitals", {})
        grounded_vitals = {}
        if isinstance(raw_v, dict):
            t_val = raw_v.get("temperature")
            if t_val:
                grounded_vitals["temp"] = t_val.get("value", str(t_val)) if isinstance(t_val, dict) else str(t_val)
            bp_val = raw_v.get("bp") or raw_v.get("blood_pressure")
            if bp_val:
                grounded_vitals["bp"] = bp_val.get("value", str(bp_val)) if isinstance(bp_val, dict) else str(bp_val)
            hr_val = raw_v.get("pulse") or raw_v.get("heart_rate")
            if hr_val:
                grounded_vitals["pulse"] = hr_val.get("value", str(hr_val)) if isinstance(hr_val, dict) else str(hr_val)
            spo2_val = raw_v.get("spo2")
            if spo2_val:
                grounded_vitals["spo2"] = spo2_val.get("value", str(spo2_val)) if isinstance(spo2_val, dict) else str(spo2_val)
            rr_val = raw_v.get("resp_rate") or raw_v.get("respiratory_rate")
            if rr_val:
                grounded_vitals["resp_rate"] = rr_val.get("value", str(rr_val)) if isinstance(rr_val, dict) else str(rr_val)
            w_val = raw_v.get("weight_kg") or raw_v.get("weight")
            if w_val:
                grounded_vitals["weight"] = w_val.get("value", str(w_val)) if isinstance(w_val, dict) else str(w_val)

        scribe_metadata = {
            "generated_by": "ClinicalScribe (Agent 2)",
            "provider": "Google Cloud Vertex AI",
            "model_used": settings.GEMINI_REASONING_MODEL,
            "location": settings.GEMINI_REASONING_LOCATION,
            "project_id": settings.GOOGLE_CLOUD_PROJECT,
            "correlation_id": f"corr_scribe_{consultation_id[-8:]}",
            "generated_at": now_utc.isoformat(),
            "timestamp": now_utc.isoformat(),
            "latency_ms": total_latency_ms,
            "stt_latency_ms": stt_latency_ms,
            "llm_latency_ms": llm_latency_ms,
            "stt_provider": stt_result.get("provider", "Google Cloud Speech-to-Text"),
            "stt_execution_status": stt_result.get("execution_status", "live"),
            "speech_recognition_confidence": round(stt_confidence, 2),
            "confidence_tier": confidence_tier,
            "confidence_warning": confidence_warning,
            "requires_transcript_review": requires_transcript_review,
            "transcript_reviewed": False,
            "execution_status": "live",
            "source_type": "Vertex AI",
            "finish_reason": "STOP",
            "error_state": None
        }

        # Attach provenance to all clinical facts
        from utils.provenance import attach_provenance_to_facts, ProvenanceSource
        clinical_facts = attach_provenance_to_facts(
            clinical_facts,
            source=ProvenanceSource.AI_PROVISIONAL,
            agent_name="clinical_scribe",
            model_used=scribe_metadata.get("model_used"),
            evidence_text=raw_transcript[:500],
            consultation_id=consultation_id,
        )

        # Preserve existing known patient allergies and merge newly extracted allergies
        existing_cons = await get_document("consultations", consultation_id) or {}
        existing_allergies = list(existing_cons.get("patient_allergies", []))
        if patient_id:
            pat_doc = await get_document("patients", patient_id)
            if pat_doc:
                for a in pat_doc.get("allergies", []):
                    if a and a not in existing_allergies:
                        existing_allergies.append(a)

        all_allergies = list(existing_allergies)
        for a in extracted_allergies:
            if a and a not in all_allergies:
                all_allergies.append(a)

        consultation_doc = {
            "consultation_id": consultation_id,
            "clinic_id": clinic_id,
            "appointment_id": appointment_id,
            "patient_id": patient_id,
            "transcript_raw": raw_transcript,
            "transcript_anonymised": anonymised_transcript,
            "clinical_facts": clinical_facts,
            "patient_allergies": all_allergies,
            "allergy_review_status": allergy_review_status,
            "allergy_alert": allergy_alert,
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
            "followup_days": soap_data.get("followup_days", 3),
            # Preserve clinician-entered vitals if AI grounding found none
            **({"vitals": grounded_vitals} if grounded_vitals else {}),
            "scribe_metadata": scribe_metadata,
            "grounding_rejections": rejected_facts,
            "grounding_rejection_count": len(rejected_facts),
            "grounding_requires_review": grounding_requires_review,
            "safety_eval_required": len(soap_data.get("medications", [])) > 0,
            "safety_eval_completed": False,
            "ai_generated": True,
            "review_status": "REQUIRES_REVIEW",
            "status": "grounding_review_required" if grounding_requires_review else "draft",
            "created_at": now_utc,
            "updated_at": now_utc
        }

        await set_document("consultations", consultation_id, consultation_doc)

        # If patient record exists, update patient allergies if not already recorded
        if patient_id and extracted_allergies:
            try:
                pat = await get_document("patients", patient_id)
                if pat:
                    existing_allergies = pat.get("allergies", [])
                    merged_allergies = list(set(existing_allergies + extracted_allergies))
                    await update_document("patients", patient_id, {
                        "allergies": merged_allergies,
                        "updated_at": now_utc
                    })
            except Exception as e:
                logger.warning(f"Could not auto-sync extracted allergies to patient {patient_id}: {e}")

        await self.logger.log_decision(
            decision_type="soap_generated",
            decision_made=f"Generated draft SOAP note with {len(soap_data.get('medications', []))} medications & {len(soap_data.get('diagnoses', []))} diagnoses (Speech Recognition Confidence: {int(stt_confidence * 100)}%) via {settings.GEMINI_REASONING_MODEL} @ {settings.GEMINI_REASONING_LOCATION}",
            clinic_id=clinic_id,
            consultation_id=consultation_id,
            appointment_id=appointment_id,
            model_used=settings.GEMINI_REASONING_MODEL,
            latency_ms=total_latency_ms,
            success=True
        )

        return consultation_doc

    async def approve_consultation(
        self,
        consultation_id: str,
        clinic_id: str,
        edited_soap: Optional[Dict[str, Any]] = None,
        edited_medications: Optional[List[Dict[str, Any]]] = None,
        consultation_type: str = "new",
        transcript_reviewed: bool = False
    ) -> Dict[str, Any]:
        """
        Invoked when doctor approves the draft SOAP note in the Dashboard.
        Transitions consultation status to 'approved', triggers BillingPulseAgent, and builds PDF.
        """
        consultation = await get_document("consultations", consultation_id)
        if not consultation:
            return {"error": "Consultation not found"}

        # ─── Low-confidence transcript review gate ────────────────────────────────
        # Rule 11: Low-confidence speech recognition MUST trigger transcript review
        # before clinical approval. If the STT confidence tier was LOW and the
        # clinician has not explicitly confirmed transcript review, block approval.
        scribe_meta = consultation.get("scribe_metadata", {})
        if scribe_meta.get("requires_transcript_review") and not scribe_meta.get("transcript_reviewed") and not transcript_reviewed:
            return {
                "error": "transcript_review_required",
                "detail": scribe_meta.get("confidence_warning", "Low Speech Recognition Confidence — Clinician transcript review mandatory before approval."),
                "consultation_id": consultation_id,
                "confidence_tier": scribe_meta.get("confidence_tier"),
                "speech_recognition_confidence": scribe_meta.get("speech_recognition_confidence"),
            }

        # ─── Safety gate ─────────────────────────────────────────────────────────
        # A consultation with prescribed medications MUST NOT be approved unless a
        # prescription safety evaluation exists AND either it passed (is_safe) or
        # the doctor explicitly overrode the warning with a documented reason.
        effective_meds = edited_medications if edited_medications is not None else consultation.get("medications", [])
        if effective_meds and len(effective_meds) > 0:
            safety_eval = consultation.get("safety_evaluation")
            if not safety_eval:
                return {
                    "error": "safety_check_required",
                    "detail": "Prescription safety check has not been run. Run the safety audit before approving this prescription.",
                    "consultation_id": consultation_id,
                }
            # Stale safety check: the safety evaluation must have been run on the
            # EXACT medications being approved. If the prescription was modified
            # after the last evaluation, the stored signature will not match the
            # current medications and approval is blocked until re-evaluation.
            from agents.prescription_safe import _medication_signature
            evaluated_sig = consultation.get("safety_evaluated_medications")
            current_sig = _medication_signature(effective_meds)
            if evaluated_sig is not None and evaluated_sig != current_sig:
                return {
                    "error": "safety_check_stale",
                    "detail": "Prescription safety check is stale — medications were modified after the last safety evaluation. Re-run the safety audit.",
                    "consultation_id": consultation_id,
                }
            if not safety_eval.get("is_safe") and not safety_eval.get("overridden"):
                return {
                    "error": "safety_check_failed",
                    "detail": "Prescription safety check flagged this prescription as unsafe. Review warnings and override with a clinical reason, or modify the prescription.",
                    "consultation_id": consultation_id,
                    "safety_evaluation": safety_eval,
                }

        now_utc = datetime.now(timezone.utc)
        update_payload: Dict[str, Any] = {
            "status": "approved",
            "approved_at": now_utc,
            "updated_at": now_utc
        }

        # Persist the clinician's transcript-review confirmation onto the scribe metadata
        if transcript_reviewed:
            scribe_meta = dict(consultation.get("scribe_metadata", {}))
            scribe_meta["transcript_reviewed"] = True
            update_payload["scribe_metadata"] = scribe_meta

        if edited_soap:
            update_payload["soap_note"] = edited_soap
        if edited_medications:
            update_payload["medications"] = edited_medications

        await update_document("consultations", consultation_id, update_payload)

        # Retrieve appointment & patient details for billing trigger
        appointment_id = consultation.get("appointment_id")
        appointment = await get_document("appointments", appointment_id) if appointment_id else None
        patient_id = appointment.get("patient_id") if appointment else None
        patient = await get_document("patients", patient_id) if patient_id else None
        patient_phone = patient.get("phone") if patient else None

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
                    consultation_type=consultation_type,
                    patient_id=patient_id
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

        # Emit approval audit event
        try:
            from event_bus import ClinicalEvent, create_event, get_event_bus
            bus = get_event_bus()
            await bus.emit(create_event(
                ClinicalEvent.PRESCRIPTION_APPROVED,
                clinic_id=clinic_id,
                consultation_id=consultation_id,
                patient_id=patient_id,
                doctor_id=current_user.get("uid") if current_user else None,
                trigger="clinician:approve",
                payload={"consultation_type": consultation_type, "medication_count": len(effective_meds)},
            ))
        except Exception as e:
            logger.warning(f"Failed to emit approval audit event: {e}")

        return {
            "status": "approved",
            "consultation_id": consultation_id,
            "billing": billing_result
        }
