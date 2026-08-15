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


def test_timeline_sort_key_orders_mixed_timestamp_formats():
    """Regression: the patient timeline must be deterministically newest-first.

    Consultations are fetched per appointment and concatenated, so without an
    explicit sort the OLDEST encounter could land last in the list and be
    rendered as "Last Visit".
    """
    from datetime import datetime, timezone
    from api.patients import _timeline_sort_key

    docs = [
        {"consultation_id": "old", "created_at": datetime(2026, 2, 16, tzinfo=timezone.utc)},
        {"consultation_id": "new", "created_at": "2026-05-17T09:00:00Z"},
        {"consultation_id": "naive", "created_at": datetime(2026, 3, 1)},
        {"consultation_id": "undated"},
    ]
    ordered = [d["consultation_id"] for d in sorted(docs, key=_timeline_sort_key, reverse=True)]

    assert ordered == ["new", "naive", "old", "undated"]
