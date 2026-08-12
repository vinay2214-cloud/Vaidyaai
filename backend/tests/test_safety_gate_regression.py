"""Regression tests for prescription safety gates.

Covers two safety-critical guarantees:
  1. Deterministic allergen-conflict guard — a documented allergy to a drug
     class MUST block that drug, deterministically, regardless of LLM output.
     NKDA markers must NOT trigger a block.
  2. Approval safety gate — approve_consultation must refuse to approve a
     consultation that has medications but no safety_evaluation, or an unsafe
     evaluation that was not explicitly overridden.
"""
import asyncio
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from main import app
from database import firestore as fs
from agents.prescription_safe import _detect_allergen_conflicts


# ─── Unit tests for the deterministic allergen detector ────────────────────────

def test_allergen_conflict_penicillin_blocks_amoxicillin():
    meds = [{"drug_name": "Amoxicillin 500mg", "dosage": "500mg"}]
    allergies = ["Penicillin"]
    conflicts = _detect_allergen_conflicts(meds, allergies)
    assert len(conflicts) == 1
    assert conflicts[0]["drug_name"] == "Amoxicillin 500mg"
    assert conflicts[0]["allergen"] == "Penicillin"


def test_allergen_conflict_sulfa_blocks_trimethoprim():
    meds = [{"drug_name": "Co-trimoxazole", "dosage": "DS"}]
    allergies = ["Sulfa Drugs"]
    conflicts = _detect_allergen_conflicts(meds, allergies)
    assert len(conflicts) == 1


def test_allergen_conflict_nsaid_blocks_diclofenac():
    meds = [{"drug_name": "Diclofenac", "dosage": "50mg"}]
    allergies = ["NSAIDs / Aspirin"]
    conflicts = _detect_allergen_conflicts(meds, allergies)
    assert len(conflicts) == 1


def test_allergen_conflict_nkda_does_not_block():
    """NKDA means NO allergies — must never trigger a conflict."""
    meds = [{"drug_name": "Amoxicillin", "dosage": "500mg"}]
    allergies = ["No Known Drug Allergies (NKDA)"]
    conflicts = _detect_allergen_conflicts(meds, allergies)
    assert conflicts == []


def test_allergen_conflict_no_overlap_no_block():
    meds = [{"drug_name": "Metformin", "dosage": "500mg"}]
    allergies = ["Penicillin"]
    conflicts = _detect_allergen_conflicts(meds, allergies)
    assert conflicts == []


def test_allergen_conflict_empty_inputs():
    assert _detect_allergen_conflicts([], ["Penicillin"]) == []
    assert _detect_allergen_conflicts([{"drug_name": "Amoxicillin"}], []) == []


# ─── Integration tests for the approval safety gate ────────────────────────────

@pytest.fixture
def client():
    fs._in_memory_store.clear()
    return TestClient(app)


def _seed_consultation_with_meds(cons_id, meds, safety_eval=None, clinic_id="cln_e2e_test_clinic"):
    doc = {
        "consultation_id": cons_id,
        "clinic_id": clinic_id,
        "appointment_id": f"app_{cons_id}",
        "status": "draft",
        "vitals": {},
        "medications": meds,
    }
    if safety_eval is not None:
        doc["safety_evaluation"] = safety_eval
    asyncio.run(fs.set_document("consultations", cons_id, doc))
    # Seed the appointment + patient so approve doesn't blow up downstream
    asyncio.run(fs.set_document("appointments", f"app_{cons_id}", {
        "appointment_id": f"app_{cons_id}",
        "clinic_id": clinic_id,
        "patient_id": f"pat_{cons_id}",
        "patient_name": "Test Patient",
        "status": "in_progress",
    }))
    asyncio.run(fs.set_document("patients", f"pat_{cons_id}", {
        "patient_id": f"pat_{cons_id}",
        "clinic_id": clinic_id,
        "phone": "9XXXXXXXXX",
    }))


