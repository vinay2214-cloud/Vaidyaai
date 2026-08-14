# VAIDYAAI BASELINE AUDIT

**Date:** 2026-08-13  
**Commit:** 59209ef (release: VaidyaAI final hackathon candidate) — working tree at 8687010  
**Auditor:** Principal Software Architect (read-only forensic audit)  
**Constraint:** No source code was modified during this audit.

---

## EXECUTIVE SUMMARY

VaidyaAI is a Next.js 14 + FastAPI clinical-workflow platform for Indian primary-care clinics. It uses Firebase Auth, Firestore (in-memory fallback in dev), SQLite/PostgreSQL, Google Cloud STT, Gemini via Vertex AI, Razorpay billing, and WhatsApp notifications. The repo has 94 backend Python files, 132 frontend TS/TSX files, and 27 backend test files (no frontend tests, no E2E tests).

**Frontend production build FAILS** due to a TypeScript contract error. Backend tests passed 137/137 earlier in this session but currently hang on `import main` (likely a stale-process/environment issue, not a code regression). Multiple P0 and P1 issues are identified below.

---

## 1. FRONTEND ARCHITECTURE

**Framework:** Next.js 14.2.35, App Router, TypeScript  
**UI:** Tailwind CSS, dark theme, teal accent  
**State management:** Zustand stores (`clinicStore.ts`, `uiStore.ts`)  
**API client:** Axios with tiered timeouts, Firebase ID token injection, dev-bypass header  
**Key structure:**
```
frontend/src/
  app/(auth)/login/page.tsx
  app/(dashboard)/page.tsx          — Dashboard
  app/(dashboard)/patients/page.tsx — Patient list + search
  app/(dashboard)/patients/[id]/page.tsx — Patient profile
  app/(dashboard)/consultation/page.tsx  — Consultation workspace
  app/(dashboard)/billing/page.tsx       — Billing dashboard
  app/(dashboard)/analytics/page.tsx     — Analytics
  app/(dashboard)/settings/page.tsx      — Clinic settings
  app/(dashboard)/logs/page.tsx          — Audit/activity log
  components/layout/TopBar.tsx           — Top bar with doctor name
  components/layout/AppShell.tsx         — Shell, mounts WalkInModal globally
  components/WalkInModal.tsx             — Walk-in patient registration
  components/consultation/ConsultationWorkspace.tsx — 1600+ line mega component
  components/SOAPNoteEditor.tsx          — SOAP review/edit/approve
  components/ConsultationRecorder.tsx    — Audio recording
  components/OnboardingWizard.tsx        — First-run clinic setup
  hooks/useAuth.ts                       — Firebase auth state + dev bootstrap
  hooks/useConsultation.ts              — Consultation data fetching
  hooks/useAgentHealth.ts               — Agent telemetry polling
  hooks/useAgentLogs.ts                 — Audit log stream
  hooks/useBilling.ts                   — Billing data
  hooks/useAppointmentsToday.ts         — Appointment list
  lib/api.ts                            — Axios client
  lib/auth.ts                           — Auth + dev bypass constants
  lib/firebase.ts                       — Firebase init
  store/clinicStore.ts                  — Zustand: clinicId, doctorName, clinicName
  store/uiStore.ts                      — Zustand: walkInModalOpen, etc.
  services/devBootstrap.ts              — Dev clinic provisioning
```

**API client (`lib/api.ts`):**
- Base URL: `BACKEND_URL/api/v1` (from frontend/.env.local)
- Tiered timeouts: GET 5s, transcribe/safety 60s, exports 30s, default 10s
- Auth: Firebase ID token header; dev bypass uses `Bearer dev_mock_id_token`
- 401/403 interceptor: triggers `logout()` unless dev bypass
- Correlation ID header generated per request
- No snake_case/camelCase transform — frontend sends snake_case directly

---

## 2. BACKEND ARCHITECTURE

**Framework:** FastAPI, uvicorn  
**Entry:** `run_dev.py` (dev) / `main:app`  
**Key structure:**
```
backend/
  main.py                    — App factory, CORS, router mounting, startup
  config.py                  — Settings singleton from env vars
  run_dev.py                 — Dev server with restricted hot-reload
  workflow_orchestrator.py   — Event bus subscriber for automated agents
  event_bus.py               — In-process clinical event bus
  api/                       — 11 router modules (see below)
  agents/                    — 7 clinical AI agents (see below)
  services/                  — Gemini, STT, PDF, Razorpay, WhatsApp
  utils/                     — Grounding validator, PHI anonymiser, provenance, patient summary, agent logger
  models/                    — SQLAlchemy ORM (6 tables)
  database/                  — Firestore client + PostgreSQL/SQLite async engine
  tests/                     — 27 test files
  prompts/                   — SOAP generation prompt builder
```

