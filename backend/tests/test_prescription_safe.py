import pytest
from prompts.drug_safety import build_drug_safety_prompt


def test_drug_safety_prompt_builder():
    meds = [
        {"drug_name": "Warfarin", "dosage": "5mg"},
        {"drug_name": "Aspirin", "dosage": "75mg"}
    ]
    prompt = build_drug_safety_prompt(meds, known_allergies=["Penicillin"], patient_age=65)

    assert "Warfarin" in prompt
    assert "Aspirin" in prompt
    assert "Penicillin" in prompt
    assert "65" in prompt
    assert "DRUG_INTERACTION" in prompt
