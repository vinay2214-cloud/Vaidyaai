import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from firebase_admin import auth as firebase_auth
from sqlalchemy import delete as sa_delete

from api.auth import get_current_user
from database.firestore import set_document, get_document, delete_document
from database.postgres import AsyncSessionFactory
from models.clinic import Clinic, Subscription

logger = logging.getLogger("vaidyaai.api.clinics")
router = APIRouter()


def _generate_clinic_id() -> str:
    """Generate a globally unique, immutable clinic_id server-side.
    Uses UUID4 hex for collision resistance; prefixed with 'cln_' for domain identity."""
    return f"cln_{uuid.uuid4().hex}"


class ClinicSetupRequest(BaseModel):
    clinic_name: str
    doctor_name: str
    phone: str
    location: Optional[str] = "Tirupati, AP"
    consultation_fees: Optional[Dict[str, int]] = None
    whatsapp_phone_id: Optional[str] = "default_phone_id"


async def _reconcile_failed_setup(
    clinic_id: str,
    uid: str,
    pg_clinic_pk: Optional[Any],
    created_firestore_clinic: bool,
    created_firestore_user: bool,
    claim_set: bool,
) -> None:
    """Best-effort rollback of a partially completed clinic onboarding.

    Undoes writes in reverse order so a failed setup never leaves a clinic in a
    half-provisioned state (orphaned Firestore docs, PG rows, or a stale claim).
    Each step is defensive: reconciliation must not raise.
    """
    if claim_set:
        try:
            firebase_auth.set_custom_user_claims(uid, None)
        except Exception as e:
            logger.error(f"Reconciliation: failed to clear custom claim for {uid}: {e}")
    if created_firestore_user:
        try:
            await delete_document("clinic_users", uid)
        except Exception as e:
            logger.error(f"Reconciliation: failed to delete clinic_users/{uid}: {e}")
    if created_firestore_clinic:
        try:
            await delete_document("clinics", clinic_id)
        except Exception as e:
            logger.error(f"Reconciliation: failed to delete clinics/{clinic_id}: {e}")
    if pg_clinic_pk is not None:
        try:
            async with AsyncSessionFactory() as db:
                # Subscription rows cascade-delete via the clinic FK (ondelete=CASCADE).
                await db.execute(sa_delete(Clinic).where(Clinic.id == pg_clinic_pk))
                await db.commit()
        except Exception as e:
            logger.error(f"Reconciliation: failed to delete PG clinic {pg_clinic_pk}: {e}")


@router.post("/clinics/setup", tags=["clinics"])
async def setup_new_clinic(
    req: ClinicSetupRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    POST /api/v1/clinics/setup
    Creates new clinic profile in Firestore and PostgreSQL, sets Firebase custom claim,
    and returns generated clinic_id.

    All four writes (PostgreSQL clinic+subscription, Firestore clinic doc, Firestore
    user mapping, Firebase custom claim) must succeed. Any failure triggers a
    best-effort rollback so onboarding is all-or-nothing and the tenant is never
    left half-provisioned.
    """
    uid = current_user["uid"]
    now_utc = datetime.now(timezone.utc)

    # Prevent duplicate clinic creation: if user already has a clinic mapping, return it
    try:
        existing_mapping = await get_document("clinic_users", uid)
        if existing_mapping and existing_mapping.get("clinic_id"):
            existing_clinic_id = existing_mapping["clinic_id"]
            existing_clinic_doc = await get_document("clinics", existing_clinic_id)
            if existing_clinic_doc:
                logger.info(f"User {uid} already has clinic '{existing_clinic_id}'. Returning existing clinic.")
                return {
                    "clinic_id": existing_clinic_id,
                    "clinic_name": existing_clinic_doc.get("name", req.clinic_name),
                    "doctor_name": existing_clinic_doc.get("doctor_name", req.doctor_name),
                    "status": "existing"
                }
    except Exception as e:
        logger.debug(f"Duplicate clinic check lookup warning for uid {uid}: {e}")

    clinic_id = _generate_clinic_id()

    fees = req.consultation_fees or {
        "new_patient_paise": 30000,
        "followup_paise": 15000,
        "procedure_paise": 50000
    }

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

    user_mapping = {
        "clinic_id": clinic_id,
        "doctor_name": req.doctor_name,
        "doctor_phone": req.phone,
        "clinic_name": req.clinic_name,
        "role": "doctor",
        "created_at": now_utc
    }

    pg_clinic_pk: Optional[Any] = None
    created_firestore_clinic = False
    created_firestore_user = False
    claim_set = False

    try:
        # 1. Create PostgreSQL clinic & subscription atomically (single transaction).
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
            await db.flush()

            sub = Subscription(
                clinic_id=clinic_pg.id,
                plan="essential",
                monthly_fee_paise=299900,
                status="trial",
                started_at=now_utc
            )
            db.add(sub)
            await db.commit()
            pg_clinic_pk = clinic_pg.id

        # 2. Create Firestore clinics/{id} document.
        await set_document("clinics", clinic_id, clinic_firestore)
        created_firestore_clinic = True

        # 3. Create Firestore clinic_users/{uid} document.
        await set_document("clinic_users", uid, user_mapping)
        created_firestore_user = True

        # 4. Set Firebase custom claims (fatal: without this the doctor cannot
        #    access their own tenant, so a failure must abort onboarding).
        firebase_auth.set_custom_user_claims(uid, {
            "clinic_id": clinic_id,
            "role": "doctor"
        })
        claim_set = True

    except Exception as e:
        logger.error(f"Clinic onboarding failed for uid {uid} (clinic {clinic_id}): {e}. Rolling back.")
        await _reconcile_failed_setup(
            clinic_id=clinic_id,
            uid=uid,
            pg_clinic_pk=pg_clinic_pk,
            created_firestore_clinic=created_firestore_clinic,
            created_firestore_user=created_firestore_user,
            claim_set=claim_set,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Clinic onboarding failed and was rolled back. Please retry."
        )

    logger.info(f"Onboarding setup complete for clinic '{clinic_id}' ({req.clinic_name})")
    return {
        "clinic_id": clinic_id,
        "clinic_name": req.clinic_name,
        "doctor_name": req.doctor_name,
        "status": "active"
    }


@router.get("/clinics/settings", tags=["clinics"])
async def get_clinic_settings(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    GET /api/v1/clinics/settings
    Returns the authenticated doctor's clinic configuration (fees, identity, agents)
    so the frontend can render truthful, configured values instead of hardcoded ones.
    """
    clinic_id = current_user.get("clinic_id")
    if not clinic_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No clinic associated with this user account."
        )

    clinic_doc = await get_document("clinics", clinic_id) or {}
    fees = clinic_doc.get("consultation_fees", {}) or {}

    # Normalize fee keys to paise with sensible defaults consistent with BillingPulse.
    DEFAULT_FEES = {
        "new_patient_paise": 30000,
        "followup_paise": 15000,
        "procedure_paise": 50000,
    }
    normalized_fees = {k: int(fees.get(k, default)) for k, default in DEFAULT_FEES.items()}

    return {
        "clinic_id": clinic_id,
        "name": clinic_doc.get("name", ""),
        "doctor_name": clinic_doc.get("doctor_name", ""),
        "phone": clinic_doc.get("phone", ""),
        "location": clinic_doc.get("location", ""),
        "consultation_fees": normalized_fees,
        "agents_enabled": clinic_doc.get("agents_enabled", {}),
        "is_active": clinic_doc.get("is_active", False),
    }


