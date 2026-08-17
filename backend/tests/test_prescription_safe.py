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


def test_allergen_net_reads_every_medication_name_key():
    """Regression: the deterministic allergy net must not fail OPEN on key shape.

    The consultation workspace sends ``drug_name`` while API clients and
    LLM-generated SOAP plans send ``name``. Reading only ``drug_name`` made the
    net skip the drug entirely, so Amoxicillin passed unexamined for a
    penicillin-allergic patient.
    """
    from agents.prescription_safe import _detect_allergen_conflicts

    for key in ("drug_name", "name", "medication_name"):
        conflicts = _detect_allergen_conflicts(
            [{key: "Amoxicillin 500mg", "dosage": "500mg", "frequency": "TID"}],
            ["Penicillin"],
        )
        assert conflicts, f"allergy conflict missed when name supplied as {key!r}"
        assert conflicts[0]["allergen"] == "Penicillin"
        assert "Amoxicillin" in conflicts[0]["drug_name"]

    # A plain string medication must also be examined.
    assert _detect_allergen_conflicts(["Amoxicillin"], ["Penicillin"])

    # No allergy documented -> no conflict (must not become a false positive).
    assert _detect_allergen_conflicts([{"name": "Amoxicillin"}], []) == []
    assert _detect_allergen_conflicts([{"name": "Amoxicillin"}], ["NKDA"]) == []


def test_medication_signature_is_stable_across_name_keys():
    """The stale-safety-gate signature must not change just because the caller
    used ``name`` instead of ``drug_name`` — otherwise an approved prescription
    looks 'changed' (or an altered one looks unchanged)."""
    from agents.prescription_safe import _medication_signature

    a = _medication_signature([{"drug_name": "Azithromycin", "dosage": "500mg", "frequency": "OD"}])
    b = _medication_signature([{"name": "Azithromycin", "dosage": "500mg", "frequency": "OD"}])
    assert a == b
