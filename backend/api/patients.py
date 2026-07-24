import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

from api.auth import get_current_user, verify_clinic_access
from database.firestore import get_document, set_document, update_document, query_documents
from utils.phone_utils import mask_phone, normalize_phone

logger = logging.getLogger("vaidyaai.api.patients")
router = APIRouter()


class PatientCreateRequest(BaseModel):
    clinic_id: str
    phone: str
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    allergies: Optional[List[str]] = []
    chronic_conditions: Optional[List[str]] = []
    blood_group: Optional[str] = None


@router.get("/patients", tags=["patients"])
async def list_patients(
    clinic_id: str = Query(...),
    search: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    verify_clinic_access(clinic_id, current_user)
    patients = await query_documents("patients", [("clinic_id", "==", clinic_id)], limit=50)

    if search:
        s_lower = search.lower()
        patients = [
            p for p in patients
            if s_lower in p.get("name", "").lower() or s_lower in p.get("phone", "").lower() or s_lower in p.get("patient_phone_masked", "").lower()
        ]

    return patients


@router.get("/patients/{id}", tags=["patients"])
async def get_patient(
    id: str,
    clinic_id: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    verify_clinic_access(clinic_id, current_user)
    patient = await get_document("patients", id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    if patient.get("clinic_id") != clinic_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return patient


@router.post("/patients", tags=["patients"])
async def create_or_update_patient(
    req: PatientCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    verify_clinic_access(req.clinic_id, current_user)

    formatted_phone = normalize_phone(req.phone)
    masked_phone_str = mask_phone(formatted_phone)
    patient_id = f"pat_{formatted_phone.replace('+', '')}"

    now_utc = datetime.now(timezone.utc)
    patient_doc = {
        "patient_id": patient_id,
        "clinic_id": req.clinic_id,
        "name": req.name,
        "phone": formatted_phone,
        "patient_phone_masked": masked_phone_str,
        "age": req.age,
        "gender": req.gender,
        "allergies": req.allergies or [],
        "chronic_conditions": req.chronic_conditions or [],
        "blood_group": req.blood_group,
        "updated_at": now_utc
    }

    existing = await get_document("patients", patient_id)
    if not existing:
        patient_doc["created_at"] = now_utc

    await set_document("patients", patient_id, patient_doc)
    return patient_doc


@router.get("/patients/{id}/timeline", tags=["patients"])
async def get_patient_clinical_timeline(
    id: str,
    clinic_id: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    verify_clinic_access(clinic_id, current_user)
    patient = await get_document("patients", id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    masked_phone = patient.get("patient_phone_masked")

    appointments = await query_documents("appointments", [("clinic_id", "==", clinic_id), ("patient_id", "==", id)], limit=50)
    consultations = await query_documents("consultations", [("clinic_id", "==", clinic_id)], limit=50)
    referrals = await query_documents("referrals", [("clinic_id", "==", clinic_id)], limit=50)

    appt_ids = {a["appointment_id"] for a in appointments}
    patient_consultations = [c for c in consultations if c.get("appointment_id") in appt_ids]

    return {
        "patient_id": id,
        "name": patient.get("name"),
        "phone_masked": masked_phone,
        "allergies": patient.get("allergies", []),
        "chronic_conditions": patient.get("chronic_conditions", []),
        "total_visits": len(appointments),
        "appointments": appointments,
        "consultations": patient_consultations,
        "referrals": referrals
    }
