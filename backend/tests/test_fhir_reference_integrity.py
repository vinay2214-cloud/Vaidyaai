"""FHIR R4 Bundle reference integrity.

Every internal `ResourceType/{id}` reference emitted by an export must resolve
to a resource that is actually present in the same Bundle. Regression guard for
the Encounter -> Appointment/{id} reference which previously dangled because the
Appointment resource was never added to the bundle.
"""
import re
import pytest

from integrations.fhir_r4 import (
    export_consultation_to_fhir,
    export_patient_summary_to_fhir,
)

REFERENCE_RE = re.compile(r"^[A-Z][A-Za-z]+/.+$")


def _collect_references(node, found):
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "reference" and isinstance(value, str):
                found.append(value)
            else:
                _collect_references(value, found)
    elif isinstance(node, list):
        for item in node:
            _collect_references(item, found)
    return found


def assert_bundle_references_resolve(bundle):
    entries = bundle.get("entry", [])
    present = {
        f"{e['resource']['resourceType']}/{e['resource']['id']}"
        for e in entries
        if e.get("resource", {}).get("id")
    }
    references = _collect_references(bundle, [])
    assert references, "bundle contains no references — export is not linked"
    dangling = [
        r for r in references
        if REFERENCE_RE.match(r) and not r.startswith(("http://", "https://", "urn:"))
        and r not in present
    ]
    assert not dangling, f"dangling FHIR references: {sorted(set(dangling))}"


CLINIC = {
    "clinic_id": "cln_demo",
    "name": "VaidyaAI Demo Clinic",
    "phone": "+911234567890",
    "location": "Tirupati",
    "doctor_name": "Dr Demo Clinician",
}

PATIENT = {
    "patient_id": "pat_demo_001",
    "name": "DEMO Patient A",
    "phone": "+919876543210",
    "gender": "female",
    "age": 34,
}


def _consultation(**overrides):
    consultation = {
        "consultation_id": "cons_demo_001",
        "patient_id": PATIENT["patient_id"],
        "clinic_id": CLINIC["clinic_id"],
        "appointment_id": "appt_demo_001",
        "status": "approved",
        "created_at": "2026-08-01T09:00:00+00:00",
        "approved_at": "2026-08-01T09:30:00+00:00",
        "chief_complaint": "Fever and dry cough",
        "diagnoses": [{"description": "Acute upper respiratory infection", "icd10_code": "J06.9"}],
        "medications": [{"drug_name": "Paracetamol", "dosage": "500mg", "frequency": "TDS"}],
        "vitals": {"temperature": 38.4, "heart_rate": 92, "spo2": 97, "blood_pressure": "120/80"},
    }
    consultation.update(overrides)
    return consultation


@pytest.mark.asyncio
async def test_consultation_bundle_references_resolve():
    bundle = await export_consultation_to_fhir(_consultation(), PATIENT, CLINIC)
    assert_bundle_references_resolve(bundle)


@pytest.mark.asyncio
async def test_consultation_bundle_includes_referenced_appointment():
    bundle = await export_consultation_to_fhir(_consultation(), PATIENT, CLINIC)
    types = [e["resource"]["resourceType"] for e in bundle["entry"]]
    assert "Appointment" in types
    appointment_ids = [
        e["resource"]["id"] for e in bundle["entry"]
        if e["resource"]["resourceType"] == "Appointment"
    ]
    assert "appt_demo_001" in appointment_ids


@pytest.mark.asyncio
async def test_consultation_bundle_without_appointment_has_no_dangling_reference():
    bundle = await export_consultation_to_fhir(
        _consultation(appointment_id=None), PATIENT, CLINIC)
    assert_bundle_references_resolve(bundle)
    types = [e["resource"]["resourceType"] for e in bundle["entry"]]
    assert "Appointment" not in types


@pytest.mark.asyncio
async def test_patient_summary_bundle_references_resolve():
    consultations = [
        _consultation(),
        _consultation(
            consultation_id="cons_demo_002",
            appointment_id="appt_demo_002",
            status="pending",
            created_at="2026-08-08T09:00:00+00:00",
        ),
    ]
    bundle = await export_patient_summary_to_fhir(PATIENT, consultations, CLINIC)
    assert_bundle_references_resolve(bundle)
