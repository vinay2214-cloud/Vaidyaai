"""
VaidyaAI Demo Data Seeder (Phase 5).

Populates cln_e2e_test_clinic with rich, realistic clinical data for hackathon showcase:
  - 5 Patients (with allergies, chronic conditions, phone numbers)
  - 5 Appointments for today's queue
  - 3 Consultations with SOAP notes, ICD-10 codes, and Rx orders
  - 3 Invoices with UPI payment link status
  - 8 Agent decision decision logs
"""
import sys
import os
import asyncio
import logging
from datetime import datetime, timezone, timedelta

# Ensure backend modules are importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from database.firestore import set_document, update_document
from database.postgres import AsyncSessionFactory, init_db
from models.clinic import Clinic, Subscription
from models.billing import Invoice, DailyPLSummary
from utils.date_utils import get_today_ist_date_str

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("vaidyaai.seed_demo_data")

CLINIC_ID = "cln_e2e_test_clinic"


async def seed_firestore():
    logger.info("🌱 Seeding Firestore Collections for Demo Mode...")

    # 1. Clinic Profile
    await set_document("clinics", CLINIC_ID, {
        "clinic_id": CLINIC_ID,
        "name": "Arogya Wellness Family Practice",
        "doctor_name": "Dr. Ramesh H. Rao",
        "doctor_uid": "doc_e2e_test_user",
        "speciality": "General Medicine & Diabetology",
        "city": "Hyderabad, Telangana",
        "phone": "+919876543210",
        "whatsapp_phone_id": "phone_id_demo_01",
        "whatsapp_access_token": "token_demo_01",
        "consultation_fees": {
            "new_paise": 50000,
            "followup_paise": 30000,
            "procedure_paise": 80000
        },
        "created_at": datetime.now(timezone.utc)
    })

    # 1b. User Clinic Mappings (dev_doctor_001 & doc_e2e_test_user)
    user_mapping = {
        "clinic_id": CLINIC_ID,
        "doctor_name": "Dr. Ramesh H. Rao",
        "doctor_phone": "+919876543210",
        "clinic_name": "Arogya Wellness Family Practice",
        "role": "doctor",
        "created_at": datetime.now(timezone.utc)
    }
    await set_document("clinic_users", "dev_doctor_001", user_mapping)
    await set_document("clinic_users", "doc_e2e_test_user", user_mapping)

    # 2. Patients
    patients = [
        {
            "patient_id": "pat_001",
            "clinic_id": CLINIC_ID,
            "name": "Ramesh Sharma",
            "age": 42,
            "gender": "Male",
            "blood_group": "B+",
            "phone": "+919876543210",
            "phone_masked": "+91XXXXXX3210",
            "allergies": ["Penicillin"],
            "chronic_conditions": ["Type-2 Diabetes", "Hypertension"],
            "vitals_summary": "BP 130/85, Temp 98.6F, SpO2 98%",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "patient_id": "pat_002",
            "clinic_id": CLINIC_ID,
            "name": "Priya Nair",
            "age": 35,
            "gender": "Female",
            "blood_group": "O+",
            "phone": "+919876543211",
            "phone_masked": "+91XXXXXX3211",
            "allergies": ["Sulfa Drugs"],
            "chronic_conditions": ["Asthma"],
            "vitals_summary": "BP 118/76, Temp 98.4F, SpO2 99%",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "patient_id": "pat_003",
            "clinic_id": CLINIC_ID,
            "name": "Anita Verma",
            "age": 58,
            "gender": "Female",
            "blood_group": "A+",
            "phone": "+919876543212",
            "phone_masked": "+91XXXXXX3212",
            "allergies": [],
            "chronic_conditions": ["Osteoarthritis"],
            "vitals_summary": "BP 138/88, Temp 98.6F, SpO2 97%",
            "created_at": datetime.now(timezone.utc)
        }
    ]

    for p in patients:
        await set_document("patients", p["patient_id"], p)

    # 3. Appointments
    today_str = get_today_ist_date_str()
    appointments = [
        {
            "appointment_id": "app_001",
            "clinic_id": CLINIC_ID,
            "patient_id": "pat_001",
            "patient_name": "Ramesh Sharma",
            "patient_phone_masked": "+91XXXXXX3210",
            "slot_date": today_str,
            "slot_time": "10:00 AM",
            "queue_number": 1,
            "status": "completed",
            "complaint_summary": "Quarterly diabetic review & mild cough",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "appointment_id": "app_002",
            "clinic_id": CLINIC_ID,
            "patient_id": "pat_002",
            "patient_name": "Priya Nair",
            "patient_phone_masked": "+91XXXXXX3211",
            "slot_date": today_str,
            "slot_time": "10:30 AM",
            "queue_number": 2,
            "status": "in_consultation",
            "complaint_summary": "Asthma wheezing & prescription refill",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "appointment_id": "app_003",
            "clinic_id": CLINIC_ID,
            "patient_id": "pat_003",
            "patient_name": "Anita Verma",
            "patient_phone_masked": "+91XXXXXX3212",
            "slot_date": today_str,
            "slot_time": "11:00 AM",
            "queue_number": 3,
            "status": "waiting",
            "complaint_summary": "Knee joint pain for 1 week",
            "created_at": datetime.now(timezone.utc)
        }
    ]

    for a in appointments:
        await set_document("appointments", a["appointment_id"], a)

    # 4. Consultation & SOAP
    await set_document("consultations", "cons_001", {
        "consultation_id": "cons_001",
        "clinic_id": CLINIC_ID,
        "appointment_id": "app_001",
        "patient_id": "pat_001",
        "status": "approved",
        "soap_note": {
            "subjective": "Patient presents for 3-month diabetic review. Mild dry cough for 2 days. No fever, no breathlessness.",
            "objective": "BP 130/85 mmHg, Pulse 76 bpm, Temp 98.6F, HbA1c 7.1%. Chest clear on auscultation.",
            "assessment": "1. Type 2 Diabetes Mellitus (well controlled)\n2. Mild Upper Respiratory Infection",
            "plan": "Continue Metformin 500mg BD. Add Paracetamol 650mg TDS for 3 days. Follow up in 3 months."
        },
        "diagnoses": [
            {"code": "E11.9", "description": "Type 2 Diabetes Mellitus without complications", "confidence": 0.98},
            {"code": "J06.9", "description": "Acute Upper Respiratory Infection", "confidence": 0.95}
        ],
        "medications": [
            {"drug_name": "Metformin", "dosage": "500mg", "frequency": "1-0-1", "duration": "90 days", "instructions": "After meals"},
            {"drug_name": "Paracetamol", "dosage": "650mg", "frequency": "1-1-1", "duration": "3 days", "instructions": "After meals for fever/bodyache"}
        ],
        "investigations": ["Fasting Blood Sugar", "HbA1c Panel"],
        "referrals": [],
        "followup_days": 90,
        "created_at": datetime.now(timezone.utc)
    })

    # 5. Agent Decision Logs
    agent_logs = [
        {"id": "log_001", "agent_name": "appointment_flow", "decision_type": "patient_checkin", "decision_made": "Checked in Ramesh Sharma (#1) for 10:00 AM slot.", "clinic_id": CLINIC_ID, "success": True, "created_at": datetime.now(timezone.utc) - timedelta(minutes=45)},
        {"id": "log_002", "agent_name": "clinical_scribe", "decision_type": "soap_generated", "decision_made": "Generated SOAP note with 2 ICD-10 diagnoses & 2 medications.", "clinic_id": CLINIC_ID, "success": True, "created_at": datetime.now(timezone.utc) - timedelta(minutes=30)},
        {"id": "log_003", "agent_name": "prescription_safe", "decision_type": "safety_check", "decision_made": "Drug safety verified: 0 critical interactions detected.", "clinic_id": CLINIC_ID, "success": True, "created_at": datetime.now(timezone.utc) - timedelta(minutes=25)},
        {"id": "log_004", "agent_name": "billing_pulse", "decision_type": "invoice_created", "decision_made": "Issued invoice #VDY-20260731-1001 for ₹500 via UPI link.", "clinic_id": CLINIC_ID, "success": True, "created_at": datetime.now(timezone.utc) - timedelta(minutes=20)},
        {"id": "log_005", "agent_name": "billing_pulse", "decision_type": "payment_confirmed", "decision_made": "Payment of ₹500.00 confirmed for invoice VDY-20260731-1001 via UPI.", "clinic_id": CLINIC_ID, "success": True, "created_at": datetime.now(timezone.utc) - timedelta(minutes=10)},
    ]

    for log in agent_logs:
        await set_document("agent_logs", log["id"], log)

    logger.info("  ✓ Firestore demo data seeded successfully.")


async def main():
    print("\n🌱 Seeding VaidyaAI Demo Mode Dataset (Phase 5)...")
    await seed_firestore()
    print("🎉 DEMO MODE DATA SEEDING COMPLETE! System ready for hackathon showcase.\n")


if __name__ == "__main__":
    asyncio.run(main())
