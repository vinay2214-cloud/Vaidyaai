"""
VaidyaAI Demo Data Seeder.

Populates a single demo clinic with a COHERENT, FULLY SYNTHETIC clinical
dataset so the application opens on a realistic-looking clinic:

  - 10 synthetic patients across varied clinical scenarios
  - today's appointment queue + historical appointments
  - consultations linked to their appointments (SOAP, ICD-10, medications)
  - referrals linked to their consultations
  - invoices (relational) linked to clinic + patient + consultation
  - agent decision logs backing the dashboard telemetry

EVERY record is fictional and is stamped `is_demo_data: true` /
`data_source: "SYNTHETIC_DEMO"`. No real person's identity, phone number or
clinical information is used. Phone numbers are placeholder digits in a
non-dialable pattern and are additionally flagged `phone_is_synthetic: true`.

The seed is IDEMPOTENT: every document uses a stable ID and every relational
row is upserted on its natural key, so running it twice creates no duplicates.
"""
import sys
import os
import asyncio
import logging
import uuid
from datetime import datetime, timezone, timedelta

# Ensure backend modules are importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from database.firestore import set_document
from database.postgres import AsyncSessionFactory, init_db
from models.clinic import Clinic
from models.billing import Invoice
from models.consultation import ReferralTracking
from utils.date_utils import get_today_ist_date_str
from sqlalchemy import select

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("vaidyaai.seed_demo_data")

CLINIC_ID = "cln_e2e_test_clinic"
CLINIC_NAME = "Arogya Wellness Family Practice"
DOCTOR_NAME = "Dr. Ramesh H. Rao"

# Stable namespace so relational UUID primary keys are reproducible across runs.
DEMO_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_DNS, "demo.vaidyaai.invalid")

# Every seeded record is fictional. These markers make synthetic data
# unambiguously identifiable so it can never be mistaken for real clinical
# activity or real commercial revenue.
DEMO_MARKERS = {"is_demo_data": True, "data_source": "SYNTHETIC_DEMO"}

NOW = datetime.now(timezone.utc)


def demo_uuid(key: str) -> uuid.UUID:
    """Deterministic UUID for a relational row, so re-seeding upserts in place."""
    return uuid.uuid5(DEMO_NAMESPACE, key)


def synthetic_phone(index: int) -> str:
    """Placeholder phone digits — deliberately not a real subscriber number."""
    return f"+9190000000{index:02d}"


def mask(phone: str) -> str:
    return f"{phone[:3]}XXXXXX{phone[-4:]}"


async def seed_document(collection: str, doc_id: str, data: dict):
    """Write a seeded document stamped as synthetic demo data.

    Uses stable document IDs so re-running the seed overwrites in place
    (idempotent) instead of creating duplicates.
    """
    return await set_document(collection, doc_id, {**data, **DEMO_MARKERS})


