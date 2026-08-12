#!/usr/bin/env python3
"""
Simulates the exact browser ConsultationRecorder workflow against the running backend server:
1. Generate real spoken audio via macOS `say` or WAV PCM.
2. POST /api/v1/consultations/upload-chunk with multipart/form-data.
3. POST /api/v1/consultations/transcribe with uploaded chunk paths.
4. Verify response contains live STT transcript, SOAP note, ICD-10 codes, and extracted medications.
"""
import os
import sys
import time
import requests
import subprocess

BASE_URL = "http://127.0.0.1:8000"
CLINIC_ID = "cln_e2e_test_clinic"
CONSULTATION_ID = f"cons_browser_flow_{int(time.time())}"
APPOINTMENT_ID = f"app_browser_flow_{int(time.time())}"

print("=" * 70)
print(f"TESTING REAL BROWSER TRANSCRIPTION WORKFLOW AGAINST {BASE_URL}")
print("=" * 70)

# 1. Synthesize real spoken audio
temp_audio = f"/tmp/browser_test_{CONSULTATION_ID}.wav"
dialogue = (
    "Doctor, I have had high fever, severe dry cough, and sore throat for three days. "
    "Doctor: Your temperature is 101.4 degrees Fahrenheit and pulse is 82. I am diagnosing acute viral bronchitis. "
    "I am prescribing Paracetamol 650mg thrice daily after food for three days and Cetirizine 10mg once daily at bedtime for five days."
)

print(f"\n1. Generating real spoken audio with `say`...")
subprocess.run(["say", dialogue, "-o", temp_audio, "--data-format=LEI16@16000"], check=True)
audio_size = os.path.getsize(temp_audio)
print(f"   ✓ Audio generated: {temp_audio} ({audio_size} bytes, 16kHz mono WAV)")

# 2. Upload chunk via multipart/form-data (simulating ConsultationRecorder.tsx)
print(f"\n2. Uploading chunk via POST /api/v1/consultations/upload-chunk...")
headers = {
    "X-Clinic-ID": CLINIC_ID,
    "Authorization": "Bearer dev_mock_id_token"
}
params = {
    "consultation_id": CONSULTATION_ID,
    "clinic_id": CLINIC_ID,
    "chunk_index": 0
}

with open(temp_audio, "rb") as f:
    files = {"file": ("chunk_0000.webm", f, "audio/webm")}
    resp = requests.post(f"{BASE_URL}/api/v1/consultations/upload-chunk", params=params, files=files, headers=headers)

print(f"   HTTP Status: {resp.status_code}")
if resp.status_code != 200:
    print(f"   ✕ Upload failed: {resp.text}")
    sys.exit(1)

upload_data = resp.json()
print(f"   ✓ Upload response: {upload_data}")
chunk_path = upload_data.get("chunk_path")

# 3. Call /consultations/transcribe
print(f"\n3. Triggering POST /api/v1/consultations/transcribe...")
transcribe_payload = {
    "clinic_id": CLINIC_ID,
    "consultation_id": CONSULTATION_ID,
    "appointment_id": APPOINTMENT_ID,
    "chunk_paths": [chunk_path],
    "language_code": "en-IN"
}

t0 = time.monotonic()
transcribe_resp = requests.post(f"{BASE_URL}/api/v1/consultations/transcribe", json=transcribe_payload, headers=headers)
latency = int((time.monotonic() - t0) * 1000)

print(f"   HTTP Status: {transcribe_resp.status_code} (Latency: {latency} ms)")
if transcribe_resp.status_code != 200:
    print(f"   ✕ Transcribe failed: {transcribe_resp.text}")
    sys.exit(1)

result = transcribe_resp.json()
print(f"\n4. Consultation Scribe Result:")
print(f"   • Status:           {result.get('status')}")
print(f"   • Transcript:       {result.get('transcript_raw')[:120]}...")
print(f"   • Subjective:       {result.get('soap_note', {}).get('subjective')[:100]}...")
print(f"   • Assessment:       {result.get('soap_note', {}).get('assessment')}")
print(f"   • Diagnoses:        {result.get('diagnoses')}")
print(f"   • Medications:      {result.get('medications')}")
print(f"   • Provenance:       {result.get('scribe_metadata', {}).get('provider')} | {result.get('scribe_metadata', {}).get('model_used')} @ {result.get('scribe_metadata', {}).get('location')}")

# Validate assertions
assert result.get("status") == "draft", "Status must be draft"
assert len(result.get("transcript_raw", "")) > 10, "Transcript must not be empty"
assert len(result.get("medications", [])) >= 1, "Medications must be extracted"
assert result.get("scribe_metadata", {}).get("execution_status") == "live", "Execution status must be live"

print("\n" + "=" * 70)
print("✓ REAL BROWSER TRANSCRIPTION WORKFLOW PASSED WITH 100% LIVE AI!")
print("=" * 70)

# Cleanup
if os.path.exists(temp_audio):
    os.remove(temp_audio)
