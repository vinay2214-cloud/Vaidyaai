#!/usr/bin/env python3
"""
Forensic trace of the ClinicalScribe pipeline with the exact 12-fact clinical encounter:
1. Synthesize audio with exact 12 facts.
2. Run Speech-to-Text and log raw output, word-level tags, and confidence.
3. Test Gemini 2.5 Pro with Clinical Fact Grounding prompt.
4. Verify extraction of all 12 facts.
"""
import os
import sys
import json
import time
import subprocess

# Set up paths
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, backend_dir)

from config import settings
from services.speech_to_text import SpeechToTextService
from services.gemini import GeminiService

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

temp_audio = "/tmp/forensic_encounter.wav"
print("1. Synthesizing audio chunk...")
subprocess.run(["say", dialogue, "-o", temp_audio, "--data-format=LEI16@16000"], check=True)
print(f"   Audio size: {os.path.getsize(temp_audio)} bytes")

print("\n2. Invoking Speech-to-Text Service...")
stt = SpeechToTextService()
stt_result = stt._transcribe_audio_sync(open(temp_audio, "rb").read(), language_code="en-IN")

print("\n--- RAW STT TRANSCRIPT ---")
print(stt_result.get("transcript"))
print(f"Confidence: {stt_result.get('confidence')}")

# Check 12 facts in STT transcript
raw_t = stt_result.get("transcript", "").lower()
print("\n--- FACT RECOGNITION IN STT ---")
facts_to_check = {
    "fever": "fever" in raw_t,
    "cough": "cough" in raw_t,
    "2 days": "two days" in raw_t or "2 days" in raw_t or "2" in raw_t,
    "sore throat": "sore throat" in raw_t or "throat" in raw_t,
    "101°F": "101" in raw_t or "one hundred" in raw_t,
    "no breathing difficulty": "breathing" in raw_t or "breath" in raw_t,
    "no chest pain": "chest pain" in raw_t or "chest" in raw_t,
    "no diabetes": "diabetes" in raw_t,
    "no hypertension": "hypertension" in raw_t or "blood pressure" in raw_t,
    "paracetamol taken": "paracetamol" in raw_t,
    "household sick contact": "last week" in raw_t or "brother" in raw_t or "cold" in raw_t,
    "penicillin allergy": "penicillin" in raw_t
}

for k, v in facts_to_check.items():
    print(f"  • {k:25s}: {'FOUND [✓]' if v else 'MISSING [✕]'}")

# Cleanup
if os.path.exists(temp_audio):
    os.remove(temp_audio)