def test_approve_blocked_when_no_safety_eval(client):
    """Medications present but no safety check run → must block."""
    _seed_consultation_with_meds("cons_gate_1", [{"drug_name": "Metformin", "dosage": "500mg"}])
    response = client.post(
        "/api/v1/consultations/cons_gate_1/approve",
        json={"clinic_id": "cln_e2e_test_clinic"},
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 400
    body = response.json()
    err_data = body.get("detail", body) if isinstance(body, dict) else {}
    assert err_data.get("error") == "safety_check_required"
    # Consultation must remain in draft
    cons = asyncio.run(fs.get_document("consultations", "cons_gate_1"))
    assert cons["status"] == "draft"


def test_approve_blocked_when_unsafe_and_not_overridden(client):
    """Safety eval says unsafe with no override → must block."""
    _seed_consultation_with_meds(
        "cons_gate_2",
        [{"drug_name": "Amoxicillin", "dosage": "500mg"}],
        safety_eval={
            "is_safe": False,
            "overridden": False,
            "warnings": [{"severity": "CRITICAL", "type": "ALLERGY_CONFLICT", "message": "Penicillin conflict"}],
        },
    )
    response = client.post(
        "/api/v1/consultations/cons_gate_2/approve",
        json={"clinic_id": "cln_e2e_test_clinic"},
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 400
    body = response.json()
    err_data = body.get("detail", body) if isinstance(body, dict) else {}
    assert err_data.get("error") == "safety_check_failed"
    cons = asyncio.run(fs.get_document("consultations", "cons_gate_2"))
    assert cons["status"] == "draft"


def test_approve_allowed_when_safe(client):
    """Safety eval says safe → approval proceeds (Medications present)."""
    _seed_consultation_with_meds(
        "cons_gate_3",
        [{"drug_name": "Metformin", "dosage": "500mg"}],
        safety_eval={"is_safe": True, "overridden": False, "warnings": []},
    )
    response = client.post(
        "/api/v1/consultations/cons_gate_3/approve",
        json={"clinic_id": "cln_e2e_test_clinic"},
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 200, response.text
    cons = asyncio.run(fs.get_document("consultations", "cons_gate_3"))
    assert cons["status"] == "approved"


def test_approve_allowed_when_overridden(client):
    """Safety eval says unsafe but doctor overrode with reason → allowed."""
    _seed_consultation_with_meds(
        "cons_gate_4",
        [{"drug_name": "Amoxicillin", "dosage": "500mg"}],
        safety_eval={
            "is_safe": False,
            "overridden": True,
            "override_reason": "Patient previously tolerated amoxicillin under supervision.",
            "warnings": [{"severity": "HIGH", "type": "ALLERGY_CONFLICT", "message": "Penicillin conflict"}],
        },
    )
    response = client.post(
        "/api/v1/consultations/cons_gate_4/approve",
        json={"clinic_id": "cln_e2e_test_clinic"},
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 200, response.text
    cons = asyncio.run(fs.get_document("consultations", "cons_gate_4"))
    assert cons["status"] == "approved"


def test_approve_allowed_when_no_medications(client):
    """No medications → safety gate not required, approval proceeds."""
    _seed_consultation_with_meds("cons_gate_5", [])
    response = client.post(
        "/api/v1/consultations/cons_gate_5/approve",
        json={"clinic_id": "cln_e2e_test_clinic"},
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 200, response.text


def test_allergen_guard_blocks_prescription_endpoint(client):
    """POST /check-safety with a known allergen conflict must return is_safe=False
    deterministically (provider=deterministic_allergen_guard), without calling the LLM."""
    # Seed patient with a Penicillin allergy
    asyncio.run(fs.set_document("patients", "pat_allerg_1", {
        "clinic_id": "cln_e2e_test_clinic",
        "allergies": ["Penicillin"],
    }))
    asyncio.run(fs.set_document("consultations", "cons_allerg_1", {
        "clinic_id": "cln_e2e_test_clinic",
        "status": "draft",
        "vitals": {},
    }))
    response = client.post(
        "/api/v1/consultations/cons_allerg_1/check-safety",
        json={
            "clinic_id": "cln_e2e_test_clinic",
            "medications": [{"drug_name": "Amoxicillin 500mg", "dosage": "500mg", "frequency": "1-0-1"}],
            "patient_id": "pat_allerg_1",
        },
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["is_safe"] is False
    assert body["provider"] == "deterministic_allergen_guard"
    assert body["execution_status"] == "allergen_blocked"
    assert body["requires_manual_review"] is True
    assert any(w["type"] == "ALLERGY_CONFLICT" for w in body["warnings"])


# ─── Low-confidence transcript review gate (Rule 11) ───────────────────────────

def _seed_consultation_low_conf(cons_id, meds=None, safety_eval=None, clinic_id="cln_e2e_test_clinic"):
    doc = {
        "consultation_id": cons_id,
        "clinic_id": clinic_id,
        "appointment_id": f"app_{cons_id}",
        "status": "draft",
        "vitals": {},
        "medications": meds or [],
        "scribe_metadata": {
            "confidence_tier": "LOW",
            "speech_recognition_confidence": 0.41,
            "requires_transcript_review": True,
            "transcript_reviewed": False,
            "confidence_warning": "Low Speech Recognition Confidence (41%) — Clinician transcript review mandatory before approval.",
        },
    }
    if safety_eval is not None:
        doc["safety_evaluation"] = safety_eval
    asyncio.run(fs.set_document("consultations", cons_id, doc))
    asyncio.run(fs.set_document("appointments", f"app_{cons_id}", {
        "appointment_id": f"app_{cons_id}",
        "clinic_id": clinic_id,
        "patient_id": f"pat_{cons_id}",
        "patient_name": "Test Patient",
        "status": "in_progress",
    }))
    asyncio.run(fs.set_document("patients", f"pat_{cons_id}", {
        "patient_id": f"pat_{cons_id}",
        "clinic_id": clinic_id,
        "phone": "9XXXXXXXXX",
    }))


def test_approve_blocked_when_low_confidence_and_not_reviewed(client):
    """Low STT confidence + no transcript review confirmation → must block."""
    _seed_consultation_low_conf(
        "cons_low_1",
        meds=[{"drug_name": "Metformin", "dosage": "500mg"}],
        safety_eval={"is_safe": True, "overridden": False, "warnings": []},
    )
    response = client.post(
        "/api/v1/consultations/cons_low_1/approve",
        json={"clinic_id": "cln_e2e_test_clinic"},
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 400
    body = response.json()
    err_data = body.get("detail", body) if isinstance(body, dict) else {}
    assert err_data.get("error") == "transcript_review_required"
    assert err_data.get("confidence_tier") == "LOW"
    cons = asyncio.run(fs.get_document("consultations", "cons_low_1"))
    assert cons["status"] == "draft"


def test_approve_allowed_when_low_confidence_but_reviewed(client):
    """Low STT confidence + clinician confirmed transcript review → allowed."""
    _seed_consultation_low_conf(
        "cons_low_2",
        meds=[{"drug_name": "Metformin", "dosage": "500mg"}],
        safety_eval={"is_safe": True, "overridden": False, "warnings": []},
    )
    response = client.post(
        "/api/v1/consultations/cons_low_2/approve",
        json={"clinic_id": "cln_e2e_test_clinic", "transcript_reviewed": True},
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 200, response.text
    cons = asyncio.run(fs.get_document("consultations", "cons_low_2"))
    assert cons["status"] == "approved"
    assert cons["scribe_metadata"]["transcript_reviewed"] is True


def test_approve_not_blocked_when_high_confidence(client):
    """High STT confidence (no requires_transcript_review) → no review gate."""
    doc = {
        "consultation_id": "cons_high_1",
        "clinic_id": "cln_e2e_test_clinic",
        "appointment_id": "app_cons_high_1",
        "status": "draft",
        "vitals": {},
        "medications": [{"drug_name": "Metformin", "dosage": "500mg"}],
        "safety_evaluation": {"is_safe": True, "overridden": False, "warnings": []},
        "scribe_metadata": {
            "confidence_tier": "HIGH",
            "speech_recognition_confidence": 0.94,
            "requires_transcript_review": False,
            "transcript_reviewed": False,
        },
    }
    asyncio.run(fs.set_document("consultations", "cons_high_1", doc))
    asyncio.run(fs.set_document("appointments", "app_cons_high_1", {
        "appointment_id": "app_cons_high_1",
        "clinic_id": "cln_e2e_test_clinic",
        "patient_id": "pat_cons_high_1",
        "status": "in_progress",
    }))
    asyncio.run(fs.set_document("patients", "pat_cons_high_1", {
        "patient_id": "pat_cons_high_1",
        "clinic_id": "cln_e2e_test_clinic",
        "phone": "9XXXXXXXXX",
    }))
    response = client.post(
        "/api/v1/consultations/cons_high_1/approve",
        json={"clinic_id": "cln_e2e_test_clinic"},
        headers={"Authorization": "Bearer dev_mock_token"},
    )
    assert response.status_code == 200, response.text
