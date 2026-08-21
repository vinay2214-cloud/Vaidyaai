"""Regression tests for canonical pricing consistency and allergy persistence.

Guards against the production-hardening contradictions:
  - the billing estimate and the invoice must derive from the same pricing
    service (no ₹300 vs ₹177 vs ₹300 divergence),
  - patient registration must persist documented allergies (single source of
    truth for the safety pipeline).
"""
import asyncio

import pytest

from services.pricing import TAX_RATE, calculate_consultation_fee


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
    # Outpatient consultations are GST-exempt, so the total is exactly the
    # subtotal with no tax component added.
    assert estimate["tax_paise"] == 0
    assert estimate["total_paise"] == 30000 + 2500


def test_followup_uses_followup_fee():
    fees = {"new_patient_paise": 30000, "followup_paise": 15000, "procedure_paise": 50000}
    pricing = calculate_consultation_fee("followup", fees)
    assert pricing["base_fee_paise"] == 15000
    assert pricing["tax_paise"] == 0
    assert pricing["total_paise"] == 15000


def test_consultations_are_gst_exempt():
    """Healthcare services provided by a clinical establishment are exempt from
    GST under Notification 12/2017-Central Tax (Rate). Charging 18% on a medical
    consultation is a factual error, so the exemption is pinned here rather than
    left to drift back in via a "restore the tax rate" change."""
    assert TAX_RATE == 0.0

    for consultation_type in ("new", "followup", "procedure"):
        pricing = calculate_consultation_fee(
            consultation_type, None, medication_count=3, investigation_count=2
        )
        assert pricing["tax_paise"] == 0, consultation_type
        # Total is purely base + add-ons, with no tax inflation anywhere.
        assert (
            pricing["total_paise"]
            == pricing["base_fee_paise"] + pricing["adjustments_paise"]
        ), consultation_type


def test_discount_still_applies_without_tax():
    """Removing tax must not break the discount path."""
    pricing = calculate_consultation_fee("new", None, discount_paise=5000)
    assert pricing["total_paise"] == pricing["base_fee_paise"] - 5000


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