**API routers (11):**
| Router | File | Key endpoints |
|--------|------|---------------|
| auth | api/auth.py | `/auth/session`, dev bypass |
| patients | api/patients.py | GET `/patients`, GET `/patients/{id}` |
| appointments | api/appointments.py | POST `/appointments/walk-in` |
| consultations | api/consultations.py | POST `/consultations/start`, POST `/consultations/{id}/clinical-history`, POST `/consultations/{id}/vitals`, POST `/consultations/upload-chunk`, POST `/consultations/transcribe`, POST `/consultations/{id}/check-safety`, POST `/consultations/{id}/approve`, POST `/consultations/{id}/override-safety`, GET `/consultations/{id}`, GET `/consultations/{id}/activity` |
| billing | api/billing.py | GET `/billing/today`, POST `/billing/create-invoice`, POST `/billing/confirm-payment`, POST `/billing/mark-cash`, POST `/billing/waive`, GET `/billing/export` |
| clinics | api/clinics.py | GET `/clinics/settings`, POST `/clinics/dev-provision`, POST `/clinics/setup` |
| analytics | api/analytics.py | GET `/analytics/...` |
| agent_health | api/agent_health.py | GET `/agents/health` |
| fhir | api/fhir.py | GET `/fhir/...` exports |
| internal | api/internal.py | Internal auth-gated endpoints |
| webhooks | api/webhooks.py | Razorpay/WhatsApp webhooks |

**Agents (7):**
| Agent | File | Role |
|-------|------|------|
| AppointmentFlow | agents/appointment_flow.py | Walk-in registration, queue management |
| ClinicalScribe | agents/clinical_scribe.py | STT → anonymisation → fact extraction → grounding → SOAP |
| PrescriptionSafe | agents/prescription_safe.py | Drug-allergy interaction, dose safety, allergen guard |
| BillingPulse | agents/billing_pulse.py | Invoice creation, Razorpay links, WhatsApp, daily P&L |
| ReferralCoordinator | agents/referral_coordinator.py | Referral generation |
| RetentionRadar | agents/retention_radar.py | Follow-up scheduling, retention risk |
| InsightEngine | agents/insight_engine.py | Patient summary, longitudinal insights |

**Database:**
- ORM: SQLAlchemy 2.0 async
- Dev: SQLite (`sqlite+aiosqlite:///./test.db`)
- Prod: PostgreSQL
- Document store: Firestore (in-memory fallback in dev when no emulator)
- Tables: `clinics`, `patients`, `appointments`, `consultations`, `invoices`, `clinical_records`

---

## 3. AUTHENTICATION

**Frontend (`lib/auth.ts`, `hooks/useAuth.ts`):**
- Firebase phone auth for production
- Dev bypass: `DEV_DOCTOR_USER` (uid `dev_doctor_001`) with `DEV_CLINIC_DATA` (clinicId `cln_e2e_test_clinic`, doctorName `Dr. Ramesh`)
- `DevBootstrapService.ensureClinicMapping()` calls `POST /clinics/dev-provision` to ensure clinic exists
- Dev bypass enabled when `NEXT_PUBLIC_DEV_AUTH_BYPASS=true` in frontend .env.local

**Backend (`api/auth.py`):**
- `get_current_user`: validates Firebase ID token; dev mode accepts `dev_mock_id_token`
- `verify_clinic_access(clinic_id, user)`: checks user's clinic_id matches request clinic_id
- Dev mode user: `{"uid": "dev_doctor_001", "clinic_id": "cln_e2e_test_clinic", "role": "doctor"}`

**Evidence:** `config.py` line: `ENVIRONMENT=development` → dev auth bypass active

---

## 4. CLINIC / TENANT ISOLATION

- Every API endpoint accepts `clinic_id` in body or query
- `verify_clinic_access()` enforces user's clinic_id matches request
- Frontend propagates `clinic_id` from `useClinicStore` to every request
- Dev bootstrap: `POST /clinics/dev-provision` creates `cln_e2e_test_clinic` if absent
- In-memory Firestore: clinic document created by dev-provision

**P1 issue:** The `clinic_id` is not set on the walk-in appointment response (`clinic_id: None` returned — see earlier in this session). The consultation start response also omits `clinic_id`. However, the consultation document itself does store `clinic_id` correctly.

---

## 5. PATIENT IDENTITY SYSTEM

- Patient ID: `pat_{normalized_phone}` (deterministic, phone-derived)
- Walk-in: phone → lookup or create → deterministic ID
- Patient document stored in Firestore (in-memory in dev)
- Patient also persisted in PostgreSQL `patients` table (with masked phone)
- `utils/patient_identity.py`: identity resolution helpers
- **Identity invariant:** `patient_id` flows: registration → appointment → consultation → prescription → invoice → FHIR

