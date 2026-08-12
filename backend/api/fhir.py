"""
VaidyaAI — FHIR R4 API Router.
Exposes FHIR-compliant endpoints as an integration layer.
Does NOT replace internal Firestore/PostgreSQL — FHIR is derived from the canonical record.
"""
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from api.auth import get_current_user, verify_clinic_access
from database.firestore import get_document, query_documents
from integrations.fhir_r4 import (
    export_consultation_to_fhir,
    export_patient_summary_to_fhir,
    build_fhir_bundle,
    fhir_patient as _fhir_patient,
    fhir_organization as _fhir_organization,
)

logger = logging.getLogger("vaidyaai.api.fhir")
router = APIRouter()


@router.get("/fhir/metadata", tags=["fhir"])
async def fhir_metadata():
    """FHIR R4 Capability Statement."""
    return {
        "resourceType": "CapabilityStatement",
        "status": "active",
        "date": "2026-08-12",
        "kind": "instance",
        "fhirVersion": "4.0.1",
        "format": ["json"],
        "rest": [{
            "mode": "server",
            "resource": [
                {"type": "Patient", "interaction": [{"code": "read"}, {"code": "search-type"}]},
                {"type": "Encounter", "interaction": [{"code": "read"}, {"code": "search-type"}]},
                {"type": "Condition", "interaction": [{"code": "read"}]},
                {"type": "Observation", "interaction": [{"code": "read"}]},
                {"type": "AllergyIntolerance", "interaction": [{"code": "read"}]},
                {"type": "MedicationRequest", "interaction": [{"code": "read"}]},
                {"type": "Composition", "interaction": [{"code": "read"}]},
                {"type": "Provenance", "interaction": [{"code": "read"}]},
                {"type": "Organization", "interaction": [{"code": "read"}]},
                {"type": "Practitioner", "interaction": [{"code": "read"}]},
            ],
        }],
        "implementation": {
            "description": "VaidyaAI FHIR R4 Integration Layer",
            "url": "https://vaidya.ai/api/v1/fhir",
        },
    }


@router.get("/fhir/Patient/{patient_id}", tags=["fhir"])
async def fhir_read_patient(
    patient_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Read a Patient resource by ID."""
    patient = await get_document("patients", patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    verify_clinic_access(patient.get("clinic_id", ""), current_user)
    return _fhir_patient(
        patient_id=patient_id, name=patient.get("name", ""),
        phone=patient.get("phone"), gender=patient.get("gender"), age=patient.get("age"))


@router.get("/fhir/Encounter/{consultation_id}", tags=["fhir"])
async def fhir_read_encounter(
    consultation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Read an Encounter (consultation) as a FHIR Bundle."""
    consultation = await get_document("consultations", consultation_id)
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    verify_clinic_access(consultation.get("clinic_id", ""), current_user)

    patient = await get_document("patients", consultation.get("patient_id", ""))
    clinic = await get_document("clinics", consultation.get("clinic_id", ""))

    return await export_consultation_to_fhir(
        consultation=consultation,
        patient=patient or {},
        clinic=clinic or {},
    )


@router.get("/fhir/Patient/{patient_id}/summary", tags=["fhir"])
async def fhir_patient_summary(
    patient_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    limit: int = Query(default=20, le=100),
):
    """Export a patient's longitudinal summary as a FHIR IPS Bundle."""
    patient = await get_document("patients", patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    verify_clinic_access(patient.get("clinic_id", ""), current_user)

    clinic = await get_document("clinics", patient.get("clinic_id", ""))

    consultations_raw = await query_documents(
        "consultations",
        [("patient_id", "==", patient_id), ("clinic_id", "==", patient.get("clinic_id", ""))],
        order_by="created_at", direction="DESCENDING", limit=limit,
    )

    reviewed = [c for c in consultations_raw if c.get("review_status") in ("CONFIRMED", "REQUIRES_REVIEW")]

    return await export_patient_summary_to_fhir(
        patient=patient, consultations=reviewed, clinic=clinic or {},
    )


@router.get("/fhir/Organization/{clinic_id}", tags=["fhir"])
async def fhir_read_organization(
    clinic_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Read an Organization (clinic) resource."""
    verify_clinic_access(clinic_id, current_user)
    clinic = await get_document("clinics", clinic_id)
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return _fhir_organization(
        clinic_id=clinic_id, name=clinic.get("name", clinic.get("doctor_name", "")),
        phone=clinic.get("phone"), location=clinic.get("location"))