# ── Synthetic patient catalogue ────────────────────────────────────────────
# `visit_offsets` are days-ago for historical encounters. `queue` (when set)
# places the patient in TODAY's appointment queue.
DEMO_PATIENTS = [
    {
        "n": 1, "name": "Ananya Rao", "age": 34, "gender": "Female", "blood_group": "O+",
        "allergies": ["Penicillin"], "chronic": ["Seasonal allergic rhinitis"],
        "current_medications": [{"drug_name": "Cetirizine", "dosage": "10mg",
                                 "frequency": "PRN", "duration": "as needed",
                                 "instructions": "For seasonal allergy symptoms"}],
        "complaint": "Fever for 2 days, dry cough, sore throat and generalized body ache",
        "diagnosis": ("J30.1", "Allergic rhinitis due to pollen"),
        "meds": [{"drug_name": "Cetirizine", "dosage": "10mg", "frequency": "0-0-1",
                  "duration": "7 days", "instructions": "At bedtime if needed"}],
        "queue": 1, "queue_status": "arrived", "visit_offsets": [93],
    },
    {
        "n": 2, "name": "Arjun Kumar", "age": 52, "gender": "Male", "blood_group": "B+",
        "allergies": [], "chronic": ["Hypertension"],
        "complaint": "Hypertension follow-up, occasional early-morning headache",
        "diagnosis": ("I10", "Essential (primary) hypertension"),
        "meds": [{"drug_name": "Amlodipine", "dosage": "5mg", "frequency": "1-0-0",
                  "duration": "30 days", "instructions": "Morning, after food"}],
        "queue": 2, "queue_status": "in_progress", "visit_offsets": [30, 60],
    },
    {
        "n": 3, "name": "Meera Reddy", "age": 28, "gender": "Female", "blood_group": "A+",
        "allergies": ["Sulfa drugs"], "chronic": ["Migraine"],
        "complaint": "Migraine follow-up, 2 episodes this month",
        "diagnosis": ("G43.909", "Migraine, unspecified, not intractable"),
        "meds": [{"drug_name": "Naproxen", "dosage": "250mg", "frequency": "1-0-1",
                  "duration": "5 days", "instructions": "After food"}],
        "queue": 3, "queue_status": "arrived", "visit_offsets": [28],
    },
    {
        "n": 4, "name": "Ramesh Sharma", "age": 42, "gender": "Male", "blood_group": "B+",
        "allergies": ["Penicillin"], "chronic": ["Type-2 Diabetes", "Hypertension"],
        "complaint": "Quarterly diabetic review with mild dry cough",
        "diagnosis": ("E11.9", "Type 2 diabetes mellitus without complications"),
        "meds": [{"drug_name": "Metformin", "dosage": "500mg", "frequency": "1-0-1",
                  "duration": "90 days", "instructions": "After meals"}],
        "queue": 4, "queue_status": "completed", "visit_offsets": [90, 180],
    },
    {
        "n": 5, "name": "Priya Nair", "age": 35, "gender": "Female", "blood_group": "O+",
        "allergies": ["Sulfa drugs"], "chronic": ["Bronchial asthma"],
        "complaint": "Asthma review and inhaler refill",
        "diagnosis": ("J45.909", "Unspecified asthma, uncomplicated"),
        "meds": [{"drug_name": "Salbutamol inhaler", "dosage": "100mcg", "frequency": "PRN",
                  "duration": "30 days", "instructions": "2 puffs when wheezy"}],
        "queue": 5, "queue_status": "arrived", "visit_offsets": [45],
    },
    {
        "n": 6, "name": "Anita Verma", "age": 58, "gender": "Female", "blood_group": "A+",
        "allergies": [], "chronic": ["Osteoarthritis"],
        "complaint": "Bilateral knee pain for one week",
        "diagnosis": ("M17.0", "Bilateral primary osteoarthritis of knee"),
        "meds": [{"drug_name": "Paracetamol", "dosage": "650mg", "frequency": "1-0-1",
                  "duration": "7 days", "instructions": "After food"}],
        "queue": None, "queue_status": None, "visit_offsets": [14, 75],
    },
    {
        "n": 7, "name": "Vikram Iyer", "age": 46, "gender": "Male", "blood_group": "AB+",
        "allergies": [], "chronic": ["Gastritis"],
        "complaint": "Burning epigastric pain, worse at night",
        "diagnosis": ("K29.70", "Gastritis, unspecified, without bleeding"),
        "meds": [{"drug_name": "Pantoprazole", "dosage": "40mg", "frequency": "1-0-0",
                  "duration": "14 days", "instructions": "Before breakfast"}],
        "queue": None, "queue_status": None, "visit_offsets": [10],
    },
    {
        "n": 8, "name": "Lakshmi Devi", "age": 63, "gender": "Female", "blood_group": "O-",
        "allergies": ["Aspirin"], "chronic": ["Hypothyroidism"],
        "complaint": "Thyroid follow-up, fatigue and weight gain",
        "diagnosis": ("E03.9", "Hypothyroidism, unspecified"),
        "meds": [{"drug_name": "Levothyroxine", "dosage": "50mcg", "frequency": "1-0-0",
                  "duration": "60 days", "instructions": "Empty stomach"}],
        "queue": None, "queue_status": None, "visit_offsets": [60, 120],
    },
    {
        "n": 9, "name": "Sandeep Chowdary", "age": 31, "gender": "Male", "blood_group": "B-",
        "allergies": ["Dust mite"], "chronic": ["Allergic rhinitis"],
        "complaint": "Sneezing, nasal congestion, itchy eyes for 5 days",
        "diagnosis": ("J30.1", "Allergic rhinitis due to pollen"),
        "meds": [{"drug_name": "Cetirizine", "dosage": "10mg", "frequency": "0-0-1",
                  "duration": "7 days", "instructions": "At bedtime"}],
        "queue": None, "queue_status": None, "visit_offsets": [7],
    },
    {
        "n": 10, "name": "Kavya Prasad", "age": 24, "gender": "Female", "blood_group": "A-",
        "allergies": [], "chronic": [],
        "complaint": "Low back pain after lifting, no radiation",
        "diagnosis": ("M54.5", "Low back pain"),
        "meds": [{"drug_name": "Ibuprofen", "dosage": "400mg", "frequency": "1-0-1",
                  "duration": "5 days", "instructions": "After food"}],
        "queue": None, "queue_status": None, "visit_offsets": [5],
    },
]


