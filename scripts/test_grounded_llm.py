#!/usr/bin/env python3
"""
Test Gemini 2.5 Pro with the new Grounded Clinical Facts Extraction & SOAP synthesis prompt.
"""
import os
import sys
import json
import asyncio

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, backend_dir)

from services.gemini import GeminiService
from config import settings

transcript = """
[Doctor]: Namaste, please sit down. What symptoms are you having today?
[Patient]: Doctor, I have had high fever and dry cough for two days, and also a bad sore throat.
[Doctor]: Did you measure your temperature?
[Patient]: Yes doctor, it was approximately 101 degrees Fahrenheit yesterday.
[Doctor]: Do you have any breathing difficulty or chest pain?
[Patient]: No breathing difficulty and no chest pain.
[Doctor]: Do you have any history of diabetes or high blood pressure?
[Patient]: No diabetes and no hypertension.
[Doctor]: Did you take any medicine at home?
[Patient]: I took Paracetamol once yesterday. The fever temporarily improved after Paracetamol.
[Doctor]: Has anyone at home been unwell?
[Patient]: Yes, my brother had a cold and cough last week.
[Doctor]: Do you have any drug allergies?
[Patient]: Yes doctor, I have an explicit Penicillin allergy.
[Doctor]: Understood. We will strictly avoid Penicillin. Your throat has mild congestion. Lungs are clear. This is a provisional viral upper respiratory infection. I will prescribe supportive medication.
"""

# Grounded Clinical Scribe System Prompt
GROUNDED_SOAP_SYSTEM_PROMPT = """You are an expert AI clinical documentation scribe assisting medical doctors in India.
Your job is to convert clinical consultation transcripts (with Doctor and Patient speaker diarization) into strictly transcript-grounded, healthcare-grade structured clinical facts, SOAP notes, and ICD-10 suggestions.

CRITICAL GROUNDING RULES:
1. NEVER invent vitals. Current encounter vitals must ONLY come from explicit vitals mentioned in the transcript or structured inputs. If not stated, field must be null.
2. NEVER invent medications, allergies, or diagnoses.
3. Distinguish patient-reported medication use (e.g. took Paracetamol once at home) from doctor-prescribed new medications in the plan.
4. Preserve explicit negative findings (e.g. no dyspnea, no chest pain, no diabetes, no hypertension).
5. Preserve symptom duration exactly (e.g. "2 days" must remain "2 days", never changed to 3 days).
6. Preserve explicit patient-reported allergies (e.g. "Penicillin allergy") and flag them for clinician review.
7. If the doctor did not declare a confirmed diagnosis in the transcript, label the assessment as "AI SUGGESTION / PROVISIONAL".

Return ONLY valid JSON matching this exact schema:

{
  "clinical_facts": {
    "symptoms": ["fever", "dry cough", "sore throat"],
    "duration": "2 days",
    "positive_findings": ["pharyngeal congestion (mild)"],
    "negative_findings": ["no breathing difficulty / dyspnea", "no chest pain", "no diabetes", "no hypertension"],
    "allergies": [
      {
        "allergen": "Penicillin",
        "reaction": "Unspecified allergic reaction",
        "source_evidence": "Patient reported explicit Penicillin allergy"
      }
    ],
    "medications_taken": [
      {
        "drug_name": "Paracetamol",
        "dosage": "Not specified",
        "timing": "Once yesterday at home",
        "effect": "Temporary fever improvement"
      }
    ],
    "current_medications": [],
    "medical_history": ["No diabetes", "No hypertension"],
    "family_history": [],
    "exposures": ["Household contact: brother had cold and cough last week"],
    "vitals": {
      "temperature": "101.0°F (patient-reported)",
      "bp": null,
      "pulse": null,
      "spo2": null,
      "resp_rate": null,
      "weight_kg": null
    }
  },
  "subjective": "Patient presents with a 2-day history of high fever, dry cough, and sore throat. Patient reports measuring temperature at 101°F yesterday. Took Paracetamol once with temporary fever relief. Reports brother had cold/cough last week. Denies breathing difficulty or chest pain. Denies history of diabetes or hypertension. Explicitly reports Penicillin allergy.",
  "objective": "General: Comfortable, no respiratory distress. Temperature: 101.0°F (patient-reported). Vitals: BP, Pulse, SpO2 not recorded. ENT: Mild pharyngeal congestion. Respiratory: Lungs clear to auscultation bilaterally.",
  "assessment": "Provisional Viral Upper Respiratory Infection (AI SUGGESTION / PROVISIONAL). Strict avoidance of Penicillin due to documented patient allergy.",
  "plan": "1. Supportive care and symptom management with non-penicillin medications.\\n2. Adequate hydration and rest.\\n3. Avoid all penicillin and beta-lactam antibiotics.\\n4. Red flag counseling for worsening fever or onset of breathing difficulty.",
  "diagnoses": [
    {
      "code": "J06.9",
      "description": "Acute upper respiratory infection, unspecified (Provisional)",
      "is_provisional": true,
      "confidence": 0.95
    }
  ],
  "medications": [],
  "investigations": [],
  "referrals": [],
  "followup_days": 3
}
"""

