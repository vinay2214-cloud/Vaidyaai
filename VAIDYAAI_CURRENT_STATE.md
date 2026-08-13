# VaidyaAI — Current State Repository Forensic Analysis

**Audit Date:** August 13, 2026  
**Auditor:** Senior Principal Clinical Informatics & Release Engineer  
**Repository:** `vinay2214-cloud/Vaidyaai`  
**Target Environment:** Google Cloud Platform (`asia-south1` / `us-central1`)  

---

## 1. Frontend Route & Component Mapping

| Route | File Path | Status | Capabilities & Responsibilities |
|---|---|---|---|
| `/` | `frontend/src/app/(dashboard)/page.tsx` | Active | Doctor dashboard, Today's queue, AI workforce status pills, KPI counters. |
| `/login` | `frontend/src/app/(auth)/login/page.tsx` | Active | Firebase Phone Auth OTP with Development Auth Bypass flag (`NEXT_PUBLIC_DEV_AUTH_BYPASS`). |
| `/patients` | `frontend/src/app/(dashboard)/patients/page.tsx` | Active | Patient intelligence center, phone/name search, allergy alert indicators. |
| `/patients/[id]` | `frontend/src/app/(dashboard)/patients/[id]/page.tsx` | Active | Longitudinal patient profile, truthful vitals card (zero fabrication), clinical timeline, audit trail. |
| `/consultation` | `frontend/src/app/(dashboard)/consultation/page.tsx` | Active | Active consultation selector & pre-flight readiness redirect. |
| `/consultation/[id]` | `frontend/src/app/(dashboard)/consultation/[id]/page.tsx` | Active | Consultation Workspace: ambient recorder, transcript diarization, SOAP editor, PrescriptionSafe gates, approval, billing invoice issuance. |
| `/billing` | `frontend/src/app/(dashboard)/billing/page.tsx` | Active | BillingPulse dashboard, today's revenue breakdown, invoice list, multi-channel payment reconciliation (Cash, Card POS, UPI QR). |
| `/logs` | `frontend/src/app/(dashboard)/logs/page.tsx` | Active | Compliance audit logs, chronological multi-agent decision stream, CSV/JSON evidence export. |
| `/analytics` | `frontend/src/app/(dashboard)/analytics/page.tsx` | Active | InsightEngine practice intelligence, diagnosis trends, revenue trajectory. |
| `/settings` | `frontend/src/app/(dashboard)/settings/page.tsx` | Active | Clinic profile, doctor credentials, fee schedule, webhook secrets. |

---

## 2. Backend API Router & Contract Mapping

| Route Prefix | File Path | Key Endpoints | Contract Integrity |
|---|---|---|---|
| `/api/v1/auth` | `backend/api/auth.py` | `GET /me`, `POST /session` | Strict token verification, tenant extraction, dev bypass rejection in production. |
| `/api/v1/clinics` | `backend/api/clinics.py` | `GET /clinics/{id}`, `POST /clinics` | UUID-based clinic ID generator (`cln_{uuid4}`), tenant profile management. |
| `/api/v1/patients` | `backend/api/patients.py` | `GET /patients`, `GET /patients/{id}`, `POST /patients/register`, `GET /patients/{id}/timeline` | Deterministic patient resolver (`pat_{normalized_phone}`), zero vitals fabrication. |
| `/api/v1/appointments` | `backend/api/appointments.py` | `GET /appointments/today`, `POST /appointments/walk-in` | Queue ordering, visit categorization, doctor schedule coordination. |
| `/api/v1/consultations` | `backend/api/consultations.py` | `POST /consultations/start`, `POST /consultations/upload-chunk`, `POST /consultations/transcribe`, `POST /consultations/{id}/safety-check`, `POST /consultations/{id}/approve`, `GET /consultations/{id}/pdf`, `GET /consultations/{id}/activity`, `GET /consultations/patient-summary/{patient_id}`, `GET /consultations/{id}/fhir` | Complete clinical scribe workflow, ambient audio chunk stitching, fail-closed safety gate. |
| `/api/v1/fhir` | `backend/api/fhir.py` | `GET /fhir/metadata`, `GET /fhir/Patient/{id}`, `GET /fhir/Encounter/{id}`, `GET /fhir/Patient/{id}/summary`, `GET /fhir/Organization/{id}` | FHIR R4 Bundle generator, International Patient Summary (IPS) export. |
| `/api/v1/billing` | `backend/api/billing.py` | `GET /billing/today`, `POST /billing/create-invoice`, `POST /billing/reconcile` | Two-tier billing safety gate, immutable invoice records. |
| `/api/v1/agent-health` | `backend/api/agent_health.py` | `GET /agents/health`, `GET /ai/live-status` | Telemetry probe, model latencies, SLA tracking. |
| `/api/v1/webhooks` | `backend/api/webhooks.py` | `POST /webhooks/whatsapp`, `POST /webhooks/razorpay` | HMAC-SHA256 signature verification for automated payment & notification ingestion. |

