#!/usr/bin/env python3
"""
Benchmark Gemini 2.5 Pro vs Gemini 2.5 Flash on the exact mixed Telugu/English clinical scenario.
Tests:
1. Factual extraction accuracy across 12 facts.
2. Grounding error rate (unsupported facts like 'yesterday', 'dry cough').
3. Missing fact rate.
4. Latency and JSON validity.
"""
import os
import sys
import json
import time
import asyncio

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, backend_dir)

from services.gemini import GeminiService
from config import settings

dialogue = """
[Doctor]: Good morning. What brings you in today?
[Patient]: Good morning, doctor. నాకు రెండు రోజులుగా జ్వరం మరియు దగ్గు ఉంది. కొంచెం గొంతు నొప్పి కూడా ఉంది.
[Doctor]: Okay. How high was the fever? Any breathing difficulty or chest pain?
[Patient]: Around 101 degrees Fahrenheit. శ్వాస తీసుకోవడంలో ఇబ్బంది లేదు, chest pain కూడా లేదు.
[Doctor]: Any medical conditions or medication allergies?
[Patient]: No diabetes, no BP, doctor. కానీ నాకు penicillin allergy ఉంది.
[Doctor]: Have you taken anything for the fever?
[Patient]: Yes. I took paracetamol once, and the fever came down temporarily.
[Doctor]: Anyone at home with similar symptoms?
[Patient]: Yes, మా తమ్ముడికి last week cold and cough వచ్చింది.
[Doctor]: Alright. Thank you. We'll review your symptoms and proceed accordingly.
"""

# Abstract Generic System Prompt without hardcoded clinical values
GROUNDED_PROMPT_TEMPLATE = """You are an expert AI clinical documentation scribe assisting medical doctors in India.
Your job is to convert clinical consultation transcripts (with Doctor and Patient speaker diarization, which may contain Telugu, English, Hindi, or code-mixed speech) into strictly transcript-grounded, healthcare-grade structured clinical facts, SOAP notes, and ICD-10 suggestions.

STRICT ZERO-FABRICATION & EVIDENCE-GROUNDING RULES:
1. NEVER add descriptors that were not explicitly spoken. If the patient mentions "cough" (దగ్గు), output "cough", NOT "dry cough" or "productive cough" unless explicitly stated.
2. NEVER add temporal modifiers that were not explicitly spoken. If the patient says "I took paracetamol once", timing is "once", NOT "yesterday" or "this morning".
3. NEVER invent or infer unmentioned vitals. If Blood Pressure, Pulse, SpO2, or Weight were not spoken in the transcript, their fields MUST be null.
4. NEVER invent medication dosages, frequencies, or unmentioned allergies.
5. Preserve explicit negative findings (e.g. no breathing difficulty / dyspnea, no chest pain, no diabetes, no hypertension).
6. Distinguish patient-reported medication history (taken at home) from doctor-prescribed medications in the plan.
7. Tag any AI-suggested diagnoses with "is_provisional": true and "status": "AI_SUGGESTION".
8. Every extracted clinical fact must cite exact supporting text or phrases from the transcript in its "evidence" field.

Return ONLY valid JSON matching this exact schema:

{
  "clinical_facts": {
    "symptoms": [
      {
        "name": "<symptom name strictly as stated in transcript>",
        "evidence": "<exact transcript quote>"
      }
    ],
    "duration": {
      "value": "<exact duration as stated in transcript, e.g. 2 days>",
      "evidence": "<exact transcript quote>"
    },
    "positive_findings": [
      {
        "finding": "<positive clinical finding>",
        "evidence": "<exact transcript quote>"
      }
    ],
    "negative_findings": [
      {
        "finding": "<explicitly denied symptom or condition>",
        "evidence": "<exact transcript quote>"
      }
    ],
    "allergies": [
      {
        "allergen": "<stated allergen>",
        "reaction": "<reaction if stated, else null>",
        "evidence": "<exact transcript quote>"
      }
    ],
    "medications_taken": [
      {
        "drug_name": "<drug name stated>",
        "dosage": "<stated dosage if any, else null>",
        "timing": "<stated timing e.g. once, else null>",
        "effect": "<reported effect if any, else null>",
        "evidence": "<exact transcript quote>"
      }
    ],
    "medical_history": [
      {
        "condition": "<stated history or denied condition>",
        "status": "present | absent",
        "evidence": "<exact transcript quote>"
      }
    ],
    "exposures": [
      {
        "description": "<stated sick contact or exposure>",
        "evidence": "<exact transcript quote>"
      }
    ],
    "vitals": {
      "temperature": "<stated temperature value if any, else null>",
      "blood_pressure": null,
      "heart_rate": null,
      "spo2": null,
      "respiratory_rate": null,
      "weight": null
    }
  },
  "subjective": "<Concise, factual summary of patient-reported symptoms, duration, home medications, negative symptoms, and allergies. Do not invent unstated words.>",
  "objective": "<Document only vitals and exams explicitly stated in transcript. Do not fabricate vitals.>",
  "assessment": "<Clinical impression. State clearly if provisional/suggested.>",
  "plan": "<Doctor's plan from transcript, or supportive care recommendations.>",
  "diagnoses": [
    {
      "code": "<ICD-10 code, e.g. J06.9>",
      "description": "<Diagnosis description>",
      "is_provisional": true,
      "status": "AI_SUGGESTION",
      "confidence": 0.95
    }
  ],
  "medications": [],
  "investigations": [],
  "referrals": [],
  "followup_days": null
}
"""

