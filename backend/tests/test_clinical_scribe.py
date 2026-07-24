import pytest
from prompts.soap_generation import build_soap_generation_prompt
from services.speech_to_text import SpeechToTextService


def test_soap_prompt_builder():
    transcript = "[Doctor]: How are you?\n[Patient]: I have fever."
    prompt = build_soap_generation_prompt(transcript, vitals="Temp 101F")

    assert "DOCTOR" in prompt.upper()
    assert "FEVER" in prompt.upper()
    assert "ICD-10" in prompt


def test_speech_to_text_mock_fallback():
    stt = SpeechToTextService()
    res = stt._mock_transcription("te-IN")

    assert "transcript" in res
    assert "[Doctor]:" in res["transcript"]
    assert "[Patient]:" in res["transcript"]
    assert res["confidence"] >= 0.90
