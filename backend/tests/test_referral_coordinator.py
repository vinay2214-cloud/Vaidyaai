import pytest
from prompts.referral_extraction import build_referral_extraction_prompt


def test_referral_prompt_builder():
    soap = {
        "subjective": "Chest tightness",
        "objective": "BP 150/95",
        "assessment": "Suspected Angina",
        "plan": "Refer to Cardiology"
    }
    prompt = build_referral_extraction_prompt(soap, diagnoses=["Angina Pectoris"])

    assert "Angina" in prompt
    assert "Cardiology" in prompt
    assert "REFERRAL" in prompt.upper()