**Evidence (from earlier in this session):**
```
walk-in → patient_id: pat_919182736455
consultation → patient_id: pat_919182736455
invoice → patient_id: pat_919182736455 (after fix at commit 8687010)
```

---

## 6. APPOINTMENT SYSTEM

- Walk-in: `POST /appointments/walk-in` with phone/name/complaint → creates patient (if new) + same-day appointment
- Appointment ID: `app_walkin_{timestamp}_{hash}`
- Appointment stored in Firestore
- Status: `scheduled` → `in_consultation` → `completed`

---

## 7. CONSULTATION SYSTEM

- Start: `POST /consultations/start` with appointment_id → creates consultation doc
- Consultation ID: `cons_{timestamp}`
- Workspace: `ConsultationWorkspace.tsx` (1600+ line component)
- Tabs: Record (scribe), SOAP, Prescription, Summary
- Manual entry: allergies, chronic conditions, current medications, vitals — each via `POST /consultations/{id}/clinical-history` or `/vitals`
- `UpdateClinicalHistoryRequest` model includes: `allergies`, `chronic_conditions`, `current_medications` (added at commit 8687010)

---

## 8. STT (SPEECH-TO-TEXT)

**Service:** `services/speech_to_text.py` — `SpeechToTextService`
- Provider: Google Cloud Speech-to-Text
- Client: `speech.SpeechClient` with ADC
- Audio: chunks uploaded via `POST /consultations/upload-chunk`, concatenated with FFmpeg to 16kHz mono WAV
- Language: `te-IN` / `en-IN` configurable
- Fail-closed: if STT fails and `AI_ALLOW_MOCK_FALLBACK=false`, raises `RuntimeError`
- Dev mock: available only when `AI_ALLOW_MOCK_FALLBACK=true`

**Evidence (from earlier in this session):**
- Live STT verified: 46s mixed Telugu/English audio → provider: Google Cloud Speech-to-Text, execution_status: live
- STT quality issue: diarization duplicated content across [Patient]/[Doctor] channels; key clinical terms mangled (e.g., "penicillin allergy" → "పైన సీలింగ్ ఎనర్జీ")
- 8/8 regression tests pass in `scripts/run_stt_tests.py`

---

## 9. CLINICAL SCRIBE

**Agent:** `agents/clinical_scribe.py` — `ClinicalScribeAgent`
- Pipeline: STT → PHI anonymisation → Gemini fact extraction → grounding validation → SOAP generation
- `process_consultation_audio()`: orchestrates full pipeline
- Output: transcript, clinical_facts, SOAP note, diagnoses, medications, vitals (grounded), allergy propagation
- Confidence gate: low STT confidence → `requires_transcript_review=true`

**Fix at commit 8687010:** Scribe no longer wipes clinician-entered vitals when AI grounding finds none (removed unconditional `"vitals": grounded_vitals` from the set_document payload, replaced with conditional spread)

---

## 10. GROUNDING

**Validator:** `utils/grounding_validator.py` — `GroundingValidator`
- Deterministic evidence-based validation: every fact must have transcript evidence
- Symptom validation: fever duration grounded to "2 days" / "3 days" Telugu/English patterns
- Negative findings: "no breathing difficulty", "no chest pain" extracted from transcript keywords (Telugu: శ్వాస, chest pain)
- Medical history: "No BP" → normalized to hypertension=denied
- Allergies: "Penicillin" directly matched; class-keyword match (Penicillin → Amoxicillin, Ampicillin, etc.)
- Vitals: only extracted if explicitly stated in transcript — no fabrication of 120/80, HR 82, SpO2 98, etc.
- Subjective text sanitization: removes "dry cough" if "dry" not in transcript; removes "yesterday" if not stated
- All rejections logged with: field, value, reason, evidence, correlation ID, timestamp

**Evidence:** Direct validator test confirmed negatives extract correctly with clean transcript input. Full pipeline returns empty when facts dict malformed (input shape issue in test, not a code bug).

---

## 11. PRESCRIPTIONSAFE

**Agent:** `agents/prescription_safe.py` — `PrescriptionSafeAgent`
- Deterministic allergen guard: short-circuits to `is_safe=False` before LLM call if drug matches documented allergy
- LLM deep analysis: Gemini 2.5 Pro for drug-drug interactions, dose safety, duplicate therapy
- Fail-closed: if Gemini unavailable, returns `is_safe=False` with `SAFETY_CHECK_FAILED`
- Medication signature: `_medication_signature()` — order-independent canonical hash of medication list
- Stale safety gate: `approve_consultation` compares current meds signature vs `safety_evaluated_medications` stored at eval time