---

## 3. Storage Layer & Dual-Store Topology

1. **Relational Database (PostgreSQL / SQLite Dev Fallback):**
   - Tables: `clinics`, `invoices`, `subscriptions`, `daily_pl_summary`, `retention_outreach`, `referral_tracking`.
   - Managed via SQLAlchemy 2.0 async engine with auto-migrations on startup.
2. **Document Store (Google Cloud Firestore / In-Memory Dev Fallback):**
   - Collections: `clinics`, `clinic_users`, `patients`, `appointments`, `consultations`, `agent_logs`, `referrals`.
   - Guaranteed tenant scoping on all queries: `[("clinic_id", "==", clinic_id)]`.

---

## 4. Multi-Agent Ecosystem Status

| Agent Name | Module Path | Primary Model / Engine | Bound Responsibility | Provenance & Audit |
|---|---|---|---|---|
| **AppointmentFlow** | `agents/appointment_flow.py` | `gemini-2.5-flash` (`asia-south1`) | Walk-in registration, slot scheduling, patient intent normalization. | Emits to `agent_logs` with latency and masked phone. |
| **ClinicalScribe** | `agents/clinical_scribe.py` | `gemini-2.5-pro` (`us-central1`) + Cloud STT | Ambient audio chunk stitching (FFmpeg), speaker diarization, SOAP draft generation, ICD-10 extraction. | Embeds provenance metadata: `model_used`, `evidence_span`, `grounding_validated`. |
| **PrescriptionSafe** | `agents/prescription_safe.py` | Deterministic Matrix + `gemini-2.5-pro` | Allergen conflict detection, drug-drug interactions, dosage validation, hard-stop enforcement. | Emits `drug_safety_evaluated` / `drug_safety_allergen_blocked` events. |
| **BillingPulse** | `agents/billing_pulse.py` | `gemini-2.5-flash` (`asia-south1`) | Two-tier safety gated invoice generation, UPI QR generation, payment reconciliation. | Emits `payment_link_sent` / `payment_reconciled`. |
| **RetentionRadar** | `agents/retention_radar.py` | `gemini-2.5-flash` (`asia-south1`) | Chronic care recall, post-consultation follow-up scheduling, care gap alerts. | Emits `retention_outreach` records. |
| **InsightEngine** | `agents/insight_engine.py` | `gemini-2.5-flash` (`asia-south1`) | Practice revenue analytics, disease surveillance trends. | Emits `practice_summary_generated`. |
| **ReferralCoordinator** | `agents/referral_coordinator.py` | `gemini-2.5-flash` (`asia-south1`) | Specialist referral letter drafting, WhatsApp communication tracking. | Emits `referral_generated`. |

---

## 5. Current Verified Test Metrics

- **Backend Pytest Suite:** 137 / 137 passing (100%)
- **Speech-to-Text Regression:** 8 / 8 passing (100%)
- **Live Vertex AI Telemetry:** `gemini-2.5-pro` (5371ms) & `gemini-2.5-flash` (1283ms) verified
- **Patient Identity Invariant:** Verified with 0 drift across 6 entities
- **PrescriptionSafe Hard-Stop:** Verified blocking Amoxicillin on Penicillin allergy
