"""
VaidyaAI — Canonical Patient Identity Resolver.

Ensures a single deterministic patient_id per (clinic_id, phone) pair.
All patient creation paths must route through this module so that:
  - A returning patient always receives the SAME patient_id
  - No timestamp-based or random IDs fragment patient identity
  - Phone is the canonical identity key within a tenant (Indian clinical practice)
"""
import logging
from typing import Optional, Dict, Any

from database.firestore import get_document, query_documents
from utils.phone_utils import normalize_phone

logger = logging.getLogger("vaidyaai.utils.patient_identity")


async def resolve_patient_id(
    clinic_id: str,
    phone: str,
) -> Dict[str, Any]:
    """
    Resolve the canonical patient_id for a given clinic and phone number.

    Strategy:
    1. Normalize the phone number.
    2. Search for existing patient by phone within this clinic.
    3. If found, return existing patient_id and the patient document.
    4. If not found, generate a new deterministic patient_id from phone.

    Returns:
        {
            "patient_id": str,
            "is_new": bool,
            "existing_patient": Optional[Dict]  # None if is_new
        }
    """
    formatted_phone = normalize_phone(phone)
    patient_id = f"pat_{formatted_phone.replace('+', '')}"

    # Check if patient already exists with this phone in this clinic
    try:
        existing = await get_document("patients", patient_id)
        if existing and existing.get("clinic_id") == clinic_id:
            return {
                "patient_id": patient_id,
                "is_new": False,
                "existing_patient": existing
            }
    except Exception as e:
        logger.debug(f"Direct patient lookup failed for {patient_id}: {e}")

    # Fallback: search by phone within clinic (handles legacy UUID/timestamp-based IDs)
    try:
        candidates = await query_documents(
            "patients",
            [("clinic_id", "==", clinic_id), ("phone", "==", formatted_phone)],
            limit=5
        )
        if candidates:
            legacy_patient = candidates[0]
            legacy_id = legacy_patient.get("patient_id") or legacy_patient.get("id")
            logger.info(
                f"Found legacy patient '{legacy_id}' by phone for clinic '{clinic_id}'. "
                f"Returning existing ID over phone-based ID '{patient_id}'."
            )
            return {
                "patient_id": legacy_id,
                "is_new": False,
                "existing_patient": legacy_patient
            }
    except Exception as e:
        logger.debug(f"Phone-based patient search failed for clinic {clinic_id}: {e}")

    return {
        "patient_id": patient_id,
        "is_new": True,
        "existing_patient": None
    }
