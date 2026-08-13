import uuid
import logging
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

from api.auth import get_current_user, verify_clinic_access
from database.firestore import get_document, set_document, update_document, query_documents
from utils.phone_utils import mask_phone, normalize_phone
from utils.patient_identity import resolve_patient_id

logger = logging.getLogger("vaidyaai.api.patients")
router = APIRouter()

DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200
# Firestore lacks native substring search; when a search term is provided we scan a
# bounded window of the clinic's patients and filter in-memory.
SEARCH_SCAN_LIMIT = 500
# Upper bound on records fetched per collection when assembling a patient timeline.
TIMELINE_MAX_RECORDS = 200


class PatientCreateRequest(BaseModel):
    clinic_id: str
    phone: str
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    allergies: Optional[List[str]] = []
    chronic_conditions: Optional[List[str]] = []
    blood_group: Optional[str] = None


class PatientRegisterRequest(BaseModel):
    clinic_id: str
    phone: str
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    complaint_summary: Optional[str] = "New Patient Consultation"



@router.get("/patients", tags=["patients"])
async def list_patients(
    clinic_id: str = Query(...),
    search: Optional[str] = Query(None),
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(0, ge=0),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    verify_clinic_access(clinic_id, current_user)

    if search:
        candidates = await query_documents(
            "patients", [("clinic_id", "==", clinic_id)], limit=SEARCH_SCAN_LIMIT
        )
        s_lower = search.lower()
        matched = [
            p for p in candidates
            if s_lower in p.get("name", "").lower()
            or s_lower in p.get("phone", "").lower()
            or s_lower in p.get("patient_phone_masked", "").lower()
        ]
        return matched[offset:offset + limit]

    return await query_documents(
        "patients", [("clinic_id", "==", clinic_id)], limit=limit, offset=offset
    )


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

    identity = await resolve_patient_id(req.clinic_id, formatted_phone)
    patient_id = identity["patient_id"]

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

    appointments = await query_documents(
        "appointments",
        [("clinic_id", "==", clinic_id), ("patient_id", "==", id)],
        limit=TIMELINE_MAX_RECORDS,
    )

    appt_ids = [a["id"] for a in appointments if a.get("id")]

    # Consultations are linked to a patient only via their appointment_id, so fetch
    # per-appointment (concurrently) instead of scanning every clinic consultation.
    consultations: List[Dict[str, Any]] = []
    if appt_ids:
        cons_groups = await asyncio.gather(*[
            query_documents(
                "consultations",
                [("clinic_id", "==", clinic_id), ("appointment_id", "==", appt_id)],
            )
            for appt_id in appt_ids
        ])
        for group in cons_groups:
            consultations.extend(group)

    # Referrals are linked to a patient only via their consultation_id; filtering by
    # clinic_id alone would leak every clinic patient's referrals into this timeline.
    cons_ids = [c["consultation_id"] for c in consultations if c.get("consultation_id")]
    referrals: List[Dict[str, Any]] = []
    if cons_ids:
        ref_groups = await asyncio.gather(*[
            query_documents(
                "referrals",
                [("clinic_id", "==", clinic_id), ("consultation_id", "==", cons_id)],
            )
            for cons_id in cons_ids
        ])
        for group in ref_groups:
            referrals.extend(group)

    return {
        "patient_id": id,
        "name": patient.get("name"),
        "phone_masked": masked_phone,
        "allergies": patient.get("allergies", []),
        "chronic_conditions": patient.get("chronic_conditions", []),
        "total_visits": len(appointments),
        "appointments": appointments,
        "consultations": consultations,
        "referrals": referrals
    }


@router.post("/patients/register", tags=["patients"])
async def register_patient_endpoint(
    req: PatientRegisterRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    POST /api/v1/patients/register
    Creates a new patient profile AND creates a same-day appointment for immediate consultation.
    Returns: {"patient_id": str, "appointment_id": str, "consultation_id": None, "patient_name": str, "success": True}
    """
    verify_clinic_access(req.clinic_id, current_user)

    formatted_phone = normalize_phone(req.phone)
    masked_phone_str = mask_phone(formatted_phone)
    now_utc = datetime.now(timezone.utc)

    identity = await resolve_patient_id(req.clinic_id, formatted_phone)
    patient_id = identity["patient_id"]
    is_new_patient = identity["is_new"]

    if not is_new_patient and identity.get("existing_patient"):
        existing = identity["existing_patient"]
        visit_count = (existing.get("visit_count") or 0) + 1
        await update_document("patients", patient_id, {
            "visit_count": visit_count,
            "updated_at": now_utc
        })
    else:
        patient_doc = {
            "patient_id": patient_id,
            "clinic_id": req.clinic_id,
            "name": req.name,
            "phone": formatted_phone,
            "patient_phone_masked": masked_phone_str,
            "age": req.age,
            "gender": req.gender,
            "allergies": [],
            "chronic_conditions": [],
            "visit_count": 1,
            "consent_given": True,
            "consent_at": now_utc,
            "opted_out": False,
            "is_active": True,
            "created_at": now_utc,
            "updated_at": now_utc
        }
        await set_document("patients", patient_id, patient_doc)

    today_date = now_utc.strftime("%Y-%m-%d")
    existing_appts = await query_documents("appointments", [("clinic_id", "==", req.clinic_id), ("slot_date", "==", today_date)])
    queue_number = len(existing_appts) + 1

    app_id = f"app_reg_{int(now_utc.timestamp())}_{uuid.uuid4().hex[:6]}"
    appointment_data = {
        "appointment_id": app_id,
        "clinic_id": req.clinic_id,
        "patient_id": patient_id,
        "patient_name": req.name,
        "patient_phone_masked": masked_phone_str,
        "slot_time": now_utc,
        "slot_date": today_date,
        "slot_time_str": now_utc.strftime("%I:%M %p"),
        "duration_minutes": 15,
        "complaint_summary": req.complaint_summary or "New Patient Consultation",
        "status": "arrived",
        "consultation_type": "new",
        "booked_by": "registration",
        "queue_number": queue_number,
        "created_at": now_utc
    }
    await set_document("appointments", app_id, appointment_data)

    return {
        "patient_id": patient_id,
        "appointment_id": app_id,
        "consultation_id": None,
        "patient_name": req.name,
        "success": True
    }

