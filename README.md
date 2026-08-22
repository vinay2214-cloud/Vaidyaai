# VaidyaAI

**An autonomous AI clinical operations platform for solo and small outpatient clinics in India.**

VaidyaAI runs a seven-agent workforce across the whole clinic day — WhatsApp booking, ambient
consultation scribing, prescription safety, billing, referrals, retention and analytics — so a
single doctor seeing 40–80 patients can keep clinical records without hiring back-office staff.
Its core engineering bet is that clinical AI is only useful if it is *structurally prevented from
inventing things*. Two mechanisms enforce that: a **deterministic Grounding Validator** that
rejects any clinical fact lacking a verbatim evidence span in the consultation transcript — unsupported
assertions are dropped and logged rather than silently written into the record, unrecorded vitals stay
null, and AI-suggested diagnoses are marked provisional — and a **fail-closed PrescriptionSafe**
agent that disables sign-off entirely on an un-overridden critical drug interaction or allergy
conflict, requiring a documented clinical override to proceed. Mock AI fallback is disabled in
production, so clinical output cannot quietly degrade to synthetic text.

---

## Live Demo

| | |
|---|---|
| **Frontend** | https://vaidyaai-frontend-353775352272.asia-south1.run.app |
| **Backend API docs** | https://vaidyaai-backend-353775352272.asia-south1.run.app/docs |
| **Service health** | https://vaidyaai-backend-353775352272.asia-south1.run.app/health |
| **AI execution telemetry** | https://vaidyaai-backend-353775352272.asia-south1.run.app/api/v1/ai/live-status |
| **Demo video** | _link pending — add before submission_ |

Both services are deployed on Google Cloud Run in `asia-south1`. Sign-in is Firebase phone auth.

### Judge Testing Access

| | |
|---|---|
| **Phone** | `+91 98497 45859` |
| **OTP** | `123456` |

This is a Firebase test phone number: it accepts this code **only for this specific number** and
does not bypass authentication for any other account. It signs in to a demo clinic
(*Arogya Wellness Family Practice*) containing test data only.

---

## Clinical Pipeline

```
Patient Voice
  └─> Google Cloud Speech-to-Text        (speaker diarization, te-IN / hi-IN / en-IN)
       └─> Gemini 2.5 Pro — ClinicalScribe   (SOAP draft + ICD-10 coding)
            └─> Grounding Validator           (evidence spans; unsupported facts REJECTED)
                 └─> SOAP Note                (provisional diagnoses flagged)
                      └─> PrescriptionSafe    (fail-closed: blocks sign-off on critical findings)
                           └─> Clinician Approval   (explicit; override requires written reason)
                                └─> BillingPulse    (invoice + UPI payment link)
                                     └─> FHIR R4 Export
```

Empty or unusable transcripts are refused before the LLM step — an unusable recording returns a
clinician-readable error rather than a note synthesised from nothing.

---

## The Seven Agents

| # | Agent | Model | What it does |
|---|---|---|---|
| 1 | **AppointmentFlow** | Gemini 2.5 Flash | Classifies incoming WhatsApp messages and books, reschedules, cancels or emergency-redirects appointments. |
| 2 | **ClinicalScribe** | Gemini 2.5 Pro | Transcribes ambient consultation audio and drafts a structured SOAP note with ICD-10 codes. |
| 3 | **PrescriptionSafe** | Gemini 2.5 Pro | Checks drug–drug interactions and allergy conflicts; blocks approval fail-closed on critical findings. |
| 4 | **BillingPulse** | deterministic | Generates invoices and UPI payment links on approval, and daily P&L summaries. |
| 5 | **ReferralCoordinator** | Gemini 2.5 Pro | Extracts specialist referrals from SOAP notes and drafts formal referral letters. |
| 6 | **RetentionRadar** | Gemini 2.5 Flash | Tracks chronic follow-ups and missed appointments, with outreach in Telugu, Hindi, Tamil and English. |
| 7 | **InsightEngine** | Gemini 2.5 Pro | Computes a Practice Health Score and weekly growth recommendations from clinic and billing data. |

Every agent decision is written to an append-only audit log with model, region, latency and outcome,
exportable as CSV or JSON from the Operations Timeline.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI 0.111 · Python 3.11 · SQLAlchemy 2.0 (async) |
| Frontend | Next.js 14 (App Router) · TypeScript 5.4 strict · Tailwind CSS 3.4 · Zustand |
| Reasoning model | Vertex AI — **Gemini 2.5 Pro** (`us-central1`) |
| Fast model | Vertex AI — **Gemini 2.5 Flash** (`asia-south1`) |
| Speech | Google Cloud Speech-to-Text (diarization) + FFmpeg chunk assembly |
| Document store | Firestore (Native mode) — patients, appointments, consultations, agent logs |
| Relational store | Cloud SQL PostgreSQL 15 — invoices, clinics, P&L, referrals |
| Auth | Firebase Auth (phone) + Firebase Admin SDK custom claims |
| Compute | Cloud Run (`asia-south1`), multi-stage Docker |
| Async work | Cloud Tasks (reminders, billing follow-ups, retention outreach) |
| Interop | FHIR R4 export · ReportLab PDF prescriptions |
| CI | GitHub Actions (backend lint + tests, frontend build) |

---

## Engineering Notes

Issues found and resolved while hardening the live deployment. All are fixed; listed because the
failure modes are more interesting than the fixes.

