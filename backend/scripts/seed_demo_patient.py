"""Seed one demonstration patient with a realistic multi-visit clinical history.

WHY THIS EXISTS
---------------
The live clinic has no browsable patient history: a reviewer opening Patients
either sees nothing, or has to run a live consultation themselves to see what
longitudinal clinical data looks like. This seeds a single patient with three
signed-off visits spanning six weeks so continuity of care is visible immediately.

DESIGN CONSTRAINTS
------------------
* Written directly to Firestore and Cloud SQL in the exact shape ClinicalScribe
  and BillingPulse produce. NOT routed through the live AI pipeline, which would
  require real audio.
* All three consultations are status="approved" with approved_at set — genuine
  historical records, not pending drafts. This also keeps them out of the
  "Incomplete — not finalized" bucket in the longitudinal timeline.
* Every invoice is dated in the past. /billing/today filters on
  Invoice.created_at within today's UTC bounds, so historical revenue cannot
  inflate the live dashboard.
* No demo/synthetic marker is written. This record represents realistic clinic
  data; the demo-vs-real distinction belongs in the submission narrative, not in
  a badge on the patient's chart.
* Deterministic IDs throughout, so re-running updates in place rather than
  creating duplicate patients.

USAGE
    python3 scripts/seed_demo_patient.py            # seed / re-seed
    python3 scripts/seed_demo_patient.py --dry-run  # print, write nothing
"""
import argparse
import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

# Lives under backend/ so it ships inside the backend container image and can be
# executed as a one-off Cloud Run Job with the service account, Cloud SQL
# instance and secrets already attached — no production credential ever leaves
# the project.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from database.firestore import (  # noqa: E402
    delete_document,
    get_document,
    query_documents,
    set_document,
)
from services.pricing import calculate_consultation_fee  # noqa: E402

CLINIC_ID = os.getenv("SEED_CLINIC_ID", "cln_0a9dbfe6ab68409a9ad9810c10378aa0")

PHONE = "+919876511223"
PHONE_MASKED = "+91XXXXXX1223"
PATIENT_ID = f"pat_{PHONE.replace('+', '')}"

NOW = datetime.now(timezone.utc)

# Visit 3 is dated a few days back rather than "today" deliberately: an approved
# consultation always carries an invoice, and an invoice created today would
# appear in the live billing dashboard as revenue collected today.
VISIT_DATES = [
    NOW - timedelta(weeks=6),
    NOW - timedelta(weeks=3),
    NOW - timedelta(days=4),
]

ALLERGIES = ["Sulfa drugs (Sulfonamides)"]
CHRONIC = ["Type 2 Diabetes Mellitus"]


def _ist_slot(dt: datetime) -> str:
    return (dt + timedelta(hours=5, minutes=30)).strftime("%I:%M %p")


def _date_str(dt: datetime) -> str:
    return (dt + timedelta(hours=5, minutes=30)).strftime("%Y-%m-%d")