CONSULT_FEE_PAISE = 50000
FOLLOWUP_FEE_PAISE = 30000


def _soap(p: dict, visit_dt: datetime) -> dict:
    code, desc = p["diagnosis"]
    allergy_line = ", ".join(p["allergies"]) if p["allergies"] else "No known drug allergy"
    chronic_line = ", ".join(p["chronic"]) if p["chronic"] else "No chronic conditions reported"
    med = p["meds"][0]
    return {
        "subjective": (
            f"{p['name']} ({p['age']}/{p['gender'][0]}) reports: {p['complaint']}. "
            f"Known allergies: {allergy_line}. Background: {chronic_line}."
        ),
        "objective": (
            "Afebrile at review. BP 124/80 mmHg, pulse 78/min, SpO2 98% on room air, "
            "respiratory rate 16/min. Systemic examination unremarkable except as documented."
        ),
        "assessment": f"{desc} ({code}).",
        "plan": (
            f"{med['drug_name']} {med['dosage']} {med['frequency']} for {med['duration']} "
            f"({med['instructions']}). Review if symptoms worsen or fail to settle."
        ),
    }


async def seed_firestore():
    logger.info("Seeding Firestore collections with synthetic demo data...")
    today_str = get_today_ist_date_str()

    await seed_document("clinics", CLINIC_ID, {
        "clinic_id": CLINIC_ID,
        "name": CLINIC_NAME,
        "doctor_name": DOCTOR_NAME,
        "doctor_uid": "doc_e2e_test_user",
        "speciality": "General Medicine & Diabetology",
        "city": "Tirupati, Andhra Pradesh",
        "location": "Tirupati, Andhra Pradesh",
        "phone": synthetic_phone(0),
        "phone_is_synthetic": True,
        # Placeholder WhatsApp identifiers: the local demo runs in mock mode and
        # must never claim a real WhatsApp Business connection.
        "whatsapp_phone_id": "DEMO_MOCK_PHONE_ID",
        "whatsapp_access_token": "DEMO_MOCK_TOKEN",
        "whatsapp_mode": "DEVELOPMENT_MOCK",
        "consultation_fees": {
            "new_patient_paise": CONSULT_FEE_PAISE,
            "followup_paise": FOLLOWUP_FEE_PAISE,
            "procedure_paise": 80000,
        },
        "created_at": NOW,
    })

    user_mapping = {
        "clinic_id": CLINIC_ID,
        "doctor_name": DOCTOR_NAME,
        "doctor_phone": synthetic_phone(0),
        "clinic_name": CLINIC_NAME,
        "role": "doctor",
        "created_at": NOW,
    }
    for uid in ("dev_doctor_001", "doc_e2e_test_user"):
        await seed_document("clinic_users", uid, user_mapping)

    counts = {"patients": 0, "appointments": 0, "consultations": 0, "referrals": 0}

    for p in DEMO_PATIENTS:
        pid = f"pat_{p['n']:03d}"
        phone = synthetic_phone(p["n"])
        masked = mask(phone)

        await seed_document("patients", pid, {
            "patient_id": pid,
            "clinic_id": CLINIC_ID,
            "name": p["name"],
            "age": p["age"],
            "gender": p["gender"],
            "blood_group": p["blood_group"],
            "phone": phone,
            # The API and UI read `patient_phone_masked`; keep that exact key.
            "patient_phone_masked": masked,
            "phone_is_synthetic": True,
            "allergies": p["allergies"],
            "chronic_conditions": p["chronic"],
            # Real last-visit date so the UI never claims "Last Visit: Today"
            # for a patient whose most recent encounter was days ago.
            "current_medications": p.get("current_medications", []),
            "last_visit_str": (
                (NOW - timedelta(days=min(p["visit_offsets"]))).strftime("%d %b %Y")
                if p.get("visit_offsets") else "Not recorded"
            ),
            "status_badge": "QUEUED" if p["queue"] else "FOLLOW-UP",
            "visit_count": len(p["visit_offsets"]),
            "created_at": NOW - timedelta(days=max(p["visit_offsets"]) + 30),
        })
        counts["patients"] += 1

        # Historical encounters: appointment -> consultation (-> referral).
        for visit_index, days_ago in enumerate(p["visit_offsets"]):
            visit_dt = NOW - timedelta(days=days_ago)
            appt_id = f"app_{p['n']:03d}_h{visit_index}"
            cons_id = f"cons_{p['n']:03d}_h{visit_index}"
            code, desc = p["diagnosis"]

            await seed_document("appointments", appt_id, {
                "appointment_id": appt_id,
                "clinic_id": CLINIC_ID,
                "patient_id": pid,
                "patient_name": p["name"],
                "patient_phone_masked": masked,
                "slot_date": visit_dt.date().isoformat(),
                "slot_time": "09:30 AM",
                "queue_number": visit_index + 1,
                "status": "completed",
                "complaint_summary": p["complaint"],
                "created_at": visit_dt,
            })
            counts["appointments"] += 1

            await seed_document("consultations", cons_id, {
                "consultation_id": cons_id,
                "clinic_id": CLINIC_ID,
                "appointment_id": appt_id,
                "patient_id": pid,
                "patient_phone_masked": masked,
                "status": "approved",
                "review_status": "CONFIRMED",
                "chief_complaint": p["complaint"],
                "soap_note": _soap(p, visit_dt),
                "diagnoses": [{"code": code, "icd10_code": code, "description": desc}],
                "medications": p["meds"],
                "vitals": {"temperature": 98.6, "heart_rate": 78, "spo2": 98,
                           "blood_pressure": "124/80", "respiratory_rate": 16},
                "investigations": [],
                "referrals": [],
                "followup_days": 30,
                "created_at": visit_dt,
                "approved_at": visit_dt + timedelta(minutes=25),
            })
            counts["consultations"] += 1

        # Today's queue entry (no consultation yet — the demo creates that live).
        if p["queue"]:
            appt_id = f"app_today_{p['n']:03d}"
            await seed_document("appointments", appt_id, {
                "appointment_id": appt_id,
                "clinic_id": CLINIC_ID,
                "patient_id": pid,
                "patient_name": p["name"],
                "patient_phone_masked": masked,
                "slot_date": today_str,
                "slot_time": f"{9 + p['queue']}:00 AM",
                "queue_number": p["queue"],
                "status": p["queue_status"],
                "complaint_summary": p["complaint"],
                "created_at": NOW - timedelta(minutes=60 - p["queue"] * 5),
            })
            counts["appointments"] += 1

    # A referral on the most recent cardiology-relevant encounter.
    await seed_document("referrals", "ref_002_h0", {
        "referral_id": "ref_002_h0",
        "clinic_id": CLINIC_ID,
        "consultation_id": "cons_002_h0",
        "patient_id": "pat_002",
        "referral_type": "specialist",
        "suggested_provider": "Cardiology",
        "urgency": "routine",
        "description": "Hypertension with early-morning headache — cardiology opinion requested.",
        "status": "pending",
        "created_at": NOW - timedelta(days=30),
    })
    counts["referrals"] += 1

    logger.info(
        "  Firestore: %(patients)s patients, %(appointments)s appointments, "
        "%(consultations)s consultations, %(referrals)s referrals." % counts
    )
    return counts


