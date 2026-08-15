import pytest
from utils.phone_utils import normalize_phone, mask_phone
from api.patients import PatientCreateRequest, PatientRegisterRequest


def test_patient_phone_masking():
    raw_phone = "9876543210"
    sanitized = normalize_phone(raw_phone)
    masked = mask_phone(sanitized)

    assert sanitized == "+919876543210"
    assert masked.endswith("3210")


def test_patient_request_list_defaults_are_isolated():
    """Mutable list defaults must be per-instance (default_factory), never shared.

    Without default_factory, two request instances would share the SAME list
    object, so mutating one patient's allergies would leak into another.
    """
    a = PatientCreateRequest(clinic_id="c1", phone="+919876543210", name="A")
    b = PatientCreateRequest(clinic_id="c1", phone="+919876543211", name="B")

    # Distinct list objects per instance.
    assert a.allergies is not b.allergies
    assert a.chronic_conditions is not b.chronic_conditions

    # Mutating A must not affect B.
    a.allergies.append("Penicillin")
    assert b.allergies == []
    assert a.allergies == ["Penicillin"]


def test_patient_register_request_list_defaults_are_isolated():
    a = PatientRegisterRequest(clinic_id="c1", phone="+919876543210", name="A")
    b = PatientRegisterRequest(clinic_id="c1", phone="+919876543211", name="B")

    assert a.allergies is not b.allergies
    assert a.chronic_conditions is not b.chronic_conditions

    a.chronic_conditions.append("Hypertension")
    assert b.chronic_conditions == []
    assert a.chronic_conditions == ["Hypertension"]