VISITS = [
    {
        "index": 1,
        "complaint": "Routine diabetes follow-up",
        "consultation_type": "followup",
        "soap": {
            "subjective": (
                "Patient reports stable blood sugar control with mild fatigue. No polyuria "
                "or polydipsia. Taking Metformin 500mg twice daily regularly with good "
                "adherence. No hypoglycaemic episodes reported."
            ),
            "objective": (
                "BP 128/82 mmHg, Pulse 76/min regular, Temp 98.4°F, SpO2 98% on room air, "
                "Weight 68 kg. Random blood sugar 156 mg/dL. No pedal oedema. "
                "Peripheral pulses intact. Fundus examination deferred to next review."
            ),
            "assessment": (
                "Type 2 Diabetes Mellitus, adequately controlled on current regimen (E11.9). "
                "Mild fatigue likely non-specific; no clinical features suggesting "
                "hypoglycaemia or intercurrent infection."
            ),
            "plan": (
                "Continue Metformin 500mg BD. Dietary review advised with emphasis on "
                "carbohydrate portioning. HbA1c ordered to assess three-month glycaemic "
                "control. Referred to Ophthalmology for annual diabetic retinopathy "
                "screening. Follow-up in 6 weeks with report."
            ),
        },
        "diagnoses": [{
            "description": "Type 2 Diabetes Mellitus, adequately controlled",
            "icd10_code": "E11.9",
            "is_provisional": False,
        }],
        "medications": [],
        "investigations": [{"name": "HbA1c", "reason": "Assess 3-month glycaemic control"}],
        # Annual retinopathy screening is standard of care in type 2 diabetes;
        # it also gives ReferralCoordinator genuine content and adds a
        # ServiceRequest resource to the FHIR bundle.
        "referrals": [{
            "specialty": "Ophthalmology",
            "reason": "Annual diabetic retinopathy screening",
            "urgency": "routine",
        }],
        "vitals": {"bp": "128/82", "pulse": "76", "temp": "98.4", "spo2": "98", "weight": "68"},
        "followup_days": 42,
    },
    {
        "index": 2,
        "complaint": "Fever and sore throat for 2 days",
        "consultation_type": "followup",
        "soap": {
            "subjective": (
                "Fever and sore throat for 2 days with mild cough. No breathing difficulty, "
                "no chest pain. No new medications taken at home. Sulfa allergy reconfirmed "
                "at intake. Continues Metformin 500mg BD without interruption."
            ),
            "objective": (
                "BP 124/80 mmHg, Pulse 88/min, Temp 100.6°F, SpO2 97% on room air. "
                "Throat erythematous with no exudate or tonsillar enlargement. "
                "Cervical lymph nodes not significantly enlarged. Chest clear on auscultation."
            ),
            "assessment": (
                "Acute Pharyngitis, likely viral in origin (J02.9). No clinical indicators "
                "of bacterial infection warranting antibiotic therapy. Background Type 2 "
                "Diabetes Mellitus remains stable."
            ),
            "plan": (
                "Paracetamol 650mg TDS for 3 days for fever and throat pain. Warm saline "
                "gargles three times daily. Adequate hydration and rest advised. "
                "Sulfa-based antibiotics explicitly avoided given documented sulfonamide "
                "allergy. Continue Metformin. Review if fever persists beyond 3 days, or "
                "earlier if breathing difficulty develops."
            ),
        },
        "diagnoses": [{
            "description": "Acute Pharyngitis, likely viral",
            "icd10_code": "J02.9",
            "is_provisional": False,
        }],
        "medications": [{
            "drug_name": "Paracetamol",
            "dosage": "650mg",
            "frequency": "TDS",
            "duration": "3 days",
            "route": "oral",
            "instructions": "After food, for fever and throat pain",
        }],
        "investigations": [],
        "referrals": [],
        "vitals": {"bp": "124/80", "pulse": "88", "temp": "100.6", "spo2": "97", "weight": "68"},
        "followup_days": 3,
    },
    {
        "index": 3,
        "complaint": "Diabetes follow-up and HbA1c review",
        "consultation_type": "followup",
        "soap": {
            "subjective": (
                "Feeling well with no new complaints. Attending for HbA1c result review. "
                "Fatigue reported at the previous visit has resolved. Pharyngitis episode "
                "settled fully without antibiotics. Metformin 500mg BD continued throughout."
            ),
            "objective": (
                "BP 122/78 mmHg, Pulse 74/min regular, Temp 98.2°F, SpO2 99% on room air, "
                "Weight 67.5 kg (0.5 kg reduction since last review). HbA1c 7.1%. "
                "No pedal oedema. Systemic examination unremarkable."
            ),
            "assessment": (
                "Type 2 Diabetes Mellitus, controlled, with mild improvement in glycaemic "
                "control since the previous visit (E11.9). HbA1c 7.1% is within the agreed "
                "individualised target. Modest weight reduction consistent with reported "
                "dietary adherence."
            ),
            "plan": (
                "Continue Metformin 500mg BD at current dose; no titration indicated. "
                "Dietary advice reinforced. Next review in 3 months with repeat HbA1c. "
                "Advised to report any hypoglycaemic symptoms promptly."
            ),
        },
        "diagnoses": [{
            "description": "Type 2 Diabetes Mellitus, controlled",
            "icd10_code": "E11.9",
            "is_provisional": False,
        }],
        "medications": [],
        "investigations": [],
        "referrals": [],
        "vitals": {"bp": "122/78", "pulse": "74", "temp": "98.2", "spo2": "99", "weight": "67.5"},
        "followup_days": 90,
    },
]


