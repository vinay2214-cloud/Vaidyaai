import uuid
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

from api.auth import get_current_user, verify_clinic_access
from database.firestore import (
    get_appointments_today,
    get_document,
    set_document,
    update_document,
    get_patient_by_phone
)
from tasks.cloud_tasks import cancel_task
from utils.phone_utils import mask_phone, normalize_phone
from utils.date_utils import get_today_ist_date_str, get_current_ist_datetime
from utils.patient_identity import resolve_patient_id
from event_bus import ClinicalEvent, create_event, get_event_bus

logger = logging.getLogger("vaidyaai.api.appointments")
router = APIRouter()


# ─── Request / Response Schemas ──────────────────────────────────────────────

class WalkInRequest(BaseModel):
    clinic_id: str
    patient_phone: Optional[str] = None
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    address: Optional[str] = None
    occupation: Optional[str] = None
    emergency_contact: Optional[str] = None
    allergies: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None
    complaint_summary: Optional[str] = "Walk-in Consultation"
    consultation_type: str = Field(default="new", pattern="^(new|followup|procedure)$")
    vitals: Optional[Dict[str, Any]] = None


class StatusUpdateRequest(BaseModel):
    clinic_id: str
    status: str = Field(pattern="^(arrived|in_progress|completed|no_show|cancelled)$")
    cancel_reason: Optional[str] = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/appointments/today", tags=["appointments"])
async def get_today_appointments_endpoint(
    clinic_id: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    GET /api/v1/appointments/today?clinic_id={id}
    Returns today's appointment list for the authenticated doctor's clinic.
    Enforces strict tenant isolation.
    """
    verify_clinic_access(clinic_id, current_user)
    
    today_date = get_today_ist_date_str()
    appointments = await get_appointments_today(clinic_id, today_date)
    
    # Sort by queue_number or created_at
    appointments.sort(key=lambda x: x.get("queue_number", 999))
    
    return appointments


@router.post("/appointments/walk-in", tags=["appointments"])
async def create_walk_in_appointment(
    req: WalkInRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    POST /api/v1/appointments/walk-in
    Creates a same-day walk-in appointment for patients arriving directly at the clinic.
    Creates a fresh unique patient profile without fabricating demo data.
    """
    verify_clinic_access(req.clinic_id, current_user)

    today_date = get_today_ist_date_str()
    now_utc = datetime.now(timezone.utc)

    # 1. Resolve patient: prefer explicit patient_id, else phone lookup, else create new
    resolved_patient_name = req.patient_name
    if req.patient_id:
        existing_patient = await get_document("patients", req.patient_id)
        if existing_patient and existing_patient.get("clinic_id") == req.clinic_id:
            patient_id = existing_patient["patient_id"]
            normalized_phone = existing_patient.get("phone", "")
            resolved_patient_name = req.patient_name or existing_patient.get("name")
            update_data: Dict[str, Any] = {
                "visit_count": (existing_patient.get("visit_count") or 1) + 1
            }
            update_fields = {
                "name": req.patient_name,
                "age": req.patient_age,
                "gender": req.patient_gender,
                "address": req.address,
                "occupation": req.occupation,
                "emergency_contact": req.emergency_contact,
            }
            for k, v in update_fields.items():
                if v is not None and not existing_patient.get(k):
                    update_data[k] = v
            await update_document("patients", patient_id, update_data)
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="The specified patient_id does not exist in this clinic."
            )
    else:
        if not req.patient_phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either patient_id or patient_phone is required."
            )
        normalized_phone = normalize_phone(req.patient_phone)
        patient = await get_patient_by_phone(normalized_phone, req.clinic_id)
        if not patient:
            identity = await resolve_patient_id(req.clinic_id, normalized_phone)
            patient_id = identity["patient_id"]
            resolved_patient_name = req.patient_name
            patient_data = {
                "patient_id": patient_id,
                "clinic_id": req.clinic_id,
                "phone": normalized_phone,
                "phone_masked": mask_phone(normalized_phone),
                "name": req.patient_name,
                "age": req.patient_age,
                "gender": req.patient_gender,
                "address": req.address,
                "occupation": req.occupation,
                "emergency_contact": req.emergency_contact,
                "language_preference": "te",
                "allergies": req.allergies if req.allergies is not None else [],
                "chronic_conditions": req.chronic_conditions if req.chronic_conditions is not None else [],
                "visit_count": 1,
                "consent_given": True,
                "consent_at": now_utc,
                "opted_out": False,
                "is_active": True,
                "created_at": now_utc
            }
            await set_document("patients", patient_id, patient_data)
        else:
            patient_id = patient["patient_id"]
            resolved_patient_name = req.patient_name or patient.get("name")
            update_data: Dict[str, Any] = {
                "visit_count": (patient.get("visit_count") or 1) + 1
            }
            if req.patient_name and not patient.get("name"):
                update_data["name"] = req.patient_name
            if req.patient_age and not patient.get("age"):
                update_data["age"] = req.patient_age
            if req.patient_gender and not patient.get("gender"):
                update_data["gender"] = req.patient_gender
            if req.address and not patient.get("address"):
                update_data["address"] = req.address
            if req.occupation and not patient.get("occupation"):
                update_data["occupation"] = req.occupation
            if req.emergency_contact and not patient.get("emergency_contact"):
                update_data["emergency_contact"] = req.emergency_contact
            await update_document("patients", patient_id, update_data)

    # 2. Calculate queue number and slot time
    today_appts = await get_appointments_today(req.clinic_id, today_date)
    queue_number = len(today_appts) + 1
    
    now_ist = get_current_ist_datetime()
    slot_time_str = now_ist.strftime("%I:%M %p")

    # 3. Save appointment to Firestore
    app_id = f"app_walkin_{int(now_utc.timestamp())}_{uuid.uuid4().hex[:4]}"
    appointment_data = {
        "appointment_id": app_id,
        "clinic_id": req.clinic_id,
        "patient_id": patient_id,
        "patient_name": resolved_patient_name,
        "patient_phone_masked": mask_phone(normalized_phone),
        "slot_time": now_utc,
        "slot_date": today_date,
        "slot_time_str": slot_time_str,
        "duration_minutes": 15,
        "complaint_summary": req.complaint_summary,
        "status": "arrived",  # Walk-in starts as arrived
        "consultation_type": req.consultation_type,
        "booked_by": "walk_in",
        "queue_number": queue_number,
        "vitals": req.vitals or {},
        "created_at": now_utc
    }
    await set_document("appointments", app_id, appointment_data)

    logger.info(f"Created walk-in appointment '{app_id}' (# {queue_number}) for clinic {req.clinic_id}")

    # Emit events AFTER database commit
    bus = get_event_bus()
    correlation_id = f"corr_{int(now_utc.timestamp())}"

    await bus.emit(create_event(
        ClinicalEvent.PATIENT_REGISTERED,
        clinic_id=req.clinic_id,
        correlation_id=correlation_id,
        patient_id=patient_id,
        doctor_id=current_user.get("uid"),
        trigger="api:walk_in",
        payload={"patient_name": resolved_patient_name, "phone_masked": mask_phone(normalized_phone)},
    ))

    await bus.emit(create_event(
        ClinicalEvent.VISIT_CREATED,
        clinic_id=req.clinic_id,
        correlation_id=correlation_id,
        causation_id=f"patient_registered:{patient_id}",
        patient_id=patient_id,
        visit_id=app_id,
        doctor_id=current_user.get("uid"),
        trigger="api:walk_in",
        payload={"queue_number": queue_number, "slot_time_str": slot_time_str, "complaint": req.complaint_summary},
    ))

    return {
        "appointment_id": app_id,
        "patient_id": patient_id,
        "patient_name": resolved_patient_name,
        "slot_date": today_date,
        "slot_time_str": slot_time_str,
        "queue_number": queue_number,
        "status": "arrived"
    }


