"""
Regression and Integration Tests for VaidyaAI Speech-to-Text & ClinicalScribe Pipeline
Validates exact Google Cloud Speech-to-Text single-request construction, process safety,
fail-closed clinical policies, and end-to-end audio processing.
"""
import os
import shutil
import sys
import tempfile
import wave
import struct
import pytest
from unittest.mock import MagicMock, patch

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
        # Generate silence/low noise
        data = struct.pack("<" + "h" * num_frames, *[0] * num_frames)
        wav_file.writeframes(data)


def _fake_concat_success(chunk_paths, output_path):
    """Deterministic stand-in for FFmpeg concatenation.

    Copies the first chunk to the output path and reports success so tests that
    target the SpeechClient request-construction / fail-closed boundary can run
    without a real FFmpeg binary. This does NOT weaken the production audio
    pipeline; it only isolates the preprocessing boundary in unit tests.
    """
    if chunk_paths and os.path.isfile(chunk_paths[0]):
        shutil.copyfile(chunk_paths[0], output_path)
    return True


@pytest.fixture
def stt_service():
    return SpeechToTextService()


@pytest.mark.asyncio
async def test_1_speech_client_single_request_object(stt_service):
    """TEST 1: Verify Speech client receives exactly one RecognizeRequest object."""
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

    with patch("services.speech_to_text.speech", create=True) as mock_speech, \
         patch.object(stt_service, "_get_client", return_value=mock_client), \
         patch.object(stt_service, "concat_audio_chunks", side_effect=_fake_concat_success):
        mock_speech.RecognitionAudio = MagicMock()
        mock_speech.RecognitionConfig = MagicMock()
        mock_speech.RecognizeRequest = MagicMock()
        result = await stt_service.transcribe_audio_chunks([wav_path], language_code="te-IN")

        assert mock_client.recognize.called
        call_kwargs = mock_client.recognize.call_args.kwargs
        call_args = mock_client.recognize.call_args.args

        # MUST receive request as either first positional arg or request= keyword arg,
        # and MUST NOT pass config= or audio= simultaneously as keyword arguments.
        assert "config" not in call_kwargs, "config must NOT be passed as a separate keyword argument when request is set"
        assert "audio" not in call_kwargs, "audio must NOT be passed as a separate keyword argument when request is set"
        assert "request" in call_kwargs or len(call_args) == 1

        assert result["transcript"] == "Test speech transcript"
        assert result["confidence"] == 0.94
        assert result["execution_status"] == "live"
        assert result["mock"] is False

    if os.path.exists(wav_path):
        os.remove(wav_path)


@pytest.mark.asyncio
async def test_2_no_mixed_request_invocation(stt_service):
    """TEST 2: Verify no mixed invocation occurs in _transcribe_audio_sync."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        wav_path = f.name
    create_dummy_wav(wav_path, duration_sec=0.2)

    with open(wav_path, "rb") as f:
        audio_bytes = f.read()

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.results = []
    mock_client.recognize.return_value = mock_response

    with patch("services.speech_to_text.speech", create=True) as mock_speech, \
         patch.object(stt_service, "_get_client", return_value=mock_client):
        mock_speech.RecognitionAudio = MagicMock()
        mock_speech.RecognitionConfig = MagicMock()
        mock_speech.RecognizeRequest = MagicMock()
        stt_service._transcribe_audio_sync(audio_bytes, language_code="te-IN")
        
        args, kwargs = mock_client.recognize.call_args
        assert "request" in kwargs or len(args) == 1
        assert "config" not in kwargs
        assert "audio" not in kwargs

    if os.path.exists(wav_path):
        os.remove(wav_path)


def test_3_valid_16khz_mono_audio_concat(stt_service):
    """TEST 3: Verify FFmpeg concatenates chunks into 16kHz mono WAV."""
    if not stt_service.ffmpeg_path:
        pytest.skip("FFmpeg not installed")

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


@pytest.mark.asyncio
async def test_4_empty_audio_fails_safely(stt_service):
    """TEST 4: Empty audio fails safely without crash."""
    result = await stt_service.transcribe_audio_chunks([])
    assert result["transcript"] == ""
    assert result["confidence"] == 0.0
    assert result["mock"] is False


def test_5_missing_ffmpeg_fails_safely():
    """TEST 5: Missing FFmpeg binary fails safely and returns False."""
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


@pytest.mark.asyncio
async def test_6_stt_api_failure_does_not_fabricate_mock(stt_service):
    """TEST 6: When LIVE_CLINICAL_AI=True, STT API failure raises RuntimeError instead of mock."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        wav_path = f.name
    create_dummy_wav(wav_path, duration_sec=0.2)

    mock_client = MagicMock()
    mock_client.recognize.side_effect = Exception("Google Cloud Quota Exceeded")

    with patch("services.speech_to_text.speech", create=True) as mock_speech, \
         patch.object(stt_service, "_get_client", return_value=mock_client), \
         patch.object(stt_service, "concat_audio_chunks", side_effect=_fake_concat_success), \
         patch.object(settings, "LIVE_CLINICAL_AI", True), \
         patch.object(settings, "AI_ALLOW_MOCK_FALLBACK", False):
        mock_speech.RecognitionAudio = MagicMock()
        mock_speech.RecognitionConfig = MagicMock()
        mock_speech.RecognizeRequest = MagicMock()
        
        with pytest.raises(RuntimeError) as excinfo:
            await stt_service.transcribe_audio_chunks([wav_path])
        assert "Google Cloud Speech-to-Text inference failed" in str(excinfo.value) or "Google Cloud Speech-to-Text client is unavailable" in str(excinfo.value)

    if os.path.exists(wav_path):
        os.remove(wav_path)