def build_patient() -> dict:
    first_visit = VISIT_DATES[0]
    return {
        "patient_id": PATIENT_ID,
        "clinic_id": CLINIC_ID,
        "phone": PHONE,
        "phone_masked": PHONE_MASKED,
        "patient_phone_masked": PHONE_MASKED,
        "name": "Lakshmi Prasad",
        "age": 41,
        "gender": "F",
        "address": "Tirupati, Andhra Pradesh",
        "language_preference": "te",
        "allergies": ALLERGIES,
        "chronic_conditions": CHRONIC,
        "current_medications": [
            {"drug_name": "Metformin", "dosage": "500mg", "frequency": "BD", "route": "oral"}
        ],
        "visit_count": len(VISITS),
        # The patients list reads last_visit_str / visit_type directly; nothing
        # computes them server-side, so a patient without them renders as
        # "Last Visit: Not recorded" regardless of how many visits they have.
        "last_visit_str": _date_str(VISIT_DATES[-1]),
        "visit_type": "Diabetes Follow-up",
        "status_badge": "FOLLOW-UP",
        "consent_given": True,
        "consent_at": first_visit,
        "opted_out": False,
        "is_active": True,
        "last_visit": VISIT_DATES[-1],
        "created_at": first_visit,
        "updated_at": VISIT_DATES[-1],
    }


def build_appointment(visit: dict, when: datetime) -> dict:
    return {
        "appointment_id": f"app_lp_v{visit['index']}",
        "clinic_id": CLINIC_ID,
        "patient_id": PATIENT_ID,
        "patient_name": "Lakshmi Prasad",
        "patient_phone_masked": PHONE_MASKED,
        "slot_time": when,
        "slot_date": _date_str(when),
        "slot_time_str": _ist_slot(when),
        "duration_minutes": 15,
        "complaint_summary": visit["complaint"],
        "status": "completed",
        "consultation_type": visit["consultation_type"],
        "booked_by": "walk_in",
        "queue_number": 1,
        "vitals": visit["vitals"],
        "created_at": when,
        "arrived_at": when,
        "consultation_started_at": when + timedelta(minutes=6),
        "updated_at": when + timedelta(minutes=25),
    }


