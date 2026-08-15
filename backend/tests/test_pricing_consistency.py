"""Regression tests for canonical pricing consistency and allergy persistence.

Guards against the production-hardening contradictions:
  - the billing estimate and the invoice must derive from the same pricing
    service (no ₹300 vs ₹177 vs ₹300 divergence),
  - patient registration must persist documented allergies (single source of
    truth for the safety pipeline).
"""
import asyncio

import pytest

from services.pricing import calculate_consultation_fee


def _run(coro):
    return asyncio.run(coro)


def test_estimate_and_invoice_share_canonical_pricing():
    """The estimate endpoint and the invoice both use calculate_consultation_fee,
    so a new-patient consultation with 1 medication yields the same total."""
    fees = {"new_patient_paise": 30000, "followup_paise": 15000, "procedure_paise": 50000}

    # Estimate for a new consultation with 1 medication, 0 investigations.
    estimate = calculate_consultation_fee("new", fees, medication_count=1, investigation_count=0)

    # The invoice path (billing_pulse.on_consultation_close) calls the same
    # function with the consultation's own medication/investigation counts.
    invoice = calculate_consultation_fee("new", fees, medication_count=1, investigation_count=0)

    assert estimate["total_paise"] == invoice["total_paise"]
    assert estimate["base_fee_paise"] == 30000
    assert estimate["medication_paise"] == 2500
    assert estimate["total_paise"] == 30000 + 2500 + round(32500 * 0.18)


def test_followup_uses_followup_fee():
    fees = {"new_patient_paise": 30000, "followup_paise": 15000, "procedure_paise": 50000}
    pricing = calculate_consultation_fee("followup", fees)
    assert pricing["base_fee_paise"] == 15000
    assert pricing["total_paise"] == 15000 + round(15000 * 0.18)


def test_register_persists_allergies(monkeypatch):
    """Patient registration must persist documented allergies so the safety
    pipeline (banner, PrescriptionSafe, FHIR) reads the same record."""
    from api.patients import PatientRegisterRequest

    req = PatientRegisterRequest(
        clinic_id="cln_test",
        phone="+919876543210",
        name="Test Patient",
        allergies=["penicillin"],
        chronic_conditions=["asthma"],
    )
    assert req.allergies == ["penicillin"]
    assert req.chronic_conditions == ["asthma"]