@router.patch("/appointments/{id}/status", tags=["appointments"])
async def update_appointment_status(
    id: str,
    req: StatusUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    PATCH /api/v1/appointments/{id}/status
    Updates an appointment's lifecycle status (arrived, in_progress, completed, no_show, cancelled).
    Cancels deferred Cloud Tasks if cancelled.
    """
    verify_clinic_access(req.clinic_id, current_user)
    
    appointment = await get_document("appointments", id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    if appointment.get("clinic_id") != req.clinic_id:
        raise HTTPException(status_code=403, detail="Access denied")

    update_payload: Dict[str, Any] = {
        "status": req.status,
        "updated_at": datetime.now(timezone.utc)
    }

    if req.status == "cancelled":
        update_payload["cancelled_at"] = datetime.now(timezone.utc)
        if req.cancel_reason:
            update_payload["cancel_reason"] = req.cancel_reason
            
        # Cancel Cloud Tasks if present
        if appointment.get("reminder_task_name"):
            await cancel_task(appointment["reminder_task_name"])
        if appointment.get("wellness_task_name"):
            await cancel_task(appointment["wellness_task_name"])

    await update_document("appointments", id, update_payload)
    logger.info(f"Updated appointment '{id}' status to '{req.status}'")

    # Emit QUEUE_UPDATED event AFTER database commit
    bus = get_event_bus()
    await bus.emit(create_event(
        ClinicalEvent.QUEUE_UPDATED,
        clinic_id=req.clinic_id,
        visit_id=id,
        patient_id=appointment.get("patient_id"),
        doctor_id=current_user.get("uid"),
        trigger="api:status_update",
        payload={"new_status": req.status, "previous_status": appointment.get("status")},
    ))

    return {
        "updated": True,
        "appointment_id": id,
        "status": req.status
    }
