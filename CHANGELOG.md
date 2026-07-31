# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-rc.1] — 2026-07-31

### Added
- Chaos testing suite (`scripts/chaos_test.py`) — Vertex AI fallback, webhook idempotency, event deduplication, dead-letter queue
- Scaled workload benchmarks (`scripts/load_test.py`) — Scenarios A through D
- Clinical acceptance testing (`scripts/verify_clinical_scenarios.py`) — 10 clinical scenarios
- Demo data seeder (`scripts/seed_demo_data.py`) — pre-seeded patients, appointments, SOAP notes

### Fixed
- `mark_as_cash` UUID parsing for invoice lookup
- `razorpay_payment_link_id` now included in invoice creation response
- `setWalkInModalOpen` method name in `AppShell.tsx`

## [0.5.0] — 2026-07-30 (Phase 3: Enterprise Hardening)

### Added
- Feature flags: `FEATURE_AI_AUTONOMOUS`, `FEATURE_WHATSAPP`, `FEATURE_VOICE`, `FEATURE_REALTIME_EVENTS`, `FEATURE_ANALYTICS`, `FEATURE_DEMO_MODE`
- HTTP security headers: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`
- `X-Correlation-ID` tracing across backend and frontend
- Tiered API timeouts: 5s reads, 15s AI operations, 30s exports
- Skeleton loaders (`SkeletonCard`, `SkeletonTable`, `SkeletonChart`)
- Categorized toast notifications (clinical, billing, AI, security, system)
- SOAP draft auto-save to localStorage
- Keyboard shortcuts: `Cmd+K` (Command Palette), `Cmd+N` (Walk-In), `Cmd+S` (Save Draft), `Cmd+Enter` (Approve)
- `useAgentHealth` hook with 30-second auto-refresh
- Extended `/health` diagnostic endpoint
- Agent health API (`/api/v1/agents/health`)

## [0.4.0] — 2026-07-29 (Phase 2: Event-Driven AI Platform)

### Added
- In-process async EventBus with 13 clinical event types
- Event envelope with 14-field metadata (event_id, correlation_id, causation_id, etc.)
- Idempotency guard via rolling `processed_events` set (cap: 10,000)
- Dead-letter queue writing failed events to Firestore `failed_events` collection
- WorkflowOrchestrator with DAG registration mapping events to AI agents
- Dual-write audit logging: Google Cloud Logging + Firestore `agent_logs`
- PHI anonymization via `anonymise_for_llm()` — strips phones, Aadhaar, emails, patient names
- Event bus unit tests (idempotency, error isolation, registration)
- Internal auth security tests (shared secret, fail-closed, tenant isolation)

## [0.3.0] — 2026-07-28 (Phase 1: Clinical Workflow)

### Added
- Patient registration with Firestore storage
- Appointment booking via WhatsApp (AppointmentFlowAgent)
- Real-time queue management with Firestore `onSnapshot`
- Consultation workspace with ambient audio recording (ClinicalScribeAgent)
- SOAP note generation via Vertex AI Gemini 1.5 Pro with ICD-10 coding
- Prescription safety validation (PrescriptionSafeAgent) — drug interactions, allergy conflicts
- Invoice generation with Razorpay UPI payment links (BillingPulseAgent)
- Specialist referral letter generation (ReferralCoordinatorAgent)
- Patient retention outreach in regional languages (RetentionRadarAgent)
- Practice Health Score and weekly analytics (InsightEngineAgent)
- Next.js 14 dashboard with 8 routes and 98 components
- Firebase Authentication with Firestore tenant mapping
- PostgreSQL via SQLAlchemy 2.0 with async connection pooling
- Cloud Tasks integration for reminders and followups
- HMAC-SHA256 webhook signature verification for WhatsApp and Razorpay
- Production config validation rejecting placeholder secrets
- LLM fail-closed behavior in production environments
- Multi-stage Docker containers (backend + frontend)
- Cloud Run deployment scripts
- 39-test pytest suite
- E2E 7-agent journey test
- CI workflow (GitHub Actions)