| Area | Issue | Resolution |
|---|---|---|
| Firestore rules | Security rules were correct in `firestore.rules` but had never been released to the project, so the database denied every client read and all authenticated users hit permission-denied. | Published the ruleset. |
| Backend deploys | A fail-closed config check demanded WhatsApp and Razorpay credentials unconditionally, even with both integrations flagged off — no deploy from `HEAD` could boot. | Gated each credential requirement on its own feature flag; enabling a flag without wiring its secrets still fails closed. |
| Speech-to-Text | The client pinned `quota_project_id`, which requires `serviceusage.services.use` — a permission the Cloud Run service account did not hold, so every transcription failed silently. | Removed the override. Attached service-account credentials already quota against their own project, so this needed **zero new IAM grants**. |
| Error visibility | FastAPI's handler for bare `Exception` runs on `ServerErrorMiddleware`, which wraps the stack *above* CORS. Its 500s shipped without `Access-Control-Allow-Origin`, so browsers discarded them and reported a generic network error with no status — making two unrelated failures undiagnosable. | Moved error handling inside the CORS boundary; pinned with a regression test. |
| Schema drift | `Invoice.patient_id` existed in the ORM model but the column was never migrated, taking the billing endpoint down. Masked locally by a SQLite-only dev patch. | Added Alembic migration `0002`, applied to production Cloud SQL via a one-off Cloud Run Job. |
| Firestore indexes | Composite indexes required by the real-time queries were correctly defined in `firestore.indexes.json` but had never been deployed — the same root pattern as the security rules. | Created all eight composite indexes. |

The recurring lesson: two separate outages came from configuration that was correct **in the repo**
but never **released to the project**. Definition and deployment are different things.

---

## Tests

**213 backend tests passing.**

```bash
cd backend && python3 -m pytest tests/ -q
```

| Area | What is covered |
|---|---|
| Grounding validation | Unsupported descriptors and fabricated durations are rejected; provenance rules; vitals preservation |
| Fail-closed safety | LLM failure behaviour, prescription safety gates, billing safety gates, override paths |
| Transcription integrity | An empty or unusable transcript is refused and never reaches the LLM |
| CORS boundary | Unhandled 500s carry CORS headers so clients receive a real status |
| Relational contracts | Agent write kwargs match ORM columns; clinic IDs are UUID-typed |
| Event bus | Envelope creation, idempotency, error isolation, DAG registration |
| Security | JWT verification, tenant isolation, webhook signatures, internal task auth |
| E2E integration | Full seven-agent patient journey |

Frontend: `npm run lint` and `npm run build` (TypeScript strict).

---

## Known Limitations

Stated plainly rather than hidden — the live `/health` endpoint reports all of this too.

- **WhatsApp Business API runs in mock mode.** Implemented against the Meta Cloud API v19.0
  contract including HMAC webhook verification, but not connected to live credentials for this
  submission. `FEATURE_WHATSAPP=false`.
- **Payment processing runs in mock mode.** Razorpay UPI link generation and webhook reconciliation
  are implemented against the production contract; no live keys are wired. Payments are recorded
  manually through the Billing screen.
- **Secrets partially fall back to environment variables.** `/health` reports
  `secret_manager: env_fallback`; only `DATABASE_URL`, `INTERNAL_TASK_SECRET` and `BACKEND_URL`
  are injected from Secret Manager today.
- **Live interim transcript is not streamed.** The Live Transcript panel populates after the
  recording stops rather than during it. A real-time input-level meter and a silence warning cover
  the trust gap in the meantime, so a muted microphone is visibly distinguishable from a working one.
- **Single-clinic scale.** Tenant isolation is enforced on every query and in Firestore rules, but
  the deployment is sized for solo and small practices, not multi-site networks.
- **Audio chunks buffer on the container filesystem** between upload and transcription, which
  assumes a consultation's uploads land on one Cloud Run instance. Fine at current concurrency;
  object storage is the correct fix before scaling out.

---

## Local Development

**Prerequisites:** Python 3.11+, Node.js 18+, Docker (optional).

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # defaults are development-safe
uvicorn main:app --reload --port 8000
```

Serves `http://localhost:8000` with `/docs`, `/health`, `/livez` and `/readyz`.
In development the schema is auto-created from ORM metadata; in every other environment Alembic owns it:

```bash
alembic upgrade head
```

### Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:3000
```

`NEXT_PUBLIC_*` values are inlined at **build** time, so production values must be passed as Docker
build args — setting them as Cloud Run runtime variables has no effect. See
`infrastructure/frontend-cloudbuild.yaml`.

### Seed demo data

```bash
python3 scripts/seed_demo_data.py
```

### Further documentation

| Document | Contents |
|---|---|
| [`VaidyaAI_TECHNICAL_ARCHITECTURE_v2.md`](VaidyaAI_TECHNICAL_ARCHITECTURE_v2.md) | Event-driven architecture, event envelope, DAG, idempotency and DLQ |
| [`RUNBOOK_LOCAL_AND_GCP.md`](RUNBOOK_LOCAL_AND_GCP.md) | Full local and GCP setup, environment variable reference |
| [`DEPLOYMENT_RUNBOOK_FINAL.md`](DEPLOYMENT_RUNBOOK_FINAL.md) | Cloud Run deployment, secrets, Cloud SQL, scheduler jobs |
| [`SECURITY.md`](SECURITY.md) | Security model, implemented controls, disclosure policy |
| [`VaidyaAI_PRD_v2.md`](VaidyaAI_PRD_v2.md) | Product requirements and clinical rationale |

---

## License & Submission

Licensed under the **Apache License 2.0** — see [`LICENSE`](LICENSE).

Submitted to **Build with Gemini — XPRIZE 2026**, category **Professional Services Access**.

---

<sub>Deployment state described here was verified against the live Cloud Run services on 22 August 2026.</sub>