async def seed_agent_logs():
    """Agent decision logs backing dashboard telemetry.

    These are HISTORICAL synthetic records. They are stamped as demo data so the
    UI can distinguish them from events emitted by a live agent run.
    """
    logs = [
        ("log_001", "appointment_flow", "patient_checkin",
         "Checked in Ananya Rao (#1) for the 10:00 AM slot.", 45),
        ("log_002", "clinical_scribe", "soap_generated",
         "Generated SOAP note with 1 ICD-10 diagnosis and 1 medication.", 30),
        ("log_003", "prescription_safe", "safety_check",
         "Allergy cross-check completed against documented penicillin allergy.", 25),
        ("log_004", "billing_pulse", "invoice_created",
         "Issued synthetic demo invoice for the new-patient consultation fee.", 20),
        ("log_005", "referral_coordinator", "referral_created",
         "Routine cardiology referral drafted for hypertension review.", 15),
        ("log_006", "insight_engine", "daily_digest",
         "Compiled clinic daily digest from stored appointment and invoice records.", 10),
        ("log_007", "retention_radar", "outreach_scheduled",
         "Follow-up outreach scheduled for a chronic-care patient.", 5),
    ]
    for log_id, agent, decision_type, decision, minutes_ago in logs:
        await seed_document("agent_logs", log_id, {
            "id": log_id,
            "agent_name": agent,
            "decision_type": decision_type,
            "decision_made": decision,
            "clinic_id": CLINIC_ID,
            "success": True,
            "created_at": NOW - timedelta(minutes=minutes_ago),
        })
    logger.info("  Firestore: %d agent decision logs.", len(logs))


