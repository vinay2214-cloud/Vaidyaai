"""E2E workflow validation for VaidyaAI release candidate.

Exercises the full clinical workflow against a running local backend:
  patient register -> appointment walk-in -> consultation start -> vitals
  -> clinical history -> safety check -> approve -> summary -> FHIR -> billing
"""
import json
import sys
import time
import httpx

BASE = "http://127.0.0.1:8000/api/v1"
AUTH = {"Authorization": "Bearer dev_mock_id_token"}
CLINIC = "cln_e2e_test_clinic"

results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f"  -> {detail}" if detail else ""))


def main():
    client = httpx.Client(timeout=60.0)

    # 1. Register patient
    phone = f"+9198{int(time.time()) % 100000000:08d}"
    r = client.post(f"{BASE}/patients/register", json={
        "clinic_id": CLINIC,
        "name": "E2E Test Patient",
        "phone": phone,
        "age": 45,
        "gender": "female",
        "allergies": ["penicillin"],
        "chronic_conditions": ["hypertension"],
    }, headers=AUTH)
    check("register patient", r.status_code == 200, f"HTTP {r.status_code}")
    if r.status_code != 200:
        print(r.text)
        return
    patient = r.json()
    patient_id = patient.get("patient_id") or patient.get("id")
    check("patient_id present", bool(patient_id), f"patient_id={patient_id}")

    # 2. Walk-in appointment
    r = client.post(f"{BASE}/appointments/walk-in", json={
        "clinic_id": CLINIC,
        "patient_id": patient_id,
        "patient_name": "E2E Test Patient",
        "patient_phone": phone,
        "reason": "Fever and cough",
    }, headers=AUTH)
    check("walk-in appointment", r.status_code == 200, f"HTTP {r.status_code}")
    if r.status_code != 200:
        print(r.text)
        return
    appt = r.json()
    appointment_id = appt.get("appointment_id") or appt.get("id")
    check("appointment_id present", bool(appointment_id), f"appointment_id={appointment_id}")

    # 3. Start consultation
    r = client.post(f"{BASE}/consultations/start", json={
        "clinic_id": CLINIC,
        "appointment_id": appointment_id,
    }, headers=AUTH)
    check("start consultation", r.status_code == 200, f"HTTP {r.status_code}")
    if r.status_code != 200:
        print(r.text)
        return
    cons = r.json()
    cons_id = cons.get("consultation_id")
    check("consultation_id present", bool(cons_id), f"consultation_id={cons_id}")
    check("patient_id preserved", cons.get("patient_id") == patient_id, f"got {cons.get('patient_id')}")

    # 4. Add vitals
    r = client.post(f"{BASE}/consultations/{cons_id}/vitals", json={
        "clinic_id": CLINIC,
        "vitals": {"bp_systolic": 130, "bp_diastolic": 85, "pulse": 78, "temperature": 99.2, "spo2": 97},
    }, headers=AUTH)
    check("add vitals", r.status_code == 200, f"HTTP {r.status_code}")

    # 5. Add clinical history
    r = client.post(f"{BASE}/consultations/{cons_id}/clinical-history", json={
        "clinic_id": CLINIC,
        "allergies": ["penicillin"],
        "chronic_conditions": ["hypertension"],
        "current_medications": [{"drug_name": "Amlodipine", "dosage": "5mg", "frequency": "OD"}],
    }, headers=AUTH)
    check("add clinical history", r.status_code == 200, f"HTTP {r.status_code}")

    # 6. Get consultation
    r = client.get(f"{BASE}/consultations/{cons_id}?clinic_id={CLINIC}", headers=AUTH)
    check("get consultation", r.status_code == 200, f"HTTP {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        check("vitals preserved", bool(data.get("vitals")), f"vitals={data.get('vitals')}")

    # 7. Safety check — deterministic allergen guard must flag penicillin allergy
    r = client.post(f"{BASE}/consultations/{cons_id}/check-safety", json={
        "clinic_id": CLINIC,
        "medications": [{"drug_name": "Amoxicillin", "dosage": "500mg", "frequency": "TID", "duration_days": 7}],
        "patient_id": patient_id,
    }, headers=AUTH)
    check("safety check", r.status_code == 200, f"HTTP {r.status_code}")
    if r.status_code == 200:
        safety = r.json()
        check("safety has verdict", "is_safe" in safety, f"keys={list(safety.keys())}")
        check("allergen guard flags penicillin conflict", safety.get("is_safe") is False,
              f"is_safe={safety.get('is_safe')} warnings={safety.get('warnings_count')}")

    # 7b. Re-run safety on the FINAL prescription (Paracetamol) so the signature matches
    r = client.post(f"{BASE}/consultations/{cons_id}/check-safety", json={
        "clinic_id": CLINIC,
        "medications": [{"drug_name": "Paracetamol", "dosage": "500mg", "frequency": "TID", "duration_days": 3}],
        "patient_id": patient_id,
    }, headers=AUTH)
    check("safety re-check on final meds", r.status_code == 200, f"HTTP {r.status_code}")
    if r.status_code == 200:
        check("paracetamol is safe", r.json().get("is_safe") is True, f"is_safe={r.json().get('is_safe')}")

    # 8. Approve with the safety-checked medication (Paracetamol) — must pass safety gate
    r = client.post(f"{BASE}/consultations/{cons_id}/approve", json={
        "clinic_id": CLINIC,
        "edited_medications": [{"drug_name": "Paracetamol", "dosage": "500mg", "frequency": "TID", "duration_days": 3}],
        "edited_soap": {"diagnosis": "Acute upper respiratory infection", "advice": "Rest, fluids."},
        "consultation_type": "new",
    }, headers=AUTH)
    check("approve consultation", r.status_code == 200, f"HTTP {r.status_code}")

    # 9. Patient summary
    r = client.get(f"{BASE}/consultations/patient-summary/{patient_id}?clinic_id={CLINIC}", headers=AUTH)
    check("patient summary", r.status_code == 200, f"HTTP {r.status_code}")
    if r.status_code == 200:
        s = r.json()
        check("summary patient_id matches", s.get("patient_id") == patient_id, f"got {s.get('patient_id')}")

    # 10. FHIR bundle
    r = client.get(f"{BASE}/consultations/{cons_id}/fhir", headers=AUTH)
    check("FHIR bundle", r.status_code == 200, f"HTTP {r.status_code}")
    if r.status_code == 200:
        fhir = r.json()
        check("FHIR resourceType=Bundle", fhir.get("resourceType") == "Bundle", f"got {fhir.get('resourceType')}")
        check("FHIR type=collection", fhir.get("type") == "collection", f"got {fhir.get('type')}")
        check("FHIR has entries", bool(fhir.get("entry")), f"entries={len(fhir.get('entry', []))}")

    # 11. Billing invoice
    r = client.post(f"{BASE}/billing/create-invoice", json={
        "clinic_id": CLINIC,
        "patient_id": patient_id,
        "consultation_id": cons_id,
        "patient_phone": phone,
        "consultation_type": "new",
        "custom_amount_paise": 50000,
    }, headers=AUTH)
    check("create invoice", r.status_code == 200, f"HTTP {r.status_code}")
    if r.status_code == 200:
        inv = r.json()
        check("invoice patient_id matches", inv.get("patient_id") == patient_id, f"got {inv.get('patient_id')}")

    # 12. PDF generation
    r = client.get(f"{BASE}/consultations/{cons_id}/pdf?clinic_id={CLINIC}", headers=AUTH)
    check("PDF generation", r.status_code == 200, f"HTTP {r.status_code} content-type={r.headers.get('content-type')}")

    # Summary
    passed = sum(1 for _, ok, _ in results if ok)
    print(f"\n=== E2E RESULT: {passed}/{len(results)} passed ===")
    for name, ok, detail in results:
        if not ok:
            print(f"  FAILED: {name} {detail}")
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