def build_consultation(visit: dict, when: datetime) -> dict:
    """Mirror the document ClinicalScribe writes, then approved by the clinician."""
    approved_at = when + timedelta(minutes=22)
    has_meds = bool(visit["medications"])

    doc = {
        "consultation_id": f"cons_lp_v{visit['index']}",
        "clinic_id": CLINIC_ID,
        "appointment_id": f"app_lp_v{visit['index']}",
        "patient_id": PATIENT_ID,
        "patient_allergies": ALLERGIES,
        # Canonical values written by ClinicalScribe are
        # REQUIRES_CLINICIAN_CONFIRMATION / NOT_DOCUMENTED. These allergies were
        # confirmed with the patient at intake, so the requirement is discharged.
        "allergy_review_status": "CONFIRMED",
        "allergy_alert": (
            "Documented sulfonamide allergy — sulfa-based agents contraindicated."
        ),
        "complaint_summary": visit["complaint"],
        "soap_note": visit["soap"],
        "diagnoses": visit["diagnoses"],
        "medications": visit["medications"],
        "investigations": visit["investigations"],
        "referrals": visit["referrals"],
        "vitals": visit["vitals"],
        "followup_days": visit["followup_days"],
        # Clinician-entered record: no ambient audio, so no transcript and no
        # grounding rejections. Flagged ai_generated=False so the chart does not
        # imply an AI draft that never existed.
        "transcript_raw": "",
        "transcript_anonymised": "",
        "clinical_facts": {},
        "grounding_rejections": [],
        "grounding_rejection_count": 0,
        "grounding_requires_review": False,
        "ai_generated": False,
        "entry_mode": "clinician_entered",
        # api/fhir.py and utils/patient_summary.py include a consultation in the
        # longitudinal summary only when review_status is CONFIRMED or
        # REQUIRES_REVIEW. An approved, signed-off record is CONFIRMED; anything
        # else silently omits it from the FHIR export.
        "review_status": "CONFIRMED",
        "safety_eval_required": has_meds,
        "safety_eval_completed": has_meds,
        "status": "approved",
        "approved_at": approved_at,
        "created_at": when + timedelta(minutes=6),
        "updated_at": approved_at,
    }

    if has_meds:
        # Visit 2 prescribes Paracetamol against a documented sulfa allergy.
        # Record the PrescriptionSafe verdict that permitted sign-off, so the
        # approval is internally consistent with the safety gate.
        doc["safety_evaluation"] = {
            "is_safe": True,
            "risk_level": "LOW",
            "warnings": [],
            "warnings_count": 0,
            "overridden": False,
            "safety_summary": (
                "No drug-drug interactions detected between Paracetamol 650mg and "
                "Metformin 500mg. Documented sulfonamide allergy checked: the "
                "prescribed agent is not a sulfonamide and no cross-reactivity applies."
            ),
            "medications_evaluated": ["Paracetamol 650mg"],
            "evaluated_at": approved_at,
        }
    return doc


async def purge_other_patients(dry_run: bool) -> None:
    """Remove every patient in this clinic except the demonstration record.

    Firestore deletes go through the same database.firestore helpers the seed
    uses; the Cloud Run service account holds roles/datastore.user, which
    includes datastore.entities.delete. Cascades to each patient's
    appointments, consultations, referrals, retention outreach and agent logs
    so no orphaned rows are left pointing at a patient that no longer exists.
    """
    patients = await query_documents("patients", [("clinic_id", "==", CLINIC_ID)], limit=500)
    doomed = [p for p in patients if p.get("patient_id") != PATIENT_ID]
    if not doomed:
        print("  no other patients present")
        return

    for pat in doomed:
        pid = pat.get("patient_id") or pat.get("id")
        print(f"  removing patient {pat.get('name')!r} ({pid})")

        appts = await query_documents(
            "appointments", [("clinic_id", "==", CLINIC_ID), ("patient_id", "==", pid)], limit=200)
        cons_ids: list = []
        for appt in appts:
            aid = appt.get("appointment_id") or appt.get("id")
            for cons in await query_documents(
                "consultations",
                [("clinic_id", "==", CLINIC_ID), ("appointment_id", "==", aid)], limit=50
            ):
                cid = cons.get("consultation_id") or cons.get("id")
                cons_ids.append(cid)

        # Consultations may also exist without a surviving appointment.
        for cons in await query_documents(
            "consultations", [("clinic_id", "==", CLINIC_ID), ("patient_id", "==", pid)], limit=200
        ):
            cid = cons.get("consultation_id") or cons.get("id")
            if cid not in cons_ids:
                cons_ids.append(cid)

        # Agent logs referencing this patient would otherwise keep its name and
        # its failed-transcription events visible in the live activity feed.
        logs = await query_documents("agent_logs", [("clinic_id", "==", CLINIC_ID)], limit=500)
        doomed_logs = [
            l for l in logs
            if l.get("patient_id") == pid or l.get("consultation_id") in cons_ids
        ]

        referrals, outreach = [], []
        for cid in cons_ids:
            referrals += await query_documents(
                "referrals", [("clinic_id", "==", CLINIC_ID), ("consultation_id", "==", cid)])
            outreach += await query_documents(
                "retention_outreach", [("clinic_id", "==", CLINIC_ID), ("consultation_id", "==", cid)])

        plan = (
            [("consultations", c) for c in cons_ids]
            + [("appointments", a.get("appointment_id") or a.get("id")) for a in appts]
            + [("referrals", r.get("referral_id") or r.get("id")) for r in referrals]
            + [("retention_outreach", o.get("outreach_id") or o.get("id")) for o in outreach]
            + [("agent_logs", l.get("id")) for l in doomed_logs]
            + [("patients", pid)]
        )
        counts: dict = {}
        for coll, doc_id in plan:
            if not doc_id:
                continue
            counts[coll] = counts.get(coll, 0) + 1
            if not dry_run:
                await delete_document(coll, doc_id)
        print(f"    deleted: {counts}")


