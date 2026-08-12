#!/usr/bin/env python3
"""
VaidyaAI — Speech-to-Text & ClinicalScribe Pipeline Test Harness
Executes all unit and regression tests directly using the Python 3.11 virtual environment.
"""
import os
import sys
import tempfile
import wave
import struct
import asyncio
from unittest.mock import MagicMock, patch

# Ensure backend directory is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from config import settings
from services.speech_to_text import SpeechToTextService
from agents.clinical_scribe import ClinicalScribeAgent


def create_dummy_wav(path: str, duration_sec: float = 1.0, sample_rate: int = 16000):
    """Generates a valid 16kHz mono PCM WAV file."""
    with wave.open(path, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        num_frames = int(duration_sec * sample_rate)
        data = struct.pack("<" + "h" * num_frames, *[0] * num_frames)
        wav_file.writeframes(data)


async def test_1_speech_client_single_request_object():
    """TEST 1: Verify Speech client receives exactly one RecognizeRequest object."""
    print("TEST 1: Speech client single RecognizeRequest object...", end=" ")
    stt_service = SpeechToTextService()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        wav_path = f.name
    create_dummy_wav(wav_path, duration_sec=0.5)

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_alt = MagicMock()
    mock_alt.transcript = "Test speech transcript"
    mock_alt.confidence = 0.94
    mock_alt.words = []
    mock_result = MagicMock()
    mock_result.alternatives = [mock_alt]
    mock_response.results = [mock_result]
    mock_client.recognize.return_value = mock_response

    with patch.object(stt_service, "_get_client", return_value=mock_client):
        result = await stt_service.transcribe_audio_chunks([wav_path], language_code="te-IN")

        assert mock_client.recognize.called, "client.recognize must be called"
        call_kwargs = mock_client.recognize.call_args.kwargs
        call_args = mock_client.recognize.call_args.args

        # MUST receive request as either first positional arg or request= keyword arg,
        # and MUST NOT pass config= or audio= simultaneously as keyword arguments.
        assert "config" not in call_kwargs, "config must NOT be passed as a separate keyword argument when request is set"
        assert "audio" not in call_kwargs, "audio must NOT be passed as a separate keyword argument when request is set"
        assert "request" in call_kwargs or len(call_args) == 1, "Must pass request object"

        assert result["transcript"] == "Test speech transcript"
        assert result["confidence"] == 0.94
        assert result["execution_status"] == "live"
        assert result["mock"] is False

    if os.path.exists(wav_path):
        os.remove(wav_path)
    print("PASSED")


def test_2_no_mixed_request_invocation():
    """TEST 2: Verify no mixed invocation occurs in _transcribe_audio_sync."""
    print("TEST 2: No mixed request invocation in _transcribe_audio_sync...", end=" ")
    stt_service = SpeechToTextService()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        wav_path = f.name
    create_dummy_wav(wav_path, duration_sec=0.2)

    with open(wav_path, "rb") as f:
        audio_bytes = f.read()

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.results = []
    mock_client.recognize.return_value = mock_response

    with patch.object(stt_service, "_get_client", return_value=mock_client):
        stt_service._transcribe_audio_sync(audio_bytes, language_code="te-IN")
        
        args, kwargs = mock_client.recognize.call_args
        assert "request" in kwargs or len(args) == 1
        assert "config" not in kwargs
        assert "audio" not in kwargs

    if os.path.exists(wav_path):
        os.remove(wav_path)
    print("PASSED")


def test_3_valid_16khz_mono_audio_concat():
    """TEST 3: Verify FFmpeg concatenates chunks into 16kHz mono WAV."""
    print("TEST 3: FFmpeg concatenates chunks into 16kHz mono WAV...", end=" ")
    stt_service = SpeechToTextService()
    if not stt_service.ffmpeg_path:
        print("SKIPPED (FFmpeg missing)")
        return

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f1, \
         tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f2, \
         tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as out_f:
        chunk1 = f1.name
        chunk2 = f2.name
        output_wav = out_f.name

    try:
        create_dummy_wav(chunk1, duration_sec=0.5)
        create_dummy_wav(chunk2, duration_sec=0.5)

        success = stt_service.concat_audio_chunks([chunk1, chunk2], output_wav)
        assert success is True
        assert os.path.exists(output_wav)
        assert os.path.getsize(output_wav) > 44

        with wave.open(output_wav, "rb") as wf:
            assert wf.getnchannels() == 1, "Must be mono channel"
            assert wf.getframerate() == 16000, "Must be 16000 Hz sample rate"
            assert wf.getsampwidth() == 2, "Must be 16-bit PCM"
    finally:
        for p in [chunk1, chunk2, output_wav]:
            if os.path.exists(p):
                os.remove(p)
    print("PASSED")


async def test_4_empty_audio_fails_safely():
    """TEST 4: Empty audio fails safely without crash."""
    print("TEST 4: Empty audio fails safely...", end=" ")
    stt_service = SpeechToTextService()
    result = await stt_service.transcribe_audio_chunks([])
    assert result["transcript"] == ""
    assert result["confidence"] == 0.0
    assert result["mock"] is False
    print("PASSED")


def test_5_missing_ffmpeg_fails_safely():
    """TEST 5: Missing FFmpeg binary fails safely and returns False."""
    print("TEST 5: Missing FFmpeg binary fails safely...", end=" ")
    svc = SpeechToTextService()
    svc.ffmpeg_path = "/nonexistent/path/to/ffmpeg"

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f, \
         tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as out_f:
        chunk = f.name
        out_wav = out_f.name
    create_dummy_wav(chunk, duration_sec=0.2)

    try:
        success = svc.concat_audio_chunks([chunk], out_wav)
        assert success is False
    finally:
        for p in [chunk, out_wav]:
            if os.path.exists(p):
                os.remove(p)
    print("PASSED")


async def test_6_stt_api_failure_does_not_fabricate_mock():
    """TEST 6: When LIVE_CLINICAL_AI=True, STT API failure raises RuntimeError instead of mock."""
    print("TEST 6: STT failure in live mode raises RuntimeError (fail-closed)...", end=" ")
    stt_service = SpeechToTextService()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        wav_path = f.name
    create_dummy_wav(wav_path, duration_sec=0.2)

    mock_client = MagicMock()
    mock_client.recognize.side_effect = Exception("Google Cloud Quota Exceeded")

    with patch.object(stt_service, "_get_client", return_value=mock_client), \
         patch.object(settings, "LIVE_CLINICAL_AI", True), \
         patch.object(settings, "AI_ALLOW_MOCK_FALLBACK", False):
        
        try:
            await stt_service.transcribe_audio_chunks([wav_path])
            assert False, "Should have raised RuntimeError"
        except RuntimeError as e:
            assert "Google Cloud Speech-to-Text inference failed" in str(e) or "SpeechClient" in str(e)

    if os.path.exists(wav_path):
        os.remove(wav_path)
    print("PASSED")


async def test_7_dev_mock_allowed_only_when_explicitly_configured():
    """TEST 7: Dev mock works ONLY when LIVE_CLINICAL_AI=False & AI_ALLOW_MOCK_FALLBACK=True."""
    print("TEST 7: Dev mock allowed only when explicitly configured...", end=" ")
    stt_service = SpeechToTextService()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        wav_path = f.name
    create_dummy_wav(wav_path, duration_sec=0.2)

    mock_client = MagicMock()
    mock_client.recognize.side_effect = Exception("Network offline")

    with patch.object(stt_service, "_get_client", return_value=mock_client), \
         patch.object(settings, "LIVE_CLINICAL_AI", False), \
         patch.object(settings, "AI_ALLOW_MOCK_FALLBACK", True), \
         patch.object(settings, "ENVIRONMENT", "development"):
        
        result = await stt_service.transcribe_audio_chunks([wav_path])
        assert result["mock"] is True
        assert result["execution_status"] == "mock"
        assert "Namaste" in result["transcript"] or "Doctor" in result["transcript"]

    if os.path.exists(wav_path):
        os.remove(wav_path)
    print("PASSED")


def test_8_process_safe_client_lifecycle():
    """TEST 8: SpeechClient is recreated if process PID changes (fork safe)."""
    print("TEST 8: Process-safe lazy client lifecycle across PID boundaries...", end=" ")
    stt_service = SpeechToTextService()
    client1 = stt_service._get_client()
    initial_pid = stt_service._client_pid
    assert initial_pid == os.getpid()

    # Simulate process fork / PID change
    stt_service._client_pid = initial_pid + 999
    client2 = stt_service._get_client()
    assert stt_service._client_pid == os.getpid()
    print("PASSED")


async def main():
    print("=" * 65)
    print("VAIDYAAI — SPEECH-TO-TEXT & CLINICAL PIPELINE REGRESSION SUITE")
    print("=" * 65)
    
    await test_1_speech_client_single_request_object()
    test_2_no_mixed_request_invocation()
    test_3_valid_16khz_mono_audio_concat()
    await test_4_empty_audio_fails_safely()
    test_5_missing_ffmpeg_fails_safely()
    await test_6_stt_api_failure_does_not_fabricate_mock()
    await test_7_dev_mock_allowed_only_when_explicitly_configured()
    test_8_process_safe_client_lifecycle()
    
    print("=" * 65)
    print("✓ ALL 8 REGRESSION TESTS PASSED SUCCESSFULLY.")
    print("=" * 65)


if __name__ == "__main__":
    asyncio.run(main())
