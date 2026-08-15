import pytest
from prompts.referral_extraction import build_referral_extraction_prompt
from agents.referral_coordinator import normalize_referral_urgency


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


# ─── Referral urgency normalization (regression for None.upper() crash) ───────

def test_urgency_null_normalizes_to_routine():
    # Gemini explicitly returns {"urgency": null}; dict.get() would return None
    # and None.upper() would crash. Must normalize to "routine".
    assert normalize_referral_urgency(None) == "routine"


def test_urgency_missing_normalizes_to_routine():
    # Key absent entirely -> default routine.
    referral_res: dict = {}
    assert normalize_referral_urgency(referral_res.get("urgency")) == "routine"


def test_urgency_empty_string_normalizes_to_routine():
    assert normalize_referral_urgency("") == "routine"
    assert normalize_referral_urgency("   ") == "routine"


def test_urgency_valid_routine_preserved():
    assert normalize_referral_urgency("routine") == "routine"


def test_urgency_valid_urgent_preserved():
    assert normalize_referral_urgency("urgent") == "urgent"


def test_urgency_case_insensitive_normalized():
    assert normalize_referral_urgency("URGENT") == "urgent"
    assert normalize_referral_urgency("Routine") == "routine"


def test_urgency_escalation_synonyms_map_to_urgent():
    # Safety: an escalation must never be silently downgraded to routine.
    assert normalize_referral_urgency("emergency") == "urgent"
    assert normalize_referral_urgency("EMERGENCY") == "urgent"
    assert normalize_referral_urgency("stat") == "urgent"
    assert normalize_referral_urgency("asap") == "urgent"


def test_urgency_invalid_value_normalizes_to_routine():
    # Unrecognised, non-escalating values must not crash and fall back to routine.
    assert normalize_referral_urgency("123") == "routine"
    assert normalize_referral_urgency("whenever") == "routine"


def test_urgency_non_string_type_normalizes_to_routine():
    # Non-string types (e.g. a number) must be handled safely.
    assert normalize_referral_urgency(0) == "routine"
    assert normalize_referral_urgency(True) == "routine"
