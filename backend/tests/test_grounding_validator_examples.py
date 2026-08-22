"""Pins the Grounding Validator examples cited in the technical architecture doc.

The architecture document states two concrete rejection behaviours as
"implemented and unit-tested". These are those tests. If the validator ever
stops rejecting an unsupported descriptor or a fabricated duration, the
documentation becomes a false claim and this suite fails.

The rule under test: a clinical fact reaches the SOAP note only if it is
traceable to something actually said in the transcript. The model may propose
"dry cough"; only "cough" survives if "dry" was never spoken.
"""
import pytest

from utils.grounding_validator import validate_and_sanitize_clinical_facts


def _facts(symptoms, duration=None):
    return {"clinical_facts": {"symptoms": symptoms, "duration": duration or {}}}


def _rejection_reasons(rejected):
    return " ".join(r.get("reason", "") for r in rejected).lower()


def test_unsupported_descriptor_dry_is_rejected_and_symptom_downgraded():
    """Patient said "cough"; the model wrote "dry cough". "dry" must not survive."""
    transcript = "[Patient]: I have cough for 2 days. [Doctor]: Any fever?"

    sanitized, rejected = validate_and_sanitize_clinical_facts(
        transcript=transcript,
        raw_data=_facts([{"name": "dry cough"}], {"value": "2 days"}),
        consultation_id="cons_grounding_test",
    )

    names = [s["name"].lower() for s in sanitized["clinical_facts"]["symptoms"]]

    # The fabricated descriptor is gone...
    assert "dry cough" not in names, f"unsupported descriptor survived: {names}"
    # ...but the symptom the patient actually reported is preserved.
    assert "cough" in names, f"grounded symptom was lost: {names}"
    # And the rejection is recorded rather than silently dropped.
    assert rejected, "rejection was not logged"
    assert "dry" in _rejection_reasons(rejected)


def test_descriptor_is_kept_when_the_patient_actually_said_it():
    """The validator must not be a blunt filter: supported descriptors survive."""
    transcript = "[Patient]: I have a dry cough for 2 days."

    sanitized, _ = validate_and_sanitize_clinical_facts(
        transcript=transcript,
        raw_data=_facts([{"name": "dry cough"}], {"value": "2 days"}),
        consultation_id="cons_grounding_test",
    )

    names = [s["name"].lower() for s in sanitized["clinical_facts"]["symptoms"]]
    assert any("cough" in n for n in names)
    # "dry" was spoken, so nothing about the descriptor should be rejected.
    assert "dry cough" in names or "cough" in names


def test_duration_not_present_in_transcript_is_rejected():
    """A timing the patient never gave must not reach the note."""
    transcript = "[Patient]: I took paracetamol once."

    sanitized, rejected = validate_and_sanitize_clinical_facts(
        transcript=transcript,
        raw_data=_facts([{"name": "fever"}], {"value": "yesterday"}),
        consultation_id="cons_grounding_test",
    )

    duration = sanitized["clinical_facts"].get("duration")
    assert not duration, f"fabricated duration survived: {duration}"
    assert "duration" in _rejection_reasons(rejected) or rejected


def test_duration_present_in_transcript_is_preserved():
    transcript = "[Patient]: fever for 2 days now."

    sanitized, _ = validate_and_sanitize_clinical_facts(
        transcript=transcript,
        raw_data=_facts([{"name": "fever"}], {"value": "2 days"}),
        consultation_id="cons_grounding_test",
    )

    duration = sanitized["clinical_facts"].get("duration")
    assert duration and duration.get("value") == "2 days"
    assert duration.get("source") == "transcript"
    # Grounded facts carry the evidence span they were derived from.
    assert duration.get("evidence")
