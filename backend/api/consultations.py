import os
import tempfile
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Response
from pydantic import BaseModel, Field

from api.auth import get_current_user, verify_clinic_access
from database.firestore import get_document, query_documents
from agents.clinical_scribe import ClinicalScribeAgent
from agents.prescription_safe import PrescriptionSafeAgent
from agents.referral_coordinator import ReferralCoordinatorAgent
from services.pdf_generator import generate_prescription_pdf

logger = logging.getLogger("vaidyaai.api.consultations")
router = APIRouter()

scribe_agent = ClinicalScribeAgent()
prescription_safe_agent = PrescriptionSafeAgent()
referral_coordinator_agent = ReferralCoordinatorAgent()


# ─── Request Schemas ─────────────────────────────────────────────────────────

class StartConsultationRequest(BaseModel):
    clinic_id: str
    appointment_id: str


class TranscribeRequest(BaseModel):
    clinic_id: str
    consultation_id: str
    appointment_id: str
    chunk_paths: List[str]
    patient_history: Optional[str] = ""
    vitals: Optional[str] = ""
    language_code: Optional[str] = "te-IN"


class ApproveConsultationRequest(BaseModel):
    clinic_id: str
    edited_soap: Optional[Dict[str, Any]] = None
    edited_medications: Optional[List[Dict[str, Any]]] = None
    consultation_type: Optional[str] = "new"


class SafetyCheckRequest(BaseModel):
    clinic_id: str
    medications: List[Dict[str, Any]]
    patient_id: Optional[str] = None


class OverrideSafetyRequest(BaseModel):
    clinic_id: str
    override_reason: str


class CreateReferralRequest(BaseModel):
    clinic_id: str
    patient_phone: str
    speciality: Optional[str] = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/consultations/start", tags=["consultations"])
