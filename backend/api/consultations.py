import os
import tempfile
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Response
from pydantic import BaseModel, Field

from api.auth import get_current_user, verify_clinic_access
from database.firestore import get_document, query_documents, set_document, update_document
from agents.clinical_scribe import ClinicalScribeAgent
from agents.prescription_safe import PrescriptionSafeAgent
from agents.referral_coordinator import ReferralCoordinatorAgent
from services.pdf_generator import generate_prescription_pdf
from event_bus import ClinicalEvent, create_event, get_event_bus

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
    transcript_reviewed: Optional[bool] = False


class SafetyCheckRequest(BaseModel):
    clinic_id: str
    medications: List[Dict[str, Any]]
    patient_id: Optional[str] = None


class OverrideSafetyRequest(BaseModel):
    clinic_id: str
    override_reason: str


class UpdateVitalsRequest(BaseModel):
    clinic_id: str
    vitals: Dict[str, Any]


class UpdateClinicalHistoryRequest(BaseModel):
    clinic_id: str
    allergies: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None
    current_medications: Optional[List[Any]] = None


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
            "status": cons.get("status", "draft"),
            "vitals": cons.get("vitals", {})
        }

    from datetime import datetime, timezone
    now_utc = datetime.now(timezone.utc)
    new_cons_id = f"cons_{int(now_utc.timestamp())}"

    # Preload existing longitudinal patient background if available
    patient_doc = await get_document("patients", patient_id) if patient_id else None
    preloaded_allergies = list(patient_doc.get("allergies", [])) if patient_doc else []
    preloaded_chronic = list(patient_doc.get("chronic_conditions", [])) if patient_doc else []
    preloaded_meds = list(patient_doc.get("current_medications", [])) if patient_doc else []

    cons_doc = {
        "consultation_id": new_cons_id,
        "clinic_id": req.clinic_id,
        "appointment_id": req.appointment_id,
        "patient_id": patient_id,
        "status": "draft",
        "vitals": {},
        "patient_allergies": preloaded_allergies,
        "patient_chronic_diseases": preloaded_chronic,
        "patient_current_medications": preloaded_meds,
        "transcript_raw": "",
        "transcript_anonymised": "",
        "soap_note": {"subjective": "", "objective": "", "assessment": "", "plan": ""},
        "diagnoses": [],
        "medications": [],
        "investigations": [],
        "referrals": [],
        "followup_days": 3,
        "created_at": now_utc,
        "updated_at": now_utc
    }
    await set_document("consultations", new_cons_id, cons_doc)

    # Emit CONSULTATION_STARTED event AFTER database commit
    bus = get_event_bus()
    await bus.emit(create_event(
        ClinicalEvent.CONSULTATION_STARTED,
        clinic_id=req.clinic_id,
        patient_id=patient_id,
        visit_id=req.appointment_id,
        consultation_id=new_cons_id,
        doctor_id=current_user.get("uid"),
        trigger="api:start_consultation",
    ))

    return {
        "consultation_id": new_cons_id,
        "patient_id": patient_id,
        "appointment_id": req.appointment_id,
        "status": "draft",
        "vitals": {}
    }


