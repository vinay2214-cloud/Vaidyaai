"""Canonical consultation pricing calculation.

Single source of truth for how a consultation fee is derived. Every surface
(registration, appointment, consultation estimate, invoice, payment, analytics)
must use this function so the numbers can never diverge.

All monetary values are in paise (1/100 of a rupee) to avoid float drift.
"""
from typing import Dict, Any, Optional

# Default per-item add-ons (paise). These are the canonical values used by the
# estimate and the invoice alike.
PER_MEDICATION_PAISE = 2500      # ₹25 per medication
PER_INVESTIGATION_PAISE = 15000  # ₹150 per investigation

# GST on outpatient consultations: EXEMPT.
#
# Healthcare services provided by a clinical establishment or an authorised
# medical practitioner are exempt from GST under Notification 12/2017-Central
# Tax (Rate). VaidyaAI bills individual medical consultations, so charging 18%
# GST was both legally wrong and immediately obvious to any Indian clinician
# reading an invoice.
#
# The field is retained (rather than removed) so invoice payloads, stored
# records and the API contract keep their shape; it simply evaluates to zero.
# A clinic that additionally runs a taxable in-house pharmacy would need a
# separate line item, not a blanket rate applied to the consultation subtotal.
TAX_RATE = 0.0

# Canonical fallback base fees (paise) when a clinic has no configured fees.
DEFAULT_FEES = {
    "new_patient_paise": 30000,
    "followup_paise": 15000,
    "procedure_paise": 50000,
}


def _base_fee_paise(consultation_type: str, clinic_fees: Optional[Dict[str, Any]]) -> int:
    fees = clinic_fees or {}
    if consultation_type == "followup":
        return int(fees.get("followup_paise", DEFAULT_FEES["followup_paise"]))
    if consultation_type == "procedure":
        return int(fees.get("procedure_paise", DEFAULT_FEES["procedure_paise"]))
    # "new" (and any unknown type) uses the new-patient fee.
    return int(fees.get("new_patient_paise", DEFAULT_FEES["new_patient_paise"]))


def calculate_consultation_fee(
    consultation_type: str,
    clinic_fees: Optional[Dict[str, Any]] = None,
    medication_count: int = 0,
    investigation_count: int = 0,
    discount_paise: int = 0,
) -> Dict[str, Any]:
    """Compute the canonical fee breakdown for a consultation.

    Returns (all in paise):
        base_fee_paise, adjustments_paise, discount_paise, tax_paise,
        total_paise, plus the inputs used.
    """
    base_paise = _base_fee_paise(consultation_type, clinic_fees)
    medication_paise = int(medication_count) * PER_MEDICATION_PAISE
    investigation_paise = int(investigation_count) * PER_INVESTIGATION_PAISE
    adjustments_paise = medication_paise + investigation_paise
    subtotal_paise = base_paise + adjustments_paise
    tax_paise = round(subtotal_paise * TAX_RATE)  # 0 while consultations are GST-exempt
    total_paise = max(0, subtotal_paise + tax_paise - int(discount_paise))

    return {
        "consultation_type": consultation_type,
        "base_fee_paise": base_paise,
        "medication_paise": medication_paise,
        "investigation_paise": investigation_paise,
        "adjustments_paise": adjustments_paise,
        "discount_paise": int(discount_paise),
        "tax_paise": tax_paise,
        "total_paise": total_paise,
        "medication_count": int(medication_count),
        "investigation_count": int(investigation_count),
        "base_fee_rupees": base_paise / 100.0,
        "medication_rupees": medication_paise / 100.0,
        "investigation_rupees": investigation_paise / 100.0,
        "total_rupees": total_paise / 100.0,
    }