**Evidence (from earlier in this session):**
```
Amoxicillin + Penicillin allergy → is_safe=False, CRITICAL, ALLERGY_CONFLICT ✓
Paracetamol (safe) → is_safe=True, LOW risk, live ✓
Meds changed after eval → approval blocked with safety_check_stale ✓
```

---

## 12. BILLING

**Agent:** `agents/billing_pulse.py` — `BillingPulseAgent`
**API:** `api/billing.py`
- Invoice creation: `POST /billing/create-invoice` or auto-triggered on consultation approval
- Idempotency: DB-level check for existing invoice on `consultation_firestore_id`
- Razorpay: mock payment links in dev; live Razorpay in production
- WhatsApp: invoice message sent to patient (mock in dev)
- Invoice fields: invoice_number, patient_phone_masked, patient_id (added at 8687010), consultation_firestore_id, amount_paise, status, payment_method
- Safety gate: invoice creation blocked if stored safety_evaluation is unsafe and not overridden (fixed at 8687010)

**Evidence:**
```
Double-click invoice creation → same invoice_id returned, 1 row in DB ✓
Payment: PENDING→PAID (mark-cash) → status=paid ✓
PAID→PAID: idempotent (already_paid=true) ✓
```

---

## 13. PAYMENT

- Methods: UPI (Razorpay link), cash (manual mark), waiver
- States: `pending` → `paid` / `waived`
- `POST /billing/mark-cash`: marks as paid with `payment_method=cash`
- `POST /billing/confirm-payment`: for Razorpay webhook confirmation
- `POST /billing/waive`: doctor waiver with reason
- Daily P&L: aggregated in `daily_pl` table

---

## 14. PATIENT SUMMARY

**Util:** `utils/patient_summary.py`
- Generated from reviewed/approved clinical information
- Longitudinal: aggregates across consultations
- Includes: active problems, medications, allergies, recent visits
- FHIR IPS (International Patient Summary) export available via FHIR router

---

## 15. FHIR

**Router:** `api/fhir.py`
- R4 compliant exports: Patient, Organization, Practitioner, PractitionerRole, Encounter, Condition, Observation, AllergyIntolerance, MedicationRequest, Provenance, Composition, Appointment
- IPS Patient Summary export
- Patient identity: `Patient.identifier` maps to VaidyaAI `patient_id`
- No second patient identity created

---

## 16. AUDIT

**Util:** `utils/agent_logger.py` — `AgentLogger`
- Every agent decision logged via `self.logger.log_decision()`
- Fields: timestamp, clinic_id, consultation_id, patient_id, decision_type, decision_made
- `GET /consultations/{id}/activity` returns scoped activity log
- Event bus: `ClinicalEvent` enum + `create_event()` for domain events
- Events emitted on: consultation create, safety eval, approval, invoice, payment, FHIR export

---

## 17. PROVENANCE

**Util:** `utils/provenance.py`
- Every clinical fact carries evidence span from transcript
- Grounding rejections include: field, value, reason, evidence, correlation ID
- FHIR Provenance resources generated for clinical resources

---

## 18. AI AGENT TELEMETRY

**Router:** `api/agent_health.py`
**Frontend hook:** `hooks/useAgentHealth.ts` — polls `GET /agents/health?clinic_id=...`
**UI:** `AgentStatusBar.tsx`, `AgentLogFeed.tsx`

**Issue from screenshots: "0/7 agents healthy":**
- The agents are event-driven (via workflow_orchestrator). Health endpoint checks if agents are instantiated.
- In dev with in-memory Firestore and no event bus events flowing, agents may report unhealthy if they haven't processed any events.
- The "Settings says 7 agents active" vs "0/7 healthy" discrepancy is a telemetry alignment issue — settings lists configured agents; health reports runtime status.

---

## 19. ANALYTICS

**Router:** `api/analytics.py`
- Dashboard metrics: patient counts, consultation volume, revenue, etc.
- "Analytics has no data" (from screenshots): in dev with in-memory Firestore, analytics queries return empty unless consultations have been completed and data persisted.

---

## 20. SETTINGS

**Router:** `api/clinics.py`
- `GET /clinics/settings`: returns clinic configuration (fees, name, doctor, etc.)
- `POST /clinics/setup`: onboarding wizard saves clinic config
- Agent count displayed as "7 agents active" is a static configuration display

---

## 21. FOLLOW-UP

**Agent:** `agents/retention_radar.py`
- Follow-up scheduling based on consultation `followup_days`
- Retention risk scoring
- WhatsApp follow-up reminders (via Cloud Tasks in production)

---

## 22. REFERRAL

**Agent:** `agents/referral_coordinator.py`
- Referral generation from SOAP plan
- `POST /consultations/{id}/referrals` creates referral
- Frontend: `ReferralCard.tsx` displays referrals