class DevProvisionRequest(BaseModel):
    uid: str
    clinic_id: Optional[str] = "cln_e2e_test_clinic"
    doctor_name: Optional[str] = "Dr. Ramesh"
    clinic_name: Optional[str] = "Tirupati General Clinic"
    role: Optional[str] = "doctor"


@router.post("/clinics/dev-provision", tags=["clinics"])
async def dev_provision_clinic_user(req: DevProvisionRequest):
    """
    POST /api/v1/clinics/dev-provision
    Development-only endpoint for tenant auto-provisioning.
    Provisions clinic_users/{uid} document and sets Firebase Custom Claims.
    Strictly forbidden in production environments (returns HTTP 403).
    """
    from config import settings
    if settings.is_production:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Development tenant provisioning is strictly disabled in production environments."
        )

    # Idempotency check: return existing mapping if user is already provisioned
    try:
        existing = await get_document("clinic_users", req.uid)
        if existing and existing.get("clinic_id"):
            logger.info(f"Dev Provisioning: Mapping for {req.uid} already exists ({existing.get('clinic_id')}). Returning existing mapping.")
            return {
                "clinic_id": existing.get("clinic_id"),
                "doctor_name": existing.get("doctor_name", req.doctor_name),
                "clinic_name": existing.get("clinic_name", req.clinic_name),
                "role": existing.get("role", req.role),
                "status": "existing"
            }
    except Exception as e:
        logger.debug(f"Dev Provisioning: Could not check existing clinic_users/{req.uid}: {e}")

    now_utc = datetime.now(timezone.utc)
    user_mapping = {
        "clinic_id": req.clinic_id,
        "doctor_name": req.doctor_name,
        "doctor_phone": "+919876543210",
        "clinic_name": req.clinic_name,
        "role": req.role,
        "created_at": now_utc,
        "is_dev_provisioned": True
    }

    try:
        await set_document("clinic_users", req.uid, user_mapping)
        logger.info(f"Dev Provisioning: Written clinic_users/{req.uid} for clinic '{req.clinic_id}'")
    except Exception as e:
        logger.warning(f"Dev Provisioning: Could not write Firestore document clinic_users/{req.uid}: {e}")

    try:
        firebase_auth.set_custom_user_claims(req.uid, {
            "clinic_id": req.clinic_id,
            "role": req.role
        })
        logger.info(f"Dev Provisioning: Set custom user claims for {req.uid}")
    except Exception as e:
        logger.debug(f"Dev Provisioning: Could not set custom claims for {req.uid}: {e}")

    return {
        "clinic_id": req.clinic_id,
        "doctor_name": req.doctor_name,
        "clinic_name": req.clinic_name,
        "role": req.role,
        "status": "provisioned"
    }