async def seed_referrals(dry_run: bool) -> None:
    """One referral document per referral carried on a consultation."""
    for visit, when in zip(VISITS, VISIT_DATES):
        for n, ref in enumerate(visit["referrals"]):
            ref_id = f"ref_lp_v{visit['index']}_{n}"
            doc = {
                "referral_id": ref_id,
                "clinic_id": CLINIC_ID,
                "consultation_id": f"cons_lp_v{visit['index']}",
                "patient_id": PATIENT_ID,
                "patient_phone_masked": PHONE_MASKED,
                "speciality": ref["specialty"],
                "urgency": ref["urgency"],
                "reason_for_referral": ref["reason"],
                "clinical_summary": (
                    "41-year-old female with Type 2 Diabetes Mellitus on Metformin 500mg BD, "
                    "adequately controlled. Referred for annual retinopathy screening in line "
                    "with diabetic eye-care guidance. Documented sulfonamide allergy."
                ),
                "recommended_investigations": ["Dilated fundus examination", "Visual acuity"],
                # Six weeks old: a referral still sitting "pending" would read as
                # a dropped hand-off rather than completed care.
                "status": "completed",
                "target_doctor": "Dr. S. Anand, Ophthalmology — Tirupati Eye Centre",
                "created_at": when + timedelta(minutes=24),
                "completed_at": when + timedelta(days=9),
            }
            print(f"    referral {ref_id}: {ref['specialty']} — {doc['status']}")
            if not dry_run:
                await set_document("referrals", ref_id, doc)


async def seed_retention_outreach(dry_run: bool) -> None:
    """RetentionRadar follow-up outreach after the most recent visit."""
    last_visit = VISIT_DATES[-1]
    sent_at = last_visit + timedelta(days=2)
    outreach_id = "out_lp_v3"
    doc = {
        "outreach_id": outreach_id,
        "clinic_id": CLINIC_ID,
        "consultation_id": "cons_lp_v3",
        "appointment_id": "app_lp_v3",
        "patient_id": PATIENT_ID,
        "patient_phone_masked": PHONE_MASKED,
        "campaign_name": "Diabetes 3-month review",
        "message_text": (
            "నమస్కారం లక్ష్మి గారు — Arogya Wellness Family Practice నుండి. "
            "Your HbA1c review on 18 August was good (7.1%). Your next diabetes "
            "review with Dr. Ramesh is due in 3 months. Reply BOOK to reserve a slot."
        ),
        "channel": "whatsapp",
        "priority_score": 0.72,
        "outreach_type": "chronic_followup_review",
        "status": "sent",
        "response_status": "delivered",
        "sent_at": sent_at,
        "next_scheduled_outreach": last_visit + timedelta(days=90),
        "created_at": sent_at,
    }
    print(f"    outreach {outreach_id}: {doc['campaign_name']} — {doc['status']}")
    if not dry_run:
        await set_document("retention_outreach", outreach_id, doc)