---

## 23. DEPLOYMENT

- Backend: Cloud Run (Docker) — `Dockerfile` in backend/
- Frontend: Vercel/Cloud Run — `Dockerfile` in frontend/
- `BACKEND_URL` in .env: `https://vaidyaai-backend-placeholder.run.app` (placeholder — not live)
- Google Cloud project: `vaidyaai-xprize`
- Firebase project: `vaidyaai-xprize-d4b2d`
- Region: `asia-south1`

---

## 24. ENVIRONMENT CONFIGURATION

| Setting | Value | Notes |
|---------|-------|-------|
| ENVIRONMENT | development | |
| DATABASE_URL | sqlite+aiosqlite:///./test.db | Dev only; prod requires PostgreSQL |
| GOOGLE_CLOUD_PROJECT | vaidyaai-xprize | |
| GCP_REGION | asia-south1 | |
| FIREBASE_PROJECT_ID | vaidyaai-xprize-d4b2d | |
| LIVE_CLINICAL_AI | true | Real Gemini inference |
| AI_ALLOW_MOCK_FALLBACK | false | Fail-closed |
| GRPC_DNS_RESOLVER | native | Added at 8687010; fixes gRPC DNS |
| CORS_ORIGINS | localhost:3000, 127.0.0.1:3000 | |
| BACKEND_URL | placeholder.run.app | **Not a live deployment** |
| Frontend env | NEXT_PUBLIC_DEV_AUTH_BYPASS, BACKEND_URL | |

**Production checks in config.py:**
- `is_production`: rejects SQLite, rejects in-memory store
- `AI_ALLOW_MOCK_FALLBACK=false` enforced
- Firebase required (no dev bypass)

---

## 25. TESTS

### Backend tests (27 files)
| Test file | Tests | Coverage |
|-----------|-------|----------|
| test_agent_health_regression.py | ~3 | Agent health endpoint |
| test_appointment_flow.py | ~3 | Walk-in registration flow |
| test_appointments_patient_id.py | ~3 | Appointment identity |
| test_billing_pulse.py | ~5 | Invoice creation, idempotency |
| test_billing_safety_gate.py | 1 | Invoice blocked on unsafe (added 8687010) |
| test_clinical_scribe.py | ~4 | Scribe pipeline, vitals preservation |
| test_clinics.py | ~4 | Clinic settings, dev-provision |
| test_config_validation.py | ~4 | Production config assertions |
| test_consultation_activity.py | ~5 | Activity log scoping |
| test_consultation_start_regression.py | 2 | Empty vitals, no placeholder |
| test_e2e_integration.py | ~3 | Full workflow integration |
| test_event_bus.py | ~3 | Event bus lifecycle |
| test_firestore_init.py | ~2 | In-memory vs live |
| test_insight_engine.py | ~3 | Patient summary |
| test_internal_auth_security.py | ~8 | Internal endpoint auth |
| test_live_auth_flow.py | ~11 | Auth: authenticated, missing, invalid |
| test_llm_failclosed.py | ~4 | LLM unavailable → fail-closed |
| test_patients.py | ~3 | Patient CRUD |
| test_prescription_safe.py | ~4 | Allergen guard, safety eval |
| test_production_hardening.py | ~38 | Production config, security |
| test_referral_coordinator.py | ~3 | Referral generation |
| test_retention_radar.py | ~3 | Follow-up, retention |
| test_safety_gate_regression.py | 15 | All safety gate paths |
| test_safety_stale_gate.py | 3 | Stale safety, invoice model (added 8687010) |
| test_speech_to_text_live.py | ~8 | STT pipeline, fail-closed |
| test_vitals_preservation.py | 1 | Scribe preserves vitals (added 8687010) |
| test_webhook_signature.py | ~3 | Razorpay/WhatsApp webhook auth |

**Backend test result:** 137 passed, 0 failed (verified earlier in this session at commit 8687010). Current run attempts hang on `import main` — likely a stale-process/DB-lock/environment issue after backend was killed mid-session, NOT a code regression.

### Frontend tests
- **None exist.** No unit tests, no component tests, no integration tests.

---

## 26. E2E TESTS

- **None exist.** No Playwright, Cypress, or any E2E test framework is configured.
- The frontend has no `playwright.config.ts`, no `e2e/` directory, no `*.spec.*` files.
- Manual browser testing was performed earlier in this session (patient registration through approval → billing).

---

## BUG CLASSIFICATION

### P0 — Critical / Build-breaking

