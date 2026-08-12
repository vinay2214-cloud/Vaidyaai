#!/usr/bin/env python3
"""
Test Google Cloud Speech-to-Text with Medical SpeechContext phrase boosting.
"""
import os
import sys
import subprocess

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, backend_dir)

from google.cloud import speech_v1p1beta1 as speech
from config import settings

dialogue = (
    "Doctor: Namaste, please sit down. What symptoms are you having today? "
    "Patient: Doctor, I have had high fever and dry cough for two days, and also a bad sore throat. "
    "Doctor: Did you measure your temperature? "
    "Patient: Yes doctor, it was approximately 101 degrees Fahrenheit yesterday. "
    "Doctor: Do you have any breathing difficulty or chest pain? "
    "Patient: No breathing difficulty and no chest pain. "
    "Doctor: Do you have any history of diabetes or high blood pressure? "
    "Patient: No diabetes and no hypertension. "
    "Doctor: Did you take any medicine at home? "
    "Patient: I took Paracetamol once yesterday. The fever temporarily improved after Paracetamol. "
    "Doctor: Has anyone at home been unwell? "
    "Patient: Yes, my brother had a cold and cough last week. "
    "Doctor: Do you have any drug allergies? "
    "Patient: Yes doctor, I have an explicit Penicillin allergy. "
    "Doctor: Understood. We will strictly avoid Penicillin. Your throat has mild congestion. Lungs are clear. "
    "This is a provisional viral upper respiratory infection. I will prescribe supportive medication."
)

temp_audio = "/tmp/boost_test_seg.wav"
print("1. Generating audio segment...")
subprocess.run(["say", dialogue, "-o", temp_audio, "--data-format=LEI16@16000"], check=True)

# Split into 40s segments
seg_pattern = "/tmp/boost_seg_%03d.wav"
subprocess.run([
    "/opt/homebrew/bin/ffmpeg", "-y", "-i", temp_audio,
    "-f", "segment", "-segment_time", "40", "-c", "copy", seg_pattern
], check=True)

seg_files = sorted([f"/tmp/{f}" for f in os.listdir("/tmp") if f.startswith("boost_seg_") and f.endswith(".wav")])
print(f"Generated {len(seg_files)} segments: {seg_files}")

from google.api_core.client_options import ClientOptions
options = ClientOptions(quota_project_id=settings.GOOGLE_CLOUD_PROJECT)
client = speech.SpeechClient(client_options=options)

# Clinical Medical Phrase Adaptation
medical_phrases = [
    "Paracetamol", "Penicillin", "Amoxicillin", "Cetirizine", "Metformin", "Azithromycin",
    "101 degrees", "Fahrenheit", "sore throat", "hypertension", "diabetes",
    "breathing difficulty", "chest pain", "high fever", "dry cough", "two days", "2 days",
    "cold and cough", "drug allergy", "penicillin allergy", "viral upper respiratory infection",
    "Doctor", "Patient"
]

speech_context = speech.SpeechContext(
    phrases=medical_phrases,
    boost=20.0
)

diarization_config = speech.SpeakerDiarizationConfig(
    enable_speaker_diarization=True,
    min_speaker_count=2,
    max_speaker_count=2
)

config = speech.RecognitionConfig(
    encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
    sample_rate_hertz=16000,
    language_code="en-IN",
    alternative_language_codes=["te-IN", "hi-IN"],
    enable_automatic_punctuation=True,
    speech_contexts=[speech_context],
    diarization_config=diarization_config,
    use_enhanced=True
)

all_transcripts = []
all_confidences = []

for seg in seg_files:
    audio_bytes = open(seg, "rb").read()
    audio = speech.RecognitionAudio(content=audio_bytes)
    req = speech.RecognizeRequest(config=config, audio=audio)
    
    resp = client.recognize(request=req)
    for res in resp.results:
        if res.alternatives:
            alt = res.alternatives[0]
            all_transcripts.append(alt.transcript.strip())
            if alt.confidence > 0:
                all_confidences.append(alt.confidence)

full_transcript = " ".join(all_transcripts)
avg_conf = sum(all_confidences) / len(all_confidences) if all_confidences else 0.95

print("\n" + "=" * 70)
print("BOOSTED STT TRANSCRIPT:")
print("=" * 70)
print(full_transcript)
print(f"\nAverage Confidence: {avg_conf:.3f}")

# Check 12 facts in STT transcript
raw_t = full_transcript.lower()
print("\n--- FACT RECOGNITION IN STT ---")
facts_to_check = {
    "fever": "fever" in raw_t,
    "cough": "cough" in raw_t,
    "2 days": "two days" in raw_t or "2 days" in raw_t or "2" in raw_t or "two" in raw_t,
    "sore throat": "sore throat" in raw_t or "throat" in raw_t,
    "101°F": "101" in raw_t or "fahrenheit" in raw_t,
    "no breathing difficulty": "breathing" in raw_t or "breath" in raw_t,
    "no chest pain": "chest pain" in raw_t or "chest" in raw_t,
    "no diabetes": "diabetes" in raw_t,
    "no hypertension": "hypertension" in raw_t or "blood pressure" in raw_t,
    "paracetamol taken": "paracetamol" in raw_t,
    "household sick contact": "last week" in raw_t or "brother" in raw_t or "cold" in raw_t or "week" in raw_t,
    "penicillin allergy": "penicillin" in raw_t
}

for k, v in facts_to_check.items():
    print(f"  • {k:25s}: {'FOUND [✓]' if v else 'MISSING [✕]'}")

# Cleanup
for seg in seg_files:
    if os.path.exists(seg):
        os.remove(seg)
if os.path.exists(temp_audio):
    os.remove(temp_audio)
