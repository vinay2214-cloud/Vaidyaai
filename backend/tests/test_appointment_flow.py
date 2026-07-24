import pytest
from prompts.appointment_intent import build_appointment_intent_prompt
from utils.phone_utils import normalize_phone, mask_phone
from utils.phi_anonymiser import anonymise_for_llm


def test_appointment_intent_prompt_builder():
    msg = "doctor garu appointment kavali"
    prompt = build_appointment_intent_prompt(msg)
    assert msg in prompt
    assert "BOOK" in prompt
    assert "EMERGENCY" in prompt


def test_phone_utils():
    assert normalize_phone("9876543210") == "+919876543210"
    assert normalize_phone("+91 9876543210") == "+919876543210"
    assert mask_phone("+919876543210") == "XXXXXXXX3210"


def test_phi_anonymiser():
    text = "Patient Ramesh Reddy with phone 9876543210 called for fever."
    anonymised = anonymise_for_llm(text, patient_name="Ramesh Reddy")
    assert "9876543210" not in anonymised
    assert "[PHONE]" in anonymised
    assert "Ramesh" not in anonymised