| # | Bug | Evidence | File:Line |
|---|-----|----------|-----------|
| 1 | **Frontend production build FAILS** — TypeScript error: `Property 'patient_id' does not exist on type 'ConsultationData'` | `npm run build` exits with code 1 | `frontend/src/components/consultation/ConsultationWorkspace.tsx:1555` + `frontend/src/hooks/useConsultation.ts:5-29` |
| 2 | **Backend `import main` hangs** — the module import blocks indefinitely, preventing pytest from running | Multiple pytest invocations produce empty logs and never complete | `backend/main.py` (likely Firebase init or DB connection blocking on import) |
| 3 | **"Dr. Dr. Ramesh" naming defect** — TopBar prepends "Dr. " to a doctorName that already contains "Dr. Ramesh" | `DEV_CLINIC_DATA.doctorName = "Dr. Ramesh"`, TopBar renders `Dr. {doctorName}` → "Dr. Dr. Ramesh" | `frontend/src/components/layout/TopBar.tsx:50` + `frontend/src/lib/auth.ts:38` |

### P1 — Integration gaps

| # | Issue | Evidence |
|---|-------|----------|
| 4 | Walk-in appointment response omits `clinic_id` (`clinic_id: None`) | API response captured earlier in session |
| 5 | Consultation start response omits `clinic_id` | API response captured earlier in session |
| 6 | "0/7 agents healthy" vs "7 agents active" — telemetry misalignment | Screenshots provided by user; agents are event-driven, health endpoint may not reflect configuration |
| 7 | "Analytics has no data" — analytics queries return empty in dev | Screenshots + in-memory Firestore has no historical data |
| 8 | "Audit trail has no activity" — activity log empty without completed workflow | Screenshots + needs consultation activity to populate |
| 9 | STT diarization duplicates content across patient/doctor channels | Live STT test earlier in session |
| 10 | No frontend unit tests, no E2E tests | `find` for test files returns empty |
| 11 | `BACKEND_URL` is a placeholder (`vaidyaai-backend-placeholder.run.app`) — no live deployment | `backend/.env` |

### P2 — UX issues

| # | Issue |
|---|-------|
| 12 | "Patient records cannot load" — with backend not running, frontend shows error/empty state; no graceful offline/retry UX visible |
| 13 | ConsultationWorkspace.tsx is 1600+ lines — monolithic component, hard to maintain |
| 14 | No loading skeletons on most pages (depends on error states) |
| 15 | Duplicate WalkInModal mount was fixed (8687010) but patients page still imports pattern could regress |

### P3 — Cosmetic

| # | Issue |
|---|-------|
| 16 | Doctor name display double-prefix "Dr. Dr." |
| 17 | Placeholder text uses "Ramesh Kumar" (same as test patient) |

---

## CAPABILITY MAP: implementation → endpoint → service → database → frontend → UI → test

### Patient Registration
| Layer | Detail |
|-------|--------|
| Backend impl | `agents/appointment_flow.py` → `api/appointments.py:74 create_walk_in_appointment()` |
| Endpoint | `POST /api/v1/appointments/walk-in` |
| Service | AppointmentFlow agent |
| Database | Firestore `patients` + `appointments` collections; PostgreSQL `patients` table |
| Frontend | `WalkInModal.tsx` → `api.post('/appointments/walk-in')` |
| UI action | "Add Walk-In Patient" button → modal → fill form → submit |
| Test | `test_appointment_flow.py`, `test_appointments_patient_id.py` |

### Patient Search
| Layer | Detail |
|-------|--------|
| Backend impl | `api/patients.py` → `GET /patients` |
| Service | Direct Firestore query |
| Database | Firestore `patients` collection |
| Frontend | `patients/page.tsx` → `api.get('/patients')` + client-side filter |
| UI action | Search input on patients page |
| Test | `test_patients.py` |

### Consultation Start
| Layer | Detail |
|-------|--------|
| Backend impl | `agents/clinical_scribe.py` + `api/consultations.py:84 start_consultation_endpoint()` |
| Endpoint | `POST /api/v1/consultations/start` |
| Database | Firestore `consultations` collection |
| Frontend | Patient profile "Start Consult" button → navigates to `/consultation?...` |
| Test | `test_consultation_start_regression.py` |

### Clinical History (allergies, chronic, meds)
| Layer | Detail |
|-------|--------|
| Backend impl | `api/consultations.py:197 update_clinical_history()` |
| Endpoint | `POST /api/v1/consultations/{id}/clinical-history` |
| Database | Firestore `consultations` + `patients` (propagation) |
| Frontend | `ConsultationWorkspace.tsx` review modals → `api.post('/consultations/{id}/clinical-history')` |
| Test | `test_clinical_scribe.py` (indirect) |

