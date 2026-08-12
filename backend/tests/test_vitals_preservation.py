"""Regression: scribe transcribe must NOT wipe clinician-entered vitals.

Covers the defect where process_consultation_audio's full set_document
overwrote consultation.vitals with an empty grounded_vitals dict when the
transcript contained no vitals, erasing manually entered vitals.
"""
import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_transcribe_preserves_existing_vitals_when_none_grounded():
    from agents.clinical_scribe import ClinicalScribeAgent

    existing = {
        "consultation_id": "cons_x",
        "clinic_id": "cln_x",
        "patient_id": "pat_x",
        "vitals": {"temp": "101", "bp": "", "pulse": "", "spo2": "", "weight": "", "resp_rate": ""},
        "patient_allergies": ["Penicillin"],
    }

    stt_result = {
        "transcript": "[Patient]: fever for 2 days and cough",
        "raw_text": "[Patient]: fever for 2 days and cough",
        "speaker_turns": ["[Patient]: fever for 2 days and cough"],
        "confidence": 0.9,
        "provider": "Google Cloud Speech-to-Text",
        "execution_status": "live",
        "mock": False,
    }
    soap = {
        "subjective": "fever",
        "objective": "",
        "assessment": "URI",
        "plan": "",
        "diagnoses": [],
        "medications": [],
        "clinical_facts": {"symptoms": [{"name": "fever"}], "vitals": {}},
    }

    agent = ClinicalScribeAgent()
    saved_docs = {}

    async def fake_get(coll, doc_id):
        return dict(existing)

    async def fake_set(coll, doc_id, data, merge=True):
        saved_docs[doc_id] = data

    async def fake_update(coll, doc_id, data):
        pass

    agent._timed_gemini_json_call = AsyncMock(return_value=(soap, 100))
    agent.stt_service.transcribe_audio_chunks = AsyncMock(return_value=stt_result)

    with patch("agents.clinical_scribe.get_document", side_effect=fake_get), \
         patch("agents.clinical_scribe.set_document", side_effect=fake_set), \
         patch("agents.clinical_scribe.update_document", side_effect=fake_update), \
         patch("utils.grounding_validator.validate_and_sanitize_clinical_facts", side_effect=lambda transcript, raw_data, consultation_id: (raw_data, [])), \
         patch("agents.clinical_scribe.anonymise_for_llm", side_effect=lambda t: t):
        await agent.process_consultation_audio(
            consultation_id="cons_x", clinic_id="cln_x", appointment_id="app_x",
            chunk_paths=["/tmp/a.wav"], patient_history="", vitals="",
        )

    doc = saved_docs["cons_x"]
    assert "vitals" not in doc or doc["vitals"] != {}, (
        f"scribe wrote empty vitals dict which would erase clinician entry: {doc.get('vitals')}"
    )