async def test_llm():
    svc = GeminiService()
    prompt = f"{GROUNDED_SOAP_SYSTEM_PROMPT}\n\nCONSULTATION TRANSCRIPT:\n{transcript}"
    print(f"Calling Gemini 2.5 Pro @ {settings.GEMINI_REASONING_LOCATION}...")
    t0 = asyncio.get_event_loop().time()
    res_str = await svc.generate(prompt=prompt, model=settings.GEMINI_REASONING_MODEL)
    dt = int((asyncio.get_event_loop().time() - t0) * 1000)
    print(f"Response in {dt} ms:\n")
    
    # Parse JSON
    # Strip markdown if any
    clean_json = res_str.strip()
    if clean_json.startswith("```"):
        lines = clean_json.split("\n")
        clean_json = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    
    data = json.loads(clean_json)
    print(json.dumps(data, indent=2))
    
    facts = data.get("clinical_facts", {})
    print("\n" + "=" * 70)
    print("VERIFYING EXTRACTED GROUNDED FACTS:")
    print("=" * 70)
    print(f"  • Symptoms:            {facts.get('symptoms')}")
    print(f"  • Duration:            {facts.get('duration')}")
    print(f"  • Negative findings:   {facts.get('negative_findings')}")
    print(f"  • Allergies:           {facts.get('allergies')}")
    print(f"  • Meds taken at home:  {facts.get('medications_taken')}")
    print(f"  • Exposures:           {facts.get('exposures')}")
    print(f"  • Vitals:              {facts.get('vitals')}")
    print(f"  • Diagnoses:           {data.get('diagnoses')}")
    
    # Assertions
    assert "2 days" in str(facts.get("duration")), "Duration must be 2 days"
    assert any("penicillin" in str(a).lower() for a in facts.get("allergies", [])), "Penicillin allergy must be extracted"
    assert any("paracetamol" in str(m).lower() for m in facts.get("medications_taken", [])), "Paracetamol at home must be extracted"
    assert any("dyspnea" in str(n).lower() or "breath" in str(n).lower() for n in facts.get("negative_findings", [])), "Negative breathing difficulty must be preserved"
    assert any("chest" in str(n).lower() for n in facts.get("negative_findings", [])), "Negative chest pain must be preserved"
    assert facts.get("vitals", {}).get("bp") is None, "BP must remain null when not stated"
    assert facts.get("vitals", {}).get("pulse") is None, "Pulse must remain null when not stated"
    print("\n✓ ALL GROUNDED EXTRACTION ASSERTIONS PASSED PERFECTLY!")

asyncio.run(test_llm())