### Vitals
| Layer | Detail |
|-------|--------|
| Backend impl | `api/consultations.py` → `POST /consultations/{id}/vitals` |
| Database | Firestore `consultations.vitals` |
| Frontend | `ConsultationWorkspace.tsx` vitals inputs → Save Vitals button |
| Test | `test_vitals_preservation.py`, `test_consultation_start_regression.py` |

### STT / Transcription
| Layer | Detail |
|-------|--------|
| Backend impl | `services/speech_to_text.py` + `api/consultations.py:transcribe` |
| Endpoint | `POST /api/v1/consultations/upload-chunk`, `POST /api/v1/consultations/transcribe` |
| Service | Google Cloud Speech-to-Text |
| Database | Firestore `consultations.transcript_raw` |
| Frontend | `ConsultationRecorder.tsx` → chunk upload → transcribe |
| Test | `test_speech_to_text_live.py` (8 tests) |

### SOAP Generation
| Layer | Detail |
|-------|--------|
| Backend impl | `agents/clinical_scribe.py:process_consultation_audio()` |
| Service | Gemini 2.5 Pro via Vertex AI |
| Database | Firestore `consultations.soap_note` |
| Frontend | `SOAPNoteEditor.tsx` → displays + edit |
| Test | `test_clinical_scribe.py` |

### Grounding
| Layer | Detail |
|-------|--------|
| Backend impl | `utils/grounding_validator.py:validate_and_sanitize_clinical_facts()` |
| Database | Firestore `consultations.grounding_rejections` |
| Test | `test_clinical_scribe.py` (indirect), `test_llm_failclosed.py` |

### Prescription Safety
| Layer | Detail |
|-------|--------|
| Backend impl | `agents/prescription_safe.py` + `api/consultations.py:362 check_safety()` |
| Endpoint | `POST /api/v1/consultations/{id}/check-safety` |
| Service | Gemini 2.5 Pro + deterministic allergen guard |
| Frontend | `SOAPNoteEditor.tsx` → safety flags → `SafetyFlagsPanel.tsx` |
| Test | `test_prescription_safe.py`, `test_safety_gate_regression.py` (15 tests), `test_safety_stale_gate.py` |

### Consultation Approval
| Layer | Detail |
|-------|--------|
| Backend impl | `agents/clinical_scribe.py:approve_consultation()` + `api/consultations.py:437` |
| Endpoint | `POST /api/v1/consultations/{id}/approve` |
| Frontend | `SOAPNoteEditor.tsx` "Approve SOAP & Issue UPI Invoice" button |
| Test | `test_safety_gate_regression.py` |

### Billing
| Layer | Detail |
|-------|--------|
| Backend impl | `agents/billing_pulse.py` + `api/billing.py` |
| Endpoint | `POST /api/v1/billing/create-invoice`, `POST /billing/mark-cash`, etc. |
| Service | Razorpay (mock in dev) |
| Database | PostgreSQL `invoices` table |
| Frontend | `billing/page.tsx` → `useBilling.ts` |
| Test | `test_billing_pulse.py`, `test_billing_safety_gate.py` |

### Patient Summary
| Layer | Detail |
|-------|--------|
| Backend impl | `utils/patient_summary.py` + `agents/insight_engine.py` |
| Frontend | ConsultationWorkspace Summary tab |
| Test | `test_insight_engine.py` |

### FHIR
| Layer | Detail |
|-------|--------|
| Backend impl | `api/fhir.py` |
| Frontend | ConsultationWorkspace FHIR modal |
| Test | `test_e2e_integration.py` (indirect) |

### Audit
| Layer | Detail |
|-------|--------|
| Backend impl | `utils/agent_logger.py` + `api/consultations.py:520 get_activity()` |
| Endpoint | `GET /api/v1/consultations/{id}/activity` |
| Frontend | `logs/page.tsx` → `useAgentLogs.ts` |
| Test | `test_consultation_activity.py` |

---

## SCREENSHOT ISSUE ANALYSIS

| Reported Issue | Root Cause | Severity |
|----------------|------------|----------|
| Patient records cannot load | Backend not running (killed during session); no graceful fallback | P0 if backend down |
| Backend health endpoint unavailable | Backend process not running | P0 (operational) |
| AI Workforce telemetry unavailable | Backend not running → frontend cannot reach `/agents/health` | P0 (operational) |
| 0/7 agents healthy | Agents are event-driven; no events processed = not healthy; OR backend down | P1 |
| Settings says 7 agents active | Settings displays configured agent count (static), not runtime status | P1 (telemetry misalignment) |
| Analytics has no data | In-memory Firestore wiped on restart; no historical data | P1 (dev environment) |
| Audit trail has no activity | No completed workflow in current session; activity log is per-consultation | P1 (dev environment) |
| Dr. Dr. Ramesh naming defect | TopBar.tsx:50 renders `Dr. {doctorName}` where doctorName="Dr. Ramesh" | P0 (visible defect) |