async def seed_relational():
    """Seed the relational store (clinic + invoices) idempotently.

    Invoices are upserted on their natural key (invoice_number) so re-running
    the seed never produces duplicate billing rows or inflated revenue.
    """
    await init_db()
    today_str = get_today_ist_date_str()
    created, updated = 0, 0

    async with AsyncSessionFactory() as db:
        res = await db.execute(select(Clinic).where(Clinic.firebase_clinic_id == CLINIC_ID))
        clinic = res.scalar_one_or_none()
        if clinic is None:
            clinic = Clinic(
                id=demo_uuid(f"clinic:{CLINIC_ID}"),
                firebase_clinic_id=CLINIC_ID,
                name=CLINIC_NAME,
                doctor_name=DOCTOR_NAME,
                phone=synthetic_phone(0),
                whatsapp_phone_id="DEMO_MOCK_PHONE_ID",
                speciality="General Medicine & Diabetology",
                location="Tirupati, Andhra Pradesh",
            )
            db.add(clinic)
            await db.flush()

        # One invoice per patient in today's queue, so today's billing totals are
        # derived from real stored rows rather than a hardcoded figure.
        for p in DEMO_PATIENTS:
            if not p["queue"]:
                continue
            pid = f"pat_{p['n']:03d}"
            invoice_number = f"VDY-DEMO-{today_str.replace('-', '')}-{p['n']:03d}"
            is_followup = bool(p["visit_offsets"])
            amount = FOLLOWUP_FEE_PAISE if is_followup else CONSULT_FEE_PAISE
            paid = p["queue_status"] == "completed"

            row_res = await db.execute(
                select(Invoice).where(Invoice.invoice_number == invoice_number))
            inv = row_res.scalar_one_or_none()
            if inv is None:
                inv = Invoice(
                    id=demo_uuid(f"invoice:{invoice_number}"),
                    invoice_number=invoice_number,
                    clinic_id=clinic.id,
                )
                db.add(inv)
                created += 1
            else:
                updated += 1

            inv.patient_phone_masked = mask(synthetic_phone(p["n"]))
            inv.patient_id = pid
            inv.consultation_firestore_id = (
                f"cons_{p['n']:03d}_h0" if p["visit_offsets"] else None)
            inv.amount_paise = amount
            inv.consultation_type = "followup" if is_followup else "new"
            inv.status = "paid" if paid else "pending"
            inv.payment_method = "upi" if paid else None
            inv.paid_at = NOW - timedelta(minutes=12) if paid else None
            inv.created_at = NOW - timedelta(minutes=50 - p["queue"] * 5)

        await db.commit()

    logger.info("  Relational: %d invoices created, %d updated (idempotent upsert).",
                created, updated)
    return {"invoices_created": created, "invoices_updated": updated}


