import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from firebase_admin import auth as firebase_auth

from api.auth import get_current_user
from database.firestore import set_document, get_document
from database.postgres import AsyncSessionFactory
from models.clinic import Clinic, Subscription

logger = logging.getLogger("vaidyaai.api.clinics")
router = APIRouter()


class ClinicSetupRequest(BaseModel):
    clinic_name: str
    doctor_name: str
    phone: str
    location: Optional[str] = "Tirupati, AP"
    consultation_fees: Optional[Dict[str, int]] = None
    whatsapp_phone_id: Optional[str] = "default_phone_id"


@router.post("/clinics/setup", tags=["clinics"])
async def setup_new_clinic(
    req: ClinicSetupRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    POST /api/v1/clinics/setup
    Creates new clinic profile in Firestore and PostgreSQL, sets Firebase custom claim,
    and returns generated clinic_id.
    """
    uid = current_user["uid"]
    now_utc = datetime.now(timezone.utc)
    clinic_id = f"cln_{int(now_utc.timestamp())}"

    fees = req.consultation_fees or {
        "new_patient_paise": 30000,
        "followup_paise": 15000,
        "procedure_paise": 50000
    }

    # 1. Create Firestore clinics/{id} document
    clinic_firestore = {
        "clinic_id": clinic_id,
        "name": req.clinic_name,
        "doctor_name": req.doctor_name,
        "phone": req.phone,
        "location": req.location,
        "whatsapp_phone_id": req.whatsapp_phone_id,
        "consultation_fees": fees,
        "agents_enabled": {
            "appointment_flow": True,
            "clinical_scribe": True,
            "billing_pulse": True,
            "retention_radar": True,
            "prescription_safe": True,
            "insight_engine": True,
            "referral_coordinator": True
        },
        "is_active": True,
        "created_at": now_utc
    }
    await set_document("clinics", clinic_id, clinic_firestore)

    # 2. Create Firestore clinic_users/{uid} document
    user_mapping = {
        "clinic_id": clinic_id,
        "doctor_name": req.doctor_name,
        "doctor_phone": req.phone,
        "clinic_name": req.clinic_name,
        "role": "doctor",
        "created_at": now_utc
    }
    await set_document("clinic_users", uid, user_mapping)

    # 3. Create PostgreSQL clinic & subscription records
    async with AsyncSessionFactory() as db:
        clinic_pg = Clinic(
            firebase_clinic_id=clinic_id,
            name=req.clinic_name,
            doctor_name=req.doctor_name,
            phone=req.phone,
            whatsapp_phone_id=req.whatsapp_phone_id or "default_phone_id",
            location=req.location,
            subscription_plan="essential",
            is_active=True,
            onboarding_complete=True,
            created_at=now_utc
        )
        db.add(clinic_pg)
        await db.commit()
        await db.refresh(clinic_pg)

        sub = Subscription(
            clinic_id=clinic_pg.id,
            plan="essential",
            monthly_fee_paise=299900,
            status="trial",
            started_at=now_utc
        )
        db.add(sub)
        await db.commit()

    # 4. Set Firebase custom claims
    try:
        firebase_auth.set_custom_user_claims(uid, {
            "clinic_id": clinic_id,
            "role": "doctor"
        })
    except Exception as e:
        logger.warning(f"Could not set custom claim on user {uid}: {e}")

    logger.info(f"Onboarding setup complete for clinic '{clinic_id}' ({req.clinic_name})")
    return {
        "clinic_id": clinic_id,
        "clinic_name": req.clinic_name,
        "doctor_name": req.doctor_name,
        "status": "active"
    }