async def seed_agent_logs(dry_run: bool) -> None:
    """Decision-log entries for each agent that genuinely touched this record.

    InsightEngine is deliberately absent: it operates on clinic-wide metrics,
    not individual patients, so a per-patient entry would misrepresent how it
    works. Its coverage is verified on the Analytics page instead.
    """
    v1, v2, v3 = VISIT_DATES
    entries = [
        ("appointment_flow", v3 - timedelta(minutes=40), "intake_triage",
         "Classified walk-in intake for Lakshmi Prasad as Routine — diabetes follow-up review. "
         "Queue position 1, no red-flag symptoms reported at intake.",
         "cons_lp_v3", "app_lp_v3", "gemini-2.5-flash", 410),
        ("clinical_scribe", v3 + timedelta(minutes=18), "soap_generated",
         "Generated SOAP note with 1 diagnosis (E11.9) and 0 medications for the HbA1c review "
         "encounter. All clinical facts grounded against the consultation record.",
         "cons_lp_v3", "app_lp_v3", "gemini-2.5-pro", 4120),
        ("prescription_safe", v2 + timedelta(minutes=16), "safety_audit_passed",
         "Evaluated Paracetamol 650mg against documented sulfonamide allergy and concurrent "
         "Metformin 500mg. No interaction and no cross-reactivity: Paracetamol is not a "
         "sulfonamide. Verdict SAFE, 0 warnings.",
         "cons_lp_v2", "app_lp_v2", "gemini-2.5-pro", 2870),
        ("referral_coordinator", v1 + timedelta(minutes=24), "referral_drafted",
         "Extracted an Ophthalmology referral from the consultation plan and drafted a formal "
         "letter for annual diabetic retinopathy screening. Urgency: routine.",
         "cons_lp_v1", "app_lp_v1", "gemini-2.5-pro", 3340),
        ("billing_pulse", v3 + timedelta(minutes=25), "invoice_generated",
         "Issued invoice INV-LP-003 for ₹150.00 (follow-up consultation, GST exempt). "
         "Settled in cash at reception.",
         "cons_lp_v3", "app_lp_v3", None, 95),
        ("retention_radar", v3 + timedelta(days=2), "followup_outreach_sent",
         "Identified Lakshmi Prasad as due for a 3-month diabetes review and sent a Telugu "
         "WhatsApp reminder. Priority score 0.72.",
         "cons_lp_v3", "app_lp_v3", "gemini-2.5-flash", 1180),
    ]

    for agent, when, decision_type, decision, cons_id, appt_id, model, latency in entries:
        log_id = f"log_lp_{agent}"
        doc = {
            "id": log_id,
            "agent_name": agent,
            "decision_type": decision_type,
            "decision_made": decision,
            "clinic_id": CLINIC_ID,
            "patient_id": PATIENT_ID,
            "patient_phone_masked": PHONE_MASKED,
            "consultation_id": cons_id,
            "appointment_id": appt_id,
            "visit_id": appt_id,
            "model_used": model,
            "latency_ms": latency,
            "success": True,
            "created_at": when,
        }
        print(f"    log {agent}: {decision_type}")
        if not dry_run:
            await set_document("agent_logs", log_id, doc)


async def seed_firestore(dry_run: bool) -> None:
    clinic = await get_document("clinics", CLINIC_ID)
    if not clinic:
        raise SystemExit(
            f"Clinic '{CLINIC_ID}' not found in Firestore. "
            "Set SEED_CLINIC_ID to the target clinic before seeding."
        )
    print(f"  clinic: {clinic.get('name')} — {clinic.get('doctor_name')}")

    patient = build_patient()
    print(f"  patient: {patient['name']} ({PATIENT_ID}) — {len(VISITS)} visits")
    if not dry_run:
        await set_document("patients", PATIENT_ID, patient)

    for visit, when in zip(VISITS, VISIT_DATES):
        appt = build_appointment(visit, when)
        cons = build_consultation(visit, when)
        print(
            f"    visit {visit['index']}: {_date_str(when)} — {visit['complaint']} "
            f"[{cons['status']}, {len(visit['medications'])} med(s), "
            f"{len(visit['investigations'])} investigation(s)]"
        )
        if not dry_run:
            await set_document("appointments", appt["appointment_id"], appt)
            await set_document("consultations", cons["consultation_id"], cons)


