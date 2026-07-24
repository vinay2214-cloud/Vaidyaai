import pytest
from utils.phone_utils import normalize_phone, mask_phone


def test_patient_phone_masking():
    raw_phone = "9876543210"
    sanitized = normalize_phone(raw_phone)
    masked = mask_phone(sanitized)

    assert sanitized == "+919876543210"
    assert masked.endswith("3210")
