import pytest
from unittest.mock import AsyncMock, patch
from prompts.referral_extraction import build_referral_extraction_prompt
from agents.referral_coordinator import (
    ReferralCoordinatorAgent,
    escalate_referral_urgency,
    normalize_referral_urgency,
)


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


# ─── Clinician urgency must never be downgraded by the model ──────────────────

def test_clinician_escalation_overrides_routine_model_urgency():
    # Safety: the doctor asked for an emergency referral; the LLM said routine.
    for requested in ("emergency", "stat", "asap", "URGENT"):
        assert escalate_referral_urgency("routine", requested) == "urgent"


def test_model_escalation_preserved_when_clinician_unspecified():
    assert escalate_referral_urgency("urgent", None) == "urgent"
    assert escalate_referral_urgency("emergency", None) == "urgent"


def test_both_routine_stays_routine():
    assert escalate_referral_urgency("routine", "routine") == "routine"
    assert escalate_referral_urgency(None, None) == "routine"
    assert escalate_referral_urgency("whenever", "whenever") == "routine"


# ─── Referral letter must never be None (regression for [:200] crash) ─────────

@pytest.mark.asyncio
async def test_referral_letter_none_does_not_crash_relational_mirror():
    """Regression: Gemini returning ``formal_referral_letter: null`` (key present
    with a None value) used to leave referral_letter as None, so the relational
    mirror's ``referral_letter[:200]`` raised TypeError and the referral was
    never persisted to Postgres. The fallback must cover the null-value case."""
    agent = ReferralCoordinatorAgent()

    async def fake_gemini(task, prompt, system_prompt=None, model=None):
        return {"formal_referral_letter": None, "urgency": "routine"}, 5

    class _FakeResult:
        def scalar_one_or_none(self):
            return None

    class _FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def execute(self, *a, **k):
            return _FakeResult()

        def add(self, *a, **k):
            pass

        async def commit(self):
            pass

    with patch.object(agent, "_timed_gemini_json_call", side_effect=fake_gemini), \
         patch("agents.referral_coordinator.get_document", new=AsyncMock(return_value={
             "soap_note": {"subjective": "Chest tightness"},
             "diagnoses": [{"code": "I20.9", "description": "Angina"}],
         })), \
         patch("agents.referral_coordinator.set_document", new=AsyncMock()), \
         patch("agents.referral_coordinator.AsyncSessionFactory", return_value=_FakeSession()), \
         patch.object(agent.whatsapp_svc, "send_text_message", new=AsyncMock()), \
         patch.object(agent.logger, "log_decision", new=AsyncMock()):
        result = await agent.generate_and_track_referral(
            consultation_id="cons_test_12345678",
            clinic_id="cln_e2e_test_clinic",
            patient_phone="+919876543210",
        )

    assert result.get("formal_referral_letter"), "referral letter must not be None"
    assert "Referred patient for evaluation" in result["formal_referral_letter"]