async def seed_invoices(dry_run: bool) -> None:
    """Historical, already-paid invoices dated to their visit, not to today."""
    from sqlalchemy import select
    from database.postgres import AsyncSessionFactory
    from models.billing import Invoice
    from models.clinic import Clinic

    async with AsyncSessionFactory() as db:
        res = await db.execute(select(Clinic).where(Clinic.firebase_clinic_id == CLINIC_ID))
        clinic_row = res.scalar_one_or_none()
        if clinic_row is None:
            print("  ! clinic row absent from Cloud SQL — skipping invoices")
            return

        for visit, when in zip(VISITS, VISIT_DATES):
            pricing = calculate_consultation_fee(
                consultation_type=visit["consultation_type"],
                clinic_fees=None,
                medication_count=len(visit["medications"]),
                investigation_count=len(visit["investigations"]),
            )
            amount_paise = pricing["total_paise"]
            invoice_number = f"INV-LP-{visit['index']:03d}"
            paid_at = when + timedelta(minutes=35)

            existing = (await db.execute(
                select(Invoice).where(Invoice.invoice_number == invoice_number)
            )).scalar_one_or_none()

            fields = dict(
                clinic_id=clinic_row.id,
                patient_phone_masked=PHONE_MASKED,
                patient_id=PATIENT_ID,
                consultation_firestore_id=f"cons_lp_v{visit['index']}",
                amount_paise=amount_paise,
                consultation_type=visit["consultation_type"],
                status="paid",
                payment_method="cash",
                created_at=when + timedelta(minutes=25),
                paid_at=paid_at,
            )

            print(
                f"    invoice {invoice_number}: ₹{amount_paise / 100:.2f} paid "
                f"{_date_str(paid_at)} (created_at back-dated — excluded from today's total)"
            )
            if dry_run:
                continue

            if existing:
                for key, value in fields.items():
                    setattr(existing, key, value)
            else:
                db.add(Invoice(
                    id=uuid.uuid5(uuid.NAMESPACE_URL, f"vaidyaai/invoice/{invoice_number}"),
                    invoice_number=invoice_number,
                    **fields,
                ))
        if not dry_run:
            await db.commit()


async def purge_other_invoices(dry_run: bool) -> None:
    """Drop invoices that do not belong to the demonstration patient."""
    from sqlalchemy import select
    from database.postgres import AsyncSessionFactory
    from models.billing import Invoice
    from models.clinic import Clinic

    async with AsyncSessionFactory() as db:
        res = await db.execute(select(Clinic).where(Clinic.firebase_clinic_id == CLINIC_ID))
        clinic_row = res.scalar_one_or_none()
        if clinic_row is None:
            return
        rows = (await db.execute(
            select(Invoice).where(Invoice.clinic_id == clinic_row.id)
        )).scalars().all()
        stale = [r for r in rows if r.patient_id != PATIENT_ID]
        for row in stale:
            print(f"    removing invoice {row.invoice_number} (patient {row.patient_id})")
            if not dry_run:
                await db.delete(row)
        if not stale:
            print("    no foreign invoices present")
        if not dry_run:
            await db.commit()


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="print without writing")
    args = parser.parse_args()

    mode = "DRY RUN — nothing will be written" if args.dry_run else "WRITING"
    print(f"\nSeeding demonstration patient into clinic {CLINIC_ID}  [{mode}]\n")

    print("Purge (every patient except the demonstration record):")
    await purge_other_patients(args.dry_run)

    print("\nFirestore:")
    await seed_firestore(args.dry_run)
    print("  referrals:")
    await seed_referrals(args.dry_run)
    print("  retention outreach:")
    await seed_retention_outreach(args.dry_run)
    print("  agent decision logs:")
    await seed_agent_logs(args.dry_run)

    print("\nCloud SQL:")
    await seed_invoices(args.dry_run)
    await purge_other_invoices(args.dry_run)

    print("\nDone." if not args.dry_run else "\nDry run complete.")


if __name__ == "__main__":
    asyncio.run(main())
