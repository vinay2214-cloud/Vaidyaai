"""Regression: approval must be blocked when the prescription was modified
after the last safety evaluation (stale safety check), and invoices must
carry patient_id."""
import pytest
from unittest.mock import AsyncMock, patch
from agents.prescription_safe import _medication_signature


@pytest.mark.asyncio
async def test_approve_blocked_when_meds_modified_after_safety_eval():
    from agents.clinical_scribe import ClinicalScribeAgent
    agent = ClinicalScribeAgent()
    amox = [{"drug_name": "Amoxicillin", "dosage": "500mg", "frequency": "1-1-1"}]
    consultation = {
        "consultation_id": "cons_s", "clinic_id": "cln_x", "appointment_id": "app_x",
        "medications": [{"drug_name": "Paracetamol", "dosage": "500mg", "frequency": "1-0-1"}],
        "safety_evaluation": {"is_safe": True, "evaluated_at": "2026-08-12T00:00:00+00:00", "overridden": False},
        "safety_evaluated_medications": _medication_signature(amox),  # evaluated on Amox, current is Para
        "scribe_metadata": {},
    }
    async def fake_get(coll, doc_id): return dict(consultation)
    async def fake_update(*a, **k): raise AssertionError("approve must NOT persist when stale")
    with patch("agents.clinical_scribe.get_document", side_effect=fake_get), \
         patch("agents.clinical_scribe.update_document", side_effect=fake_update):
        res = await agent.approve_consultation("cons_s", "cln_x")
    assert res.get("error") == "safety_check_stale", res


@pytest.mark.asyncio
async def test_approve_allowed_when_meds_match_eval():
    from agents.clinical_scribe import ClinicalScribeAgent
    agent = ClinicalScribeAgent()
    meds = [{"drug_name": "Paracetamol", "dosage": "500mg", "frequency": "1-0-1"}]
    consultation = {
        "consultation_id": "cons_m", "clinic_id": "cln_x", "appointment_id": "app_x",
        "medications": meds,
        "safety_evaluation": {"is_safe": True, "evaluated_at": "2026-08-12T00:00:00+00:00", "overridden": False},
        "safety_evaluated_medications": _medication_signature(meds),
        "scribe_metadata": {},
    }
    updates = {}
    async def fake_get(coll, doc_id):
        return dict(consultation) if coll == "consultations" else ({"patient_id": "pat_x", "phone": "+919182736455"} if coll == "appointments" else {"phone": "+919182736455"})
    async def fake_update(coll, doc_id, data): updates.update(data)
    async def fake_billing(*a, **k): return {"invoice_id": "inv1", "patient_id": k.get("patient_id")}
    with patch("agents.clinical_scribe.get_document", side_effect=fake_get), \
         patch("agents.clinical_scribe.update_document", side_effect=fake_update), \
         patch("agents.billing_pulse.BillingPulseAgent.on_consultation_close", side_effect=fake_billing):
        res = await agent.approve_consultation("cons_m", "cln_x")
    assert res.get("status") == "approved", res


def test_invoice_model_has_patient_id():
    from models.billing import Invoice
    assert "patient_id" in Invoice.__table__.columns, "Invoice must persist patient_id"