@router.post("/consultations/{id}/vitals", tags=["consultations"])
async def update_consultation_vitals(
    id: str,
    req: UpdateVitalsRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    POST /api/v1/consultations/{id}/vitals
    Saves or updates clinician-verified structured vitals for a consultation session.
    """
    verify_clinic_access(req.clinic_id, current_user)
    consultation = await get_document("consultations", id)
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation record not found")

    from datetime import datetime, timezone
    await update_document("consultations", id, {
        "vitals": req.vitals,
        "updated_at": datetime.now(timezone.utc)
    })

    logger.info(f"Updated vitals for consultation '{id}': {req.vitals}")
    return {
        "consultation_id": id,
        "vitals": req.vitals,
        "status": "updated"
    }


@router.post("/consultations/{id}/clinical-history", tags=["consultations"])
async def update_consultation_clinical_history(
    id: str,
    req: UpdateClinicalHistoryRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    verify_clinic_access(req.clinic_id, current_user)
    consultation = await get_document("consultations", id)
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation record not found")

    from datetime import datetime, timezone
    now_utc = datetime.now(timezone.utc)
    update_data: Dict[str, Any] = {"updated_at": now_utc}
    if req.allergies is not None:
        update_data["patient_allergies"] = req.allergies
    if req.chronic_conditions is not None:
        update_data["patient_chronic_diseases"] = req.chronic_conditions
    if req.current_medications is not None:
        update_data["patient_current_medications"] = req.current_medications

    await update_document("consultations", id, update_data)

    patient_id = consultation.get("patient_id")
    if patient_id:
        pat_update: Dict[str, Any] = {"updated_at": now_utc}
        if req.allergies is not None:
            pat_update["allergies"] = req.allergies
        if req.chronic_conditions is not None:
            pat_update["chronic_conditions"] = req.chronic_conditions
        if req.current_medications is not None:
            pat_update["current_medications"] = req.current_medications
        await update_document("patients", patient_id, pat_update)

    logger.info(f"Updated clinical history for consultation '{id}' (Patient '{patient_id}')")
    return {
        "consultation_id": id,
        "patient_id": patient_id,
        "patient_allergies": req.allergies,
        "patient_chronic_diseases": req.chronic_conditions,
        "patient_current_medications": req.current_medications,
        "status": "updated"
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

    chunk_paths = list(req.chunk_paths) if req.chunk_paths else []

    # Check for server-side audio chunks directory if chunk_paths is empty or incomplete
    temp_dir = os.path.join(tempfile.gettempdir(), "vaidyaai_audio", req.consultation_id)
    if os.path.isdir(temp_dir):
        disk_chunks = sorted([
            os.path.join(temp_dir, f)
            for f in os.listdir(temp_dir)
            if f.startswith("chunk_") and (f.endswith(".webm") or f.endswith(".wav") or f.endswith(".mp4") or f.endswith(".ogg"))
        ])
        if disk_chunks and (len(disk_chunks) > len(chunk_paths) or not chunk_paths):
            logger.info(f"Discovered {len(disk_chunks)} audio chunks on disk for consultation {req.consultation_id}")
            chunk_paths = disk_chunks

    result = await scribe_agent.process_consultation_audio(
        consultation_id=req.consultation_id,
        clinic_id=req.clinic_id,
        appointment_id=req.appointment_id,
        chunk_paths=chunk_paths,
        patient_history=req.patient_history or "",
        vitals=req.vitals or "",
        language_code=req.language_code or "te-IN"
    )

    # Emit SOAP_GENERATED event AFTER database commit
    bus = get_event_bus()
    await bus.emit(create_event(
        ClinicalEvent.SOAP_GENERATED,
        clinic_id=req.clinic_id,
        visit_id=req.appointment_id,
        consultation_id=req.consultation_id,
        doctor_id=current_user.get("uid"),
        trigger="api:transcribe",
        payload={
            "medications": result.get("medications", []),
            "diagnoses": result.get("diagnoses", []),
            "referrals": result.get("referrals", [])
        }
    ))

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

    if consultation.get("appointment_id"):
        app = await get_document("appointments", consultation["appointment_id"])
        if app:
            consultation["patient_name"] = app.get("patient_name", "Patient")
            consultation["patient_phone_masked"] = app.get("patient_phone_masked", app.get("patient_phone", "XXXX"))
            consultation["complaint_summary"] = app.get("complaint_summary", "Consultation")
            consultation["consultation_type"] = app.get("consultation_type", "new")

    # Ensure vitals only come from the consultation encounter
    consultation["vitals"] = consultation.get("vitals") or {}

    if consultation.get("patient_id"):
        pat = await get_document("patients", consultation["patient_id"])
        if pat:
            consultation["patient_age"] = pat.get("age") if pat.get("age") is not None else "Not Recorded"
            consultation["patient_gender"] = pat.get("gender") if pat.get("gender") else "Not Recorded"
            consultation["patient_blood_group"] = pat.get("blood_group") or pat.get("blood_type") or "Not Recorded"
            if not consultation.get("patient_allergies"):
                consultation["patient_allergies"] = pat.get("allergies") if pat.get("allergies") is not None else []
            if not consultation.get("patient_chronic_diseases"):
                consultation["patient_chronic_diseases"] = pat.get("chronic_conditions") if pat.get("chronic_conditions") is not None else pat.get("medical_history", [])
            if not consultation.get("patient_current_medications"):
                consultation["patient_current_medications"] = pat.get("current_medications", [])

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
    result = await referral_coordinator_agent.generate_and_track_referral(
        consultation_id=id,
        clinic_id=req.clinic_id,
        patient_phone=req.patient_phone,
        speciality=req.speciality
    )

    # Emit REFERRAL_CREATED event AFTER database commit
    bus = get_event_bus()
    await bus.emit(create_event(
        ClinicalEvent.REFERRAL_CREATED,
        clinic_id=req.clinic_id,
        consultation_id=id,
        doctor_id=current_user.get("uid"),
        trigger="api:create_referral",
        payload={"speciality": req.speciality, "patient_phone_masked": req.patient_phone[-4:] if req.patient_phone else "XXXX"}
    ))

    return result


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
        consultation_type=req.consultation_type or "new",
        transcript_reviewed=req.transcript_reviewed or False,
        doctor_uid=current_user.get("uid")
    )

    if isinstance(result, dict) and result.get("error"):
        from fastapi.encoders import jsonable_encoder
        error_type = result.get("error")
        status_code = 404 if error_type in ("not_found", "Consultation not found") else 400
        raise HTTPException(status_code=status_code, detail=jsonable_encoder(result))

    # Emit PRESCRIPTION_APPROVED event AFTER database commit
    bus = get_event_bus()
    # Get consultation to extract appointment/patient phone
    cons = await get_document("consultations", id) or {}
    app = await get_document("appointments", cons.get("appointment_id", "")) if cons.get("appointment_id") else None

    await bus.emit(create_event(
        ClinicalEvent.PRESCRIPTION_APPROVED,
        clinic_id=req.clinic_id,
        visit_id=cons.get("appointment_id"),
        consultation_id=id,
        patient_id=cons.get("patient_id"),
        doctor_id=current_user.get("uid"),
        trigger="api:approve_consultation",
        payload={
            "patient_phone": app.get("patient_phone_masked") if app else None,
            "consultation_type": req.consultation_type or "new"
        }
    ))

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


@router.get("/consultations/{id}/activity", tags=["consultations"])
async def get_consultation_activity(
    id: str,
    clinic_id: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    GET /api/v1/consultations/{id}/activity?clinic_id={id}
    Returns the REAL agent activity log scoped to this consultation.
    Used by the consultation workspace activity feed so that every item shown
    is backed by an actual agent_logs record (no fabricated/hardcoded entries).
    """
    verify_clinic_access(clinic_id, current_user)

    consultation = await get_document("consultations", id)
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    from datetime import datetime, timezone

    def _format_dt(val):
        if not val:
            return None
        if isinstance(val, datetime):
            dt = val if val.tzinfo else val.replace(tzinfo=timezone.utc)
            return dt.isoformat()
        if isinstance(val, str):
            try:
                dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
                return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()
            except Exception:
                return None
        if hasattr(val, "toDate"):
            try:
                dt = val.toDate()
                return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()
            except Exception:
                return None
        return None

    # Query agent_logs scoped to this clinic and consultation.
    logs = await query_documents(
        "agent_logs",
        [("clinic_id", "==", clinic_id)],
        limit=200,
    )

    activity = []
    for l in logs:
        # Match by consultation_id when present; otherwise skip (do not fabricate).
        if l.get("consultation_id") and l["consultation_id"] != id:
            continue
        if not l.get("consultation_id"):
            continue
        activity.append({
            "id": l.get("log_id") or l.get("id"),
            "agent": l.get("agent_name", "system"),
            "decision_type": l.get("decision_type"),
            "message": l.get("decision_made", ""),
            "status": "completed" if l.get("success") is not False else "failed",
            "model_used": l.get("model_used"),
            "latency_ms": l.get("latency_ms"),
            "created_at": _format_dt(l.get("created_at")),
        })

    # Sort chronologically (oldest first) for a natural feed
    def _sort_key(a):
        ts = a.get("created_at") or ""
        return ts

    activity.sort(key=_sort_key)

    return {
        "consultation_id": id,
        "clinic_id": clinic_id,
        "items": activity,
        "count": len(activity),
    }


# ─── Patient Summary Endpoint ────────────────────────────────────────────────

@router.get("/consultations/patient-summary/{patient_id}", tags=["consultations"])
async def get_patient_summary(
    patient_id: str,
    clinic_id: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Generate a grounded longitudinal patient summary from reviewed consultations."""
    verify_clinic_access(clinic_id, current_user)
    from utils.patient_summary import generate_patient_summary
    summary = await generate_patient_summary(patient_id=patient_id, clinic_id=clinic_id)
    if summary.get("error"):
        raise HTTPException(status_code=404, detail=summary["error"])
    return summary


@router.get("/consultations/{id}/fhir", tags=["consultations"])
async def export_consultation_fhir(
    id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Export a consultation as a FHIR R4 Bundle."""
    consultation = await get_document("consultations", id)
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    verify_clinic_access(consultation.get("clinic_id", ""), current_user)

    patient = await get_document("patients", consultation.get("patient_id", ""))
    clinic = await get_document("clinics", consultation.get("clinic_id", ""))

    from integrations.fhir_r4 import export_consultation_to_fhir
    return await export_consultation_to_fhir(
        consultation=consultation, patient=patient or {}, clinic=clinic or {})