async def start_consultation_endpoint(
    req: StartConsultationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    POST /api/v1/consultations/start
    Creates a new, isolated Firestore consultation document for the appointment.
    Validates appointment belongs to clinic_id and extracts verified patient_id.
    """
    verify_clinic_access(req.clinic_id, current_user)

    appointment = await get_document("appointments", req.appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if appointment.get("clinic_id") != req.clinic_id:
        raise HTTPException(status_code=403, detail="Access denied: appointment belongs to a different clinic")

    patient_id = appointment.get("patient_id")
    if not patient_id:
        raise HTTPException(status_code=400, detail="Appointment is missing patient_id link")

    # Check if a consultation already exists for this appointment
    existing = await query_documents("consultations", [("clinic_id", "==", req.clinic_id), ("appointment_id", "==", req.appointment_id)])
    if existing:
        cons = existing[0]
        return {
            "consultation_id": cons["consultation_id"],
            "patient_id": cons.get("patient_id", patient_id),
            "appointment_id": req.appointment_id,
            "status": cons.get("status", "draft")
        }

    from datetime import datetime, timezone
    now_utc = datetime.now(timezone.utc)
    new_cons_id = f"cons_{int(now_utc.timestamp())}"

    cons_doc = {
        "consultation_id": new_cons_id,
        "clinic_id": req.clinic_id,
        "appointment_id": req.appointment_id,
        "patient_id": patient_id,
        "status": "draft",
        "transcript_raw": "",
        "transcript_anonymised": "",
        "soap_note": {"subjective": "", "objective": "", "assessment": "", "plan": ""},
        "diagnoses": [],
        "medications": [],
        "investigations": [],
        "referrals": [],
        "followup_days": 5,
        "created_at": now_utc,
        "updated_at": now_utc
    }
    await set_document("consultations", new_cons_id, cons_doc)

    return {
        "consultation_id": new_cons_id,
        "patient_id": patient_id,
        "appointment_id": req.appointment_id,
        "status": "draft"
    }


@router.post("/consultations/upload-chunk", tags=["consultations"])
async def upload_audio_chunk(
    consultation_id: str = Query(...),
    clinic_id: str = Query(...),
    chunk_index: int = Query(...),
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    verify_clinic_access(clinic_id, current_user)

    temp_dir = os.path.join(tempfile.gettempdir(), "vaidyaai_audio", consultation_id)
    os.makedirs(temp_dir, exist_ok=True)

    chunk_filename = f"chunk_{chunk_index:04d}.webm"
    chunk_path = os.path.join(temp_dir, chunk_filename)

    content = await file.read()
    with open(chunk_path, "wb") as f:
        f.write(content)

    logger.info(f"Saved audio chunk {chunk_index} for consultation {consultation_id} ({len(content)} bytes)")
    return {
        "consultation_id": consultation_id,
        "chunk_index": chunk_index,
        "chunk_path": chunk_path,
        "status": "uploaded"
    }


@router.post("/consultations/transcribe", tags=["consultations"])
async def transcribe_consultation(
    req: TranscribeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    verify_clinic_access(req.clinic_id, current_user)

    result = await scribe_agent.process_consultation_audio(
        consultation_id=req.consultation_id,
        clinic_id=req.clinic_id,
        appointment_id=req.appointment_id,
        chunk_paths=req.chunk_paths,
        patient_history=req.patient_history or "",
        vitals=req.vitals or "",
        language_code=req.language_code or "te-IN"
    )
    return result


@router.get("/consultations/{id}", tags=["consultations"])
async def get_consultation(
    id: str,
    clinic_id: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    verify_clinic_access(clinic_id, current_user)
    consultation = await get_document("consultations", id)
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation record not found")
    if consultation.get("clinic_id") != clinic_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return consultation


@router.post("/consultations/{id}/check-safety", tags=["consultations"])
async def check_prescription_safety(
    id: str,
    req: SafetyCheckRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    verify_clinic_access(req.clinic_id, current_user)
    return await prescription_safe_agent.validate_prescription(
        consultation_id=id,
        clinic_id=req.clinic_id,
        medications=req.medications,
        patient_id=req.patient_id
    )


@router.post("/consultations/{id}/override-safety", tags=["consultations"])
async def override_prescription_safety(
    id: str,
    req: OverrideSafetyRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    verify_clinic_access(req.clinic_id, current_user)
    return await prescription_safe_agent.override_safety_warning(
        consultation_id=id,
        clinic_id=req.clinic_id,
        doctor_uid=current_user["uid"],
        override_reason=req.override_reason
    )


@router.post("/consultations/{id}/referral", tags=["consultations"])
async def create_consultation_referral(
    id: str,
    req: CreateReferralRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    POST /api/v1/consultations/{id}/referral
    Invokes Agent 7 (ReferralCoordinator) to generate formal referral letter and notify patient via WhatsApp.
    """
    verify_clinic_access(req.clinic_id, current_user)
    return await referral_coordinator_agent.generate_and_track_referral(
        consultation_id=id,
        clinic_id=req.clinic_id,
        patient_phone=req.patient_phone,
        speciality=req.speciality
    )


@router.get("/referrals", tags=["consultations"])
async def list_clinic_referrals(
    clinic_id: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    GET /api/v1/referrals?clinic_id={id}
    Returns list of referral tracking documents for the clinic.
    """
    verify_clinic_access(clinic_id, current_user)
    return await query_documents("referrals", [("clinic_id", "==", clinic_id)])


@router.post("/consultations/{id}/approve", tags=["consultations"])
async def approve_consultation(
    id: str,
    req: ApproveConsultationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    verify_clinic_access(req.clinic_id, current_user)

    result = await scribe_agent.approve_consultation(
        consultation_id=id,
        clinic_id=req.clinic_id,
        edited_soap=req.edited_soap,
        edited_medications=req.edited_medications,
        consultation_type=req.consultation_type or "new"
    )
    return result


@router.get("/consultations/{id}/pdf", tags=["consultations"])
async def download_prescription_pdf(
    id: str,
    clinic_id: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    verify_clinic_access(clinic_id, current_user)

    consultation = await get_document("consultations", id)
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    clinic = await get_document("clinics", clinic_id) or {}
    patient = {}
    if consultation.get("appointment_id"):
        app = await get_document("appointments", consultation["appointment_id"])
        if app:
            patient = {
                "name": app.get("patient_name", "Patient"),
                "phone_masked": app.get("patient_phone_masked", "XXXX")
            }

    pdf_bytes = await generate_prescription_pdf(
        clinic_info=clinic,
        patient_info=patient,
        consultation_data=consultation
    )

    filename = f"prescription_{id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
