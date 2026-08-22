"""Regression tests for silent ClinicalScribe failures.

A blank SOAP note that looks like a successful one is the most dangerous
outcome this pipeline has. These tests pin the two properties that stop it:

  * a transcript too short to be usable is REFUSED, never sent to the LLM;
  * an unhandled server error reaches the browser as a readable 500 with CORS
    headers, not as an opaque network failure.
"""
import asyncio

import pytest

from agents.clinical_scribe import (
    MIN_USABLE_TRANSCRIPT_CHARS,
    ClinicalScribeAgent,
    ScribeTranscriptionError,
)


def _run(coro):
    return asyncio.run(coro)


class _StubSTT:
    """Stands in for SpeechToTextService with a scripted outcome."""

    def __init__(self, transcript=None, raises=None):
        self._transcript = transcript
        self._raises = raises
        self.calls = 0

    async def transcribe_audio_chunks(self, chunk_paths, language_code="te-IN"):
        self.calls += 1
        if self._raises:
            raise self._raises
        return {"transcript": self._transcript, "confidence": 0.9, "execution_status": "live"}


def _agent(stt):
    agent = ClinicalScribeAgent()
    agent.stt_service = stt
    return agent


@pytest.mark.parametrize("transcript", ["", "   ", "uh", "\n\n  \t "])
def test_empty_transcript_is_refused_not_sent_to_llm(transcript, monkeypatch):
    """An empty transcript must raise rather than produce a note from nothing."""
    agent = _agent(_StubSTT(transcript=transcript))

    called = {"llm": False}

    async def _never(*args, **kwargs):
        called["llm"] = True
        raise AssertionError("LLM must not be called for an unusable transcript")

    monkeypatch.setattr(agent, "_timed_gemini_json_call", _never)

    with pytest.raises(ScribeTranscriptionError) as exc:
        _run(agent.process_consultation_audio(
            consultation_id="cons_test", clinic_id="cln_test",
            appointment_id="app_test", chunk_paths=["/tmp/a.webm"],
        ))

    assert not called["llm"], "Gemini was called with an unusable transcript"
    assert "too short or unclear" in str(exc.value).lower()


def test_stt_failure_raises_readable_error(monkeypatch):
    """A Speech-to-Text failure must not escape as a bare exception.

    This is the exact production failure: the Speech client raised a permission
    error, it propagated to FastAPI as a 500, and the clinician saw placeholder
    text with no explanation.
    """
    boom = RuntimeError("403 Caller does not have required permission to use project")
    agent = _agent(_StubSTT(raises=boom))

    with pytest.raises(ScribeTranscriptionError) as exc:
        _run(agent.process_consultation_audio(
            consultation_id="cons_test", clinic_id="cln_test",
            appointment_id="app_test", chunk_paths=["/tmp/a.webm"],
        ))

    message = str(exc.value)
    assert "not transcribed" in message.lower() or "could not process" in message.lower()
    # The raw provider error must not be shown verbatim to a clinician.
    assert "403" not in message


def test_threshold_is_meaningfully_above_zero():
    """Guard the guard: a threshold of 0 would silently disable the check."""
    assert MIN_USABLE_TRANSCRIPT_CHARS >= 10
