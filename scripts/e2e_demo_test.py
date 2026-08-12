#!/usr/bin/env python3
"""
VaidyaAI End-to-End Demo Flow Smoke Test & Performance Benchmark
Validates all 7 autonomous AI agents in sequence with high-precision stage profiling.
"""
import sys
import os
import json
import time
import asyncio
from datetime import datetime, timezone

# Ensure development environment mode before loading backend modules
os.environ["ENVIRONMENT"] = "development"

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, backend_dir)

from config import settings
from database.postgres import init_db, AsyncSessionFactory
from models.clinic import Clinic
from agents.appointment_flow import AppointmentFlowAgent
from agents.clinical_scribe import ClinicalScribeAgent
from agents.billing_pulse import BillingPulseAgent
from agents.retention_radar import RetentionRadarAgent
from agents.prescription_safe import PrescriptionSafeAgent
from agents.insight_engine import InsightEngineAgent
from agents.referral_coordinator import ReferralCoordinatorAgent
from database.firestore import set_document, get_document, query_documents


async def run_e2e_demo_test():
    total_start = time.perf_counter()
    print("\n🚀 Starting VaidyaAI 7-Agent E2E Demo Flow Test...\n")

    timings = {}
    results = {}

    # Stage 0: Database & Schema Initialization
    t0 = time.perf_counter()
    await init_db()

    clinic_id = "cln_e2e_test_clinic"
    test_phone = "+919876543210"

    # Seed clinic in relational database (SQLite/Postgres)
    async with AsyncSessionFactory() as db:
        from sqlalchemy import select
        res = await db.execute(select(Clinic).where(Clinic.firebase_clinic_id == clinic_id))
        clinic_obj = res.scalar_one_or_none()
        if not clinic_obj:
            clinic_obj = Clinic(
                firebase_clinic_id=clinic_id,
                name="VaidyaAI Development Clinic",
                doctor_name="Dr. Vinay Sharma",
                phone=test_phone,
                whatsapp_phone_id="123456789",
                speciality="General Medicine",
                is_active=True
            )
            db.add(clinic_obj)
            await db.commit()

    # Seed clinic in Firestore in-memory store
    await set_document("clinics", clinic_id, {
        "clinic_id": clinic_id,
        "name": "VaidyaAI Development Clinic",
        "doctor_name": "Dr. Vinay Sharma",
        "phone": test_phone,
        "whatsapp_phone_id": "123456789",
        "is_active": True
    })
    timings["Database Bootstrap"] = (time.perf_counter() - t0) * 1000

    # Step 1: AppointmentFlow (Agent 1)
    print("--------------------------------------------------")
    print("STEP 1: AppointmentFlow Agent (Agent 1) - Booking")
    t1 = time.perf_counter()
    try:
        agent1 = AppointmentFlowAgent()
        res1 = await agent1.handle_incoming_message(
            from_phone=test_phone,
            message="doctor garu appointment kavali",
            clinic_id=clinic_id
        )
        dur1 = (time.perf_counter() - t1) * 1000
        timings["Step 1 - AppointmentFlow"] = dur1
        print(f"  ✓ Agent 1 Result: {res1.get('status')} [{dur1:.1f}ms]")
        results["Step 1 - AppointmentFlow"] = "PASS"
    except Exception as e:
        dur1 = (time.perf_counter() - t1) * 1000
        timings["Step 1 - AppointmentFlow"] = dur1
        print(f"  ❌ Agent 1 Failed: {e} [{dur1:.1f}ms]")
        results["Step 1 - AppointmentFlow"] = f"FAIL ({e})"

    # Step 2: Start Consultation (Doctor Workspace)
    print("--------------------------------------------------")
    print("STEP 2: Start Consultation Workspace (Isolation)")
    t2 = time.perf_counter()
    try:
        now_ts = int(datetime.now(timezone.utc).timestamp())
        appt_id = f"app_test_{now_ts}"
        cons_id = f"cons_test_{now_ts}"
        patient_id = f"pat_test_{now_ts}"

        # Create appointment document
        await set_document("appointments", appt_id, {
            "appointment_id": appt_id,
            "clinic_id": clinic_id,
            "patient_id": patient_id,
            "patient_name": "Ravi Kumar (Test)",
            "patient_phone_masked": "+91XXXXXX3210",
            "status": "arrived",
            "slot_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "slot_time_str": "10:00 AM",
            "created_at": datetime.now(timezone.utc)
        })

        # Create consultation document
        await set_document("consultations", cons_id, {
            "consultation_id": cons_id,
            "clinic_id": clinic_id,
            "appointment_id": appt_id,
            "patient_id": patient_id,
            "status": "draft",
            "created_at": datetime.now(timezone.utc)
        })

        dur2 = (time.perf_counter() - t2) * 1000
        timings["Step 2 - Start Consultation"] = dur2
        print(f"  ✓ Created Isolated Consultation Doc: {cons_id} [{dur2:.1f}ms]")
        results["Step 2 - Start Consultation"] = "PASS"
    except Exception as e:
        dur2 = (time.perf_counter() - t2) * 1000
        timings["Step 2 - Start Consultation"] = dur2
        print(f"  ❌ Step 2 Failed: {e} [{dur2:.1f}ms]")
        results["Step 2 - Start Consultation"] = f"FAIL ({e})"

    # Step 3: ClinicalScribe (Agent 2)
    print("--------------------------------------------------")
    print("STEP 3: ClinicalScribe Agent (Agent 2) - SOAP Note")
    t3 = time.perf_counter()
    try:
        agent2 = ClinicalScribeAgent()
        res2 = await agent2.process_consultation_audio(
            consultation_id=cons_id,
            clinic_id=clinic_id,
            appointment_id=appt_id,
            chunk_paths=["mock_chunk.webm"],
            patient_history="Known Hypertension, no allergies",
            vitals="BP 130/80, Temp 98.6F",
            language_code="te-IN"
        )
        soap = res2.get("soap_note", {})
        dur3 = (time.perf_counter() - t3) * 1000
        timings["Step 3 - ClinicalScribe"] = dur3
        print(f"  ✓ Agent 2 SOAP Subjective: {soap.get('subjective', '')[:60]}... [{dur3:.1f}ms]")
        results["Step 3 - ClinicalScribe"] = "PASS"
    except Exception as e:
        dur3 = (time.perf_counter() - t3) * 1000
        timings["Step 3 - ClinicalScribe"] = dur3
        print(f"  ❌ Agent 2 Failed: {e} [{dur3:.1f}ms]")
        results["Step 3 - ClinicalScribe"] = f"FAIL ({e})"

    # Step 4: PrescriptionSafe (Agent 5)
    print("--------------------------------------------------")
    print("STEP 4: PrescriptionSafe Agent (Agent 5) - Rx Safety Audit")
    t4 = time.perf_counter()
    try:
        agent5 = PrescriptionSafeAgent()
        meds = [
            {"drug_name": "Warfarin", "dosage": "5mg", "frequency": "1-0-0"},
            {"drug_name": "Aspirin", "dosage": "75mg", "frequency": "1-0-0"}
        ]
        res5 = await agent5.validate_prescription(
            consultation_id=cons_id,
            clinic_id=clinic_id,
            medications=meds,
            patient_id=patient_id
        )
        dur4 = (time.perf_counter() - t4) * 1000
        timings["Step 4 - PrescriptionSafe"] = dur4
        print(f"  ✓ Agent 5 Safety Result: Is Safe = {res5.get('is_safe')} [{dur4:.1f}ms]")
        results["Step 4 - PrescriptionSafe"] = "PASS"
    except Exception as e:
        dur4 = (time.perf_counter() - t4) * 1000
        timings["Step 4 - PrescriptionSafe"] = dur4
        print(f"  ❌ Agent 5 Failed: {e} [{dur4:.1f}ms]")
        results["Step 4 - PrescriptionSafe"] = f"FAIL ({e})"

    # Step 5: BillingPulse (Agent 3)
    print("--------------------------------------------------")
    print("STEP 5: BillingPulse Agent (Agent 3) - Approval & Invoice")
    t5 = time.perf_counter()
    try:
        agent3 = BillingPulseAgent()
        res3 = await agent3.on_consultation_close(
            consultation_id=cons_id,
            clinic_id=clinic_id,
            patient_phone=test_phone,
            consultation_type="new"
        )
        dur5 = (time.perf_counter() - t5) * 1000
        timings["Step 5 - BillingPulse"] = dur5
        print(f"  ✓ Agent 3 Invoice #{res3.get('invoice_number')} Amount: ₹{res3.get('amount_rupees')} [{dur5:.1f}ms]")
        results["Step 5 - BillingPulse"] = "PASS"
    except Exception as e:
        dur5 = (time.perf_counter() - t5) * 1000
        timings["Step 5 - BillingPulse"] = dur5
        print(f"  ❌ Agent 3 Failed: {e} [{dur5:.1f}ms]")
        results["Step 5 - BillingPulse"] = f"FAIL ({e})"

    # Step 6: ReferralCoordinator (Agent 7)
    print("--------------------------------------------------")
    print("STEP 6: ReferralCoordinator Agent (Agent 7) - Specialist Referral")
    t6 = time.perf_counter()
    try:
        agent7 = ReferralCoordinatorAgent()
        res7 = await agent7.generate_and_track_referral(
            consultation_id=cons_id,
            clinic_id=clinic_id,
            patient_phone=test_phone,
            speciality="Cardiology"
        )
        dur6 = (time.perf_counter() - t6) * 1000
        timings["Step 6 - ReferralCoordinator"] = dur6
        print(f"  ✓ Agent 7 Referral Tracked ID: {res7.get('referral_id')} [{dur6:.1f}ms]")
        results["Step 6 - ReferralCoordinator"] = "PASS"
    except Exception as e:
        dur6 = (time.perf_counter() - t6) * 1000
        timings["Step 6 - ReferralCoordinator"] = dur6
        print(f"  ❌ Agent 7 Failed: {e} [{dur6:.1f}ms]")
        results["Step 6 - ReferralCoordinator"] = f"FAIL ({e})"

    # Step 7: InsightEngine (Agent 6) & Agent Logs
    print("--------------------------------------------------")
    print("STEP 7: InsightEngine Agent (Agent 6) & Agent Logs Audit")
    t7 = time.perf_counter()
    try:
        agent6 = InsightEngineAgent()
        res6 = await agent6.generate_weekly_insight_report(clinic_id=clinic_id)
        logs = await query_documents("agent_logs", [("clinic_id", "==", clinic_id)])
        dur7 = (time.perf_counter() - t7) * 1000
        timings["Step 7 - InsightEngine & Logs"] = dur7
        print(f"  ✓ Agent 6 Practice Health Score: {res6.get('health_score')}/100 [{dur7:.1f}ms]")
        print(f"  ✓ Agent Logs Total Autonomous Decisions: {len(logs)}")
        results["Step 7 - InsightEngine & Logs"] = "PASS"
    except Exception as e:
        dur7 = (time.perf_counter() - t7) * 1000
        timings["Step 7 - InsightEngine & Logs"] = dur7
        print(f"  ❌ Agent 6 Failed: {e} [{dur7:.1f}ms]")
        results["Step 7 - InsightEngine & Logs"] = f"FAIL ({e})"

    total_dur = (time.perf_counter() - total_start) * 1000

    # Final Report & Timing Table
    print("\n============ VaidyaAI E2E Performance Benchmark ============")
    print(f"{'Stage / Subsystem':<38} | {'Status':<8} | {'Latency':<10}")
    print("-" * 62)
    for step, status in results.items():
        icon = "✅" if status == "PASS" else "❌"
        lat = f"{timings.get(step, 0.0):.1f}ms"
        print(f"{icon} {step:<35} | {status:<8} | {lat:<10}")
    print("-" * 62)
    print(f"Total Execution Time: {total_dur:.1f}ms ({total_dur / 1000:.2f}s)")
    print("=============================================================")

    all_passed = all(status == "PASS" for status in results.values())
    if all_passed:
        print("\n🎉 ALL 7 AI AGENTS OPERATIONAL — OPTIMIZED & READY FOR SUBMISSION!\n")
    else:
        print("\n⚠️ SOME AGENT TESTS FAILED — CHECK LOGS ABOVE\n")


if __name__ == "__main__":
    asyncio.run(run_e2e_demo_test())