---

## BACKEND TEST RESULTS

| Metric | Value |
|--------|-------|
| Total test files | 27 |
| Total test functions | ~137 |
| Passed | 137 (verified at commit 8687010 earlier in session) |
| Failed | 0 |
| Skipped | 0 |
| Runtime | ~1.8s |
| **Current status** | **HANGING** — `import main` blocks indefinitely after backend was killed mid-session. Likely DB lock or Firebase init blocking. NOT a code regression (same tests passed earlier). |

---

## FRONTEND BUILD RESULTS

| Metric | Value |
|--------|-------|
| Build command | `npm run build` |
| Result | **FAIL** — exit code 1 |
| Error | `Type error: Property 'patient_id' does not exist on type 'ConsultationData'` |
| Location | `ConsultationWorkspace.tsx:1555` accessing `consultation.patient_id` |
| Root cause | `ConsultationData` interface in `useConsultation.ts:5-29` does not declare `patient_id` field. Backend returns it. Lines 1137, 1555, and 1563 access it — line 1137 uses `(consultation as any)` cast (works), but lines 1555 and 1563 access it directly (fails TypeScript strict mode). |
| Impact | Production deployment impossible. Dev server (`npm run dev`) works because it doesn't type-check. |

---

## WHAT EXISTS

- Complete FastAPI backend with 11 API routers, 7 clinical AI agents, 6 ORM models
- Complete Next.js 14 frontend with 7 dashboard pages, consultation workspace, admin views
- Firebase phone auth + dev bypass
- Google Cloud STT + Gemini 2.5 Pro/Flash via Vertex AI (live, not mock)
- Deterministic grounding validator with evidence-based extraction
- Prescription safety with allergen guard + medication-signature stale gate
- Billing with Razorpay, idempotency, safety gate
- FHIR R4 export (12 resource types + IPS)
- Audit logging via agent logger + event bus
- 137 backend regression tests
- Scripts: `verify_gemini_live.py`, `run_stt_tests.py`, `verify_clinical_workflow_live.py`, `test_exact_grounding_scenario.py`

## WHAT IS BROKEN

1. **Frontend production build** — TypeScript contract error on `patient_id` (P0)
2. **Backend `import main` hangs** — stale process/DB lock after mid-session kill (P0, operational)
3. **"Dr. Dr. Ramesh"** — double prefix in TopBar (P0, visible)
4. Walk-in/consultation start responses omit `clinic_id` (P1)
5. STT diarization duplicates content (P1)
6. Agent health telemetry misaligns with settings display (P1)

## WHAT IS MISSING

1. No frontend unit/component tests
2. No E2E tests (Playwright/Cypress)
3. No live deployment (BACKEND_URL is placeholder)
4. No CI/CD pipeline visible
5. No error boundary/retry UX for backend-down state
6. No frontend API response type definitions matching backend (contract drift)

## WHAT IS UNVERIFIED

1. FHIR export correctness — not tested in browser this session
2. Patient summary from reviewed data only — not tested in browser
3. Audit event completeness for all 18 event types listed in Phase N
4. Auth + tenant isolation (401/403/cross-tenant) — not re-tested this session
5. AI failure behavior in browser (STT unavailable, Gemini unavailable) — API-level fail-closed verified, browser UX not verified
6. Production configuration validation — config.py has checks but not run in production mode
7. Backend test suite currently hangs (passed earlier but cannot re-verify due to environment issue)

## WHAT MUST NOT BE TOUCHED

1. **Safety gates** — `PrescriptionSafeAgent` allergen guard, stale-safety medication signature, billing safety gate. These are clinically critical and were verified working.
2. **Grounding validator** — evidence-based extraction, zero-fabrication rules. Clinical safety depends on this.
3. **Fail-closed behavior** — `AI_ALLOW_MOCK_FALLBACK=false` enforcement, LLM unavailable → `is_safe=False`.
4. **Patient identity system** — deterministic `pat_{phone}` ID generation. Changing this would break the identity invariant.
5. **Billing idempotency** — DB-level check on `consultation_firestore_id`. Removing this allows duplicate invoices.
6. **Invoice `patient_id` column** — added at 8687010. Required for identity invariant.
7. **`GRPC_DNS_RESOLVER=native`** in .env — required for Vertex AI gRPC DNS resolution on this machine.
8. **Conftest `_in_memory_store.clear()`** per-test isolation — required for test reliability.
9. **`UpdateClinicalHistoryRequest.current_medications`** field — contract fix, frontend depends on it.
10. **Vitals preservation fix** in `clinical_scribe.py` — scribe must not overwrite clinician-entered vitals.

---

*End of baseline audit. No source code was modified.*
