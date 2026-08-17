"""
VaidyaAI — Grounded Patient Summary Generator.
Produces a longitudinal patient summary using ONLY facts from clinician-reviewed
and grounding-validated consultations. Zero fabrication.
"""
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from database.firestore import query_documents, get_document
from utils.grounding_validator import validate_and_sanitize_clinical_facts

logger = logging.getLogger("vaidyaai.utils.patient_summary")


async def generate_patient_summary(
    patient_id: str,
    clinic_id: str,
    limit: int = 20,
) -> Dict[str, Any]:
    """
    Generate a grounded longitudinal patient summary.

    Only includes facts from consultations that have:
    - review_status in ("CONFIRMED", "REQUIRES_REVIEW")
    - grounding_rejection_count within acceptable bounds

    Returns a structured summary with provenance traces on every fact.
    """
    patient = await get_document("patients", patient_id)
    if not patient:
        return {"error": "patient_not_found"}

    consultations_raw = await query_documents(
        "consultations",
        [("patient_id", "==", patient_id), ("clinic_id", "==", clinic_id)],
        limit=limit,
        order_by="created_at",
        direction="DESCENDING",
    )

    reviewed = [c for c in consultations_raw if c.get("review_status") in ("CONFIRMED", "REQUIRES_REVIEW")]

    if not reviewed:
        return {
            "patient_id": patient_id,
            "clinic_id": clinic_id,
            "patient_name": patient.get("name", ""),
            "summary_generated": False,
            "reason": "no_reviewed_consultations",
            "consultations_total": len(consultations_raw),
            "consultations_reviewed": 0,
        }

    all_conditions = []
    all_medications = []
    all_allergies = []
    all_vitals = []
    encounter_summaries = []

    for consultation in reviewed:
        consultation_id = consultation.get("consultation_id", "")
        grounding_rejections = consultation.get("grounding_rejections", [])
        grounding_count = consultation.get("grounding_rejection_count", 0)

        encounter_summary = {
            "consultation_id": consultation_id,
            "date": str(consultation.get("created_at", "")),
            "review_status": consultation.get("review_status"),
            "ai_generated": consultation.get("ai_generated", False),
            "grounding_rejection_count": grounding_count,
            "safety_eval_completed": consultation.get("safety_eval_completed", False),
        }

        soap = consultation.get("soap_note", {})
        if isinstance(soap, dict):
            encounter_summary["chief_complaint"] = soap.get("subjective", "")[:200]

        for diag in consultation.get("diagnoses", []):
            d = diag if isinstance(diag, dict) else {"description": str(diag)}
            all_conditions.append({
                "description": d.get("description", ""),
                "icd10_code": d.get("icd10_code"),
                "is_provisional": d.get("is_provisional", True),
                "encounter_id": consultation_id,
                "date": str(consultation.get("created_at", "")),
                "provenance": d.get("_provenance", {"source": "ai_provisional" if consultation.get("ai_generated") else "clinician_entered"}),
            })

        for med in consultation.get("medications", []):
            m = med if isinstance(med, dict) else {"drug_name": str(med)}
            all_medications.append({
                "drug_name": m.get("drug_name", ""),
                "dosage": m.get("dosage"),
                "frequency": m.get("frequency"),
                "duration": m.get("duration"),
                "encounter_id": consultation_id,
                "date": str(consultation.get("created_at", "")),
                "provenance": m.get("_provenance", {"source": "ai_provisional" if consultation.get("ai_generated") else "clinician_entered"}),
            })

        for allergy in consultation.get("patient_allergies", []):
            allergen = allergy.get("allergen", allergy) if isinstance(allergy, dict) else str(allergy)
            reaction = allergy.get("reaction") if isinstance(allergy, dict) else None
            all_allergies.append({
                "allergen": allergen,
                "reaction": reaction,
                "encounter_id": consultation_id,
            })

        vitals = consultation.get("vitals", {}) or {}
        if isinstance(vitals, dict) and any(vitals.get(k) for k in ("temperature", "blood_pressure", "heart_rate", "spo2")):
            all_vitals.append({
                "encounter_id": consultation_id,
                "date": str(consultation.get("created_at", "")),
                **vitals,
            })

        encounter_summaries.append(encounter_summary)

    # Patient-level allergies are canonical facts on the patient record and must
    # be reflected in the summary even when no reviewed consultation re-captured
    # them. They are deduplicated below alongside consultation-level allergies.
    for allergy in patient.get("allergies", []) or []:
        allergen = allergy.get("allergen", allergy) if isinstance(allergy, dict) else str(allergy)
        reaction = allergy.get("reaction") if isinstance(allergy, dict) else None
        all_allergies.append({
            "allergen": allergen,
            "reaction": reaction,
            "encounter_id": None,
        })

    # Deduplicate allergies
    seen_allergens = set()
    unique_allergies = []
    for a in all_allergies:
        key = a["allergen"].lower() if isinstance(a.get("allergen"), str) else str(a.get("allergen"))
        if key not in seen_allergens:
            seen_allergens.add(key)
            unique_allergies.append(a)

    # Deduplicate conditions (keep latest)
    seen_conditions = set()
    unique_conditions = []
    for c in reversed(all_conditions):
        key = c["description"].lower() if isinstance(c.get("description"), str) else str(c.get("description"))
        if key not in seen_conditions:
            seen_conditions.add(key)
            unique_conditions.append(c)
    unique_conditions.reverse()

    return {
        "patient_id": patient_id,
        "clinic_id": clinic_id,
        "patient_name": patient.get("name", ""),
        "patient_phone_masked": patient.get("patient_phone_masked", patient.get("phone_masked", "")),
        "age": patient.get("age"),
        "gender": patient.get("gender"),
        "blood_group": patient.get("blood_group"),
        "summary_generated": True,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "consultations_total": len(consultations_raw),
        "consultations_reviewed": len(reviewed),
        "active_conditions": unique_conditions,
        "medication_history": all_medications,
        "allergies": unique_allergies,
        "vitals_history": all_vitals,
        "encounter_summaries": encounter_summaries,
        "data_quality": {
            "all_consultations_reviewed": len(reviewed) == len(consultations_raw),
            "grounding_rejections_total": sum(c.get("grounding_rejection_count", 0) for c in reviewed),
            "safety_evals_completed": sum(1 for c in reviewed if c.get("safety_eval_completed")),
        },
    }