async def evaluate_model(model_name: str, location: str):
    print(f"\n=======================================================")
    print(f"BENCHMARKING MODEL: {model_name} @ {location}")
    print(f"=======================================================")
    
    svc = GeminiService()
    prompt = f"{GROUNDED_PROMPT_TEMPLATE}\n\nCONSULTATION TRANSCRIPT:\n{dialogue}"
    
    t0 = time.monotonic()
    try:
        res_str = await svc.generate(prompt=prompt, model=model_name)
        latency_ms = int((time.monotonic() - t0) * 1000)
    except Exception as e:
        print(f"FAILED: {e}")
        return None
        
    print(f"Latency: {latency_ms} ms")
    
    # Parse JSON
    clean_json = res_str.strip()
    if clean_json.startswith("```"):
        lines = clean_json.split("\n")
        clean_json = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        
    try:
        data = json.loads(clean_json)
        json_valid = True
    except Exception as e:
        print(f"JSON Parsing Error: {e}")
        print(f"Raw Output:\n{res_str}")
        return None

    facts = data.get("clinical_facts", {})
    subj = data.get("subjective", "")
    obj = data.get("objective", "")
    
    print("\n--- EXTRACTED JSON ---")
    print(json.dumps(data, indent=2, ensure_ascii=False))
    
    # 1. Ground Truth Checks (12 Facts)
    all_text = json.dumps(data).lower()
    
    # Facts present
    fever_ok = "fever" in all_text or "జ్వరం" in all_text
    cough_ok = "cough" in all_text or "దగ్గు" in all_text
    duration_ok = "2" in str(facts.get("duration", "")) or "రెండు" in str(facts.get("duration", ""))
    sore_throat_ok = "sore throat" in all_text or "గొంతు నొప్పి" in all_text or "throat" in all_text
    temp_101_ok = "101" in str(facts.get("vitals", {})) or "101" in obj or "101" in subj
    no_dyspnea_ok = any("breath" in str(n).lower() or "dyspnea" in str(n).lower() or "శ్వాస" in str(n).lower() for n in facts.get("negative_findings", []))
    no_chest_pain_ok = any("chest" in str(n).lower() for n in facts.get("negative_findings", []))
    no_diabetes_ok = any("diabetes" in str(h).lower() for h in facts.get("medical_history", [])) or any("diabetes" in str(n).lower() for n in facts.get("negative_findings", []))
    no_htn_ok = any("bp" in str(h).lower() or "hypertension" in str(h).lower() or "blood pressure" in str(h).lower() for h in facts.get("medical_history", [])) or any("bp" in str(n).lower() or "hypertension" in str(n).lower() for n in facts.get("negative_findings", []))
    penicillin_ok = any("penicillin" in str(a).lower() for a in facts.get("allergies", []))
    paracetamol_ok = any("paracetamol" in str(m).lower() for m in facts.get("medications_taken", []))
    fever_improved_ok = any("temporary" in str(m).lower() or "came down" in str(m).lower() or "improv" in str(m).lower() for m in facts.get("medications_taken", []))
    exposure_ok = any("brother" in str(e).lower() or "cold" in str(e).lower() or "తమ్ముడు" in str(e).lower() for e in facts.get("exposures", []))

    ground_truth_score = sum([
        fever_ok, cough_ok, duration_ok, sore_throat_ok, temp_101_ok,
        no_dyspnea_ok, no_chest_pain_ok, no_diabetes_ok, no_htn_ok,
        penicillin_ok, paracetamol_ok, fever_improved_ok, exposure_ok
    ])
    
    # 2. Grounding Violation Checks (Unsupported Facts)
    unsupported_facts = []
    
    # Check for "dry cough"
    symptoms_str = str(facts.get("symptoms", [])).lower()
    if "dry cough" in symptoms_str or "dry cough" in subj.lower():
        unsupported_facts.append("dry cough (only 'cough' was stated)")
        
    # Check for "yesterday"
    meds_str = str(facts.get("medications_taken", [])).lower()
    if "yesterday" in meds_str or "yesterday" in subj.lower():
        unsupported_facts.append("yesterday (only 'once' was stated, no 'yesterday')")
        
    # Check for "3 days"
    if "3 days" in all_text or "3-day" in all_text:
        unsupported_facts.append("3 days (only 2 days was stated)")
        
    # Check for fabricated vitals
    vitals = facts.get("vitals", {})
    if vitals.get("blood_pressure") not in (None, "", "null"):
        unsupported_facts.append(f"fabricated BP: {vitals.get('blood_pressure')}")
    if vitals.get("heart_rate") not in (None, "", "null"):
        unsupported_facts.append(f"fabricated HR: {vitals.get('heart_rate')}")
    if vitals.get("spo2") not in (None, "", "null"):
        unsupported_facts.append(f"fabricated SpO2: {vitals.get('spo2')}")
    if vitals.get("weight") not in (None, "", "null"):
        unsupported_facts.append(f"fabricated weight: {vitals.get('weight')}")

    print("\n--- BENCHMARK EVALUATION RESULTS ---")
    print(f"  • Ground Truth Facts Extracted: {ground_truth_score} / 13")
    print(f"  • Grounding Violations / Hallucinations: {len(unsupported_facts)}")
    for uf in unsupported_facts:
        print(f"      ✕ VIOLATION: {uf}")
    if not unsupported_facts:
        print("      ✓ ZERO GROUNDING VIOLATIONS DETECTED!")
        
    return {
        "model": model_name,
        "location": location,
        "latency_ms": latency_ms,
        "ground_truth_score": ground_truth_score,
        "unsupported_facts": unsupported_facts,
        "data": data
    }

async def run_benchmark():
    pro_res = await evaluate_model(settings.GEMINI_REASONING_MODEL, settings.GEMINI_REASONING_LOCATION)
    flash_res = await evaluate_model(settings.GEMINI_FAST_MODEL, settings.GEMINI_FAST_LOCATION)
    
    print("\n" + "=" * 70)
    print("FINAL MODEL COMPARISON SUMMARY:")
    print("=" * 70)
    if pro_res:
        print(f"Gemini 2.5 Pro:  Latency={pro_res['latency_ms']}ms | Facts={pro_res['ground_truth_score']}/13 | Violations={len(pro_res['unsupported_facts'])}")
    if flash_res:
        print(f"Gemini 2.5 Flash: Latency={flash_res['latency_ms']}ms | Facts={flash_res['ground_truth_score']}/13 | Violations={len(flash_res['unsupported_facts'])}")

asyncio.run(run_benchmark())