@pytest.mark.asyncio
async def test_6b_live_clinical_ai_never_fabricates_mock_even_when_fallback_enabled(stt_service):
    """TEST 6b: LIVE_CLINICAL_AI=True must NEVER fabricate mock transcription,
    even when AI_ALLOW_MOCK_FALLBACK=True. This is a clinical safety invariant."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        wav_path = f.name
    create_dummy_wav(wav_path, duration_sec=0.2)

    mock_client = MagicMock()
    mock_client.recognize.side_effect = Exception("Google Cloud Quota Exceeded")

    with patch("services.speech_to_text.speech", create=True) as mock_speech, \
         patch.object(stt_service, "_get_client", return_value=mock_client), \
         patch.object(stt_service, "concat_audio_chunks", side_effect=_fake_concat_success), \
         patch.object(settings, "LIVE_CLINICAL_AI", True), \
         patch.object(settings, "AI_ALLOW_MOCK_FALLBACK", True), \
         patch.object(settings, "ENVIRONMENT", "development"):
        mock_speech.RecognitionAudio = MagicMock()
        mock_speech.RecognitionConfig = MagicMock()
        mock_speech.RecognizeRequest = MagicMock()

        with pytest.raises(RuntimeError) as excinfo:
            await stt_service.transcribe_audio_chunks([wav_path])
        assert "Google Cloud Speech-to-Text inference failed" in str(excinfo.value) or "Google Cloud Speech-to-Text client is unavailable" in str(excinfo.value)

    if os.path.exists(wav_path):
        os.remove(wav_path)


@pytest.mark.asyncio
async def test_7_dev_mock_allowed_only_when_explicitly_configured(stt_service):
    """TEST 8: Dev mock works ONLY when LIVE_CLINICAL_AI=False & AI_ALLOW_MOCK_FALLBACK=True."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        wav_path = f.name
    create_dummy_wav(wav_path, duration_sec=0.2)

    mock_client = MagicMock()
    mock_client.recognize.side_effect = Exception("Network offline")

    with patch("services.speech_to_text.speech", create=True) as mock_speech, \
         patch.object(stt_service, "_get_client", return_value=mock_client), \
         patch.object(stt_service, "concat_audio_chunks", side_effect=_fake_concat_success), \
         patch.object(settings, "LIVE_CLINICAL_AI", False), \
         patch.object(settings, "AI_ALLOW_MOCK_FALLBACK", True), \
         patch.object(settings, "ENVIRONMENT", "development"):
        mock_speech.RecognitionAudio = MagicMock()
        mock_speech.RecognitionConfig = MagicMock()
        mock_speech.RecognizeRequest = MagicMock()
        
        result = await stt_service.transcribe_audio_chunks([wav_path])
        assert result["mock"] is True
        assert result["execution_status"] == "mock"
        assert "Namaste" in result["transcript"] or "Doctor" in result["transcript"]

    if os.path.exists(wav_path):
        os.remove(wav_path)


def test_8_process_safe_client_lifecycle(stt_service):
    """TEST 11: SpeechClient is recreated if process PID changes (fork safe)."""
    # Patch _ensure_speech_imported to a no-op so the patched `speech` module is
    # used deterministically and never overwritten by the real google-cloud-speech
    # import (which would attempt real ADC credential initialization and leave
    # _client_pid unset in a credential-less CI environment).
    with patch("services.speech_to_text._ensure_speech_imported"), \
         patch("services.speech_to_text.speech", create=True) as mock_speech:
        mock_speech.SpeechClient = MagicMock()
        client1 = stt_service._get_client()
        initial_pid = stt_service._client_pid
        assert initial_pid == os.getpid()

        # Same process: requesting again reuses the same client instance.
        client1_again = stt_service._get_client()
        assert client1_again is client1
        assert stt_service._client_pid == os.getpid()

        # Simulate process fork / PID change
        stt_service._client_pid = initial_pid + 999
        # Requesting client again should re-initialize for new PID
        client2 = stt_service._get_client()
        assert stt_service._client_pid == os.getpid()
        # The client is recreated (a fresh SpeechClient is constructed) after the
        # PID change; the mock's constructor is invoked again for the new PID.
        assert mock_speech.SpeechClient.call_count >= 2