async def reset_demo_clinic():
    """OPT-IN cleanup so a demo can start from a known state.

    Scoped strictly to the demo clinic: it removes that clinic's Firestore
    documents and relational invoices only. Never runs unless --reset is passed,
    and refuses to run outside development.
    """
    from config import settings
    if settings.is_production:
        raise RuntimeError("SECURITY: --reset is forbidden in production")

    from database.firestore import delete_document, query_documents
    removed = 0
    id_fields = {
        "appointments": "appointment_id",
        "consultations": "consultation_id",
        "referrals": "referral_id",
        "agent_logs": "log_id",
        "patients": "patient_id",
        "retention_outreach": "outreach_id",
    }
    for collection, id_field in id_fields.items():
        for doc in await query_documents(collection, [("clinic_id", "==", CLINIC_ID)]):
            doc_id = doc.get("id") or doc.get(id_field)
            if doc_id:
                await delete_document(collection, doc_id)
                removed += 1

    await init_db()
    async with AsyncSessionFactory() as db:
        res = await db.execute(select(Clinic).where(Clinic.firebase_clinic_id == CLINIC_ID))
        clinic = res.scalar_one_or_none()
        invoices_removed = 0
        outreach_removed = 0
        referrals_removed = 0
        if clinic is not None:
            from models.patient import RetentionOutreach
            rows = (await db.execute(
                select(Invoice).where(Invoice.clinic_id == clinic.id))).scalars().all()
            for inv in rows:
                await db.delete(inv)
                invoices_removed += 1
            outreach_rows = (await db.execute(
                select(RetentionOutreach).where(
                    RetentionOutreach.clinic_id == clinic.id))).scalars().all()
            for row in outreach_rows:
                await db.delete(row)
                outreach_removed += 1
            referral_rows = (await db.execute(
                select(ReferralTracking).where(
                    ReferralTracking.clinic_id == clinic.id))).scalars().all()
            for row in referral_rows:
                await db.delete(row)
                referrals_removed += 1
            await db.commit()

    logger.info(
        "  Reset: removed %d demo documents, %d invoices, %d retention rows and %d referral rows for %s.",
        removed, invoices_removed, outreach_removed, referrals_removed, CLINIC_ID)


async def main():
    from config import settings
    if settings.is_production:
        raise RuntimeError(
            "SECURITY: seed_demo_data.py must never run against production. "
            "Synthetic demo records must not enter a real clinical database."
        )
    do_reset = "--reset" in sys.argv
    print("\nSeeding VaidyaAI synthetic demo dataset...")
    print("  ALL RECORDS ARE FICTIONAL (data_source=SYNTHETIC_DEMO).")
    if do_reset:
        print("  --reset: clearing existing demo-clinic records first.")
        await reset_demo_clinic()
    await seed_firestore()
    await seed_agent_logs()
    await seed_relational()
    print("Demo data seeding complete. Re-running is safe (idempotent).")
    if not do_reset:
        print("  Tip: pass --reset to clear prior demo/test records first.\n")
    else:
        print("")


if __name__ == "__main__":
    asyncio.run(main())
