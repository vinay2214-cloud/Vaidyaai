# VaidyaAI — Technical Architecture

**Build with Gemini · XPRIZE 2026 — Professional Services Access**

Verified against live deployment `vaidyaai-backend-00017-fhf` / `vaidyaai-frontend-00008-gvz`
(Cloud Run, `asia-south1`) on **22 August 2026**. Every claim below was cross-checked against
running services or source before publication; where something is configured but not yet
demonstrated, this document says so rather than implying otherwise.

---

## 1. The Architectural Thesis

**VaidyaAI does not treat the language model as the final authority on clinical fact.**

A medical scribe that transcribes and summarises is a text-generation product: whatever the model
emits becomes the record, and correctness depends on the model behaving. VaidyaAI is built on the
opposite assumption — that the model *will* occasionally assert things nobody said, and that the
architecture must make those assertions structurally unable to reach a patient record.

Two deterministic, non-LLM control points enforce this:

1. **The Grounding Validator** sits between Gemini's output and the SOAP note. Every clinical fact
   must be traceable to an evidence span in the actual transcript. Facts that fail are *rejected and
   logged*, not silently rewritten. Unrecorded vitals stay `null`. AI-derived diagnoses are marked
   provisional. It is ordinary Python — regex, string matching, thresholds — with no model in the
   loop, so its behaviour is reproducible and testable.

2. **PrescriptionSafe** sits between the SOAP note and clinician sign-off, and fails closed. A
   critical drug interaction or allergy conflict disables approval outright. The clinician retains
   authority through a separately labelled override that demands a written clinical reason — the
   path is narrowed and recorded, never removed.

The distinction this document is claiming is between **an AI medical scribe** and **a controlled
clinical intelligence pipeline**: in the first, the model's output *is* the product; in the second,
the model is one untrusted component inside a pipeline that validates, gates, and can refuse it. A
system that cannot say "no" to its own model has no safety property to describe.

Supporting this at the configuration level: `LIVE_CLINICAL_AI=true` with
`AI_ALLOW_MOCK_FALLBACK=false` in production. If Vertex AI is unreachable, the pipeline fails —
it does not substitute a plausible-looking mock and let it flow onward as clinical content.

---

## 2. The Pipeline

Every step below exists in code. Steps that are *not* implemented are marked and excluded from the
flow rather than drawn optimistically.

```
Patient Voice  (Telugu / Hindi / English, code-mixed)
  │
  ├─ Browser MediaRecorder ─ 10s slices, audio/webm;codecs=opus
  │     · live input-level meter (Web Audio AnalyserNode, RMS)
  │     · silence warning after 5s below threshold
  │     · NOTE: interim transcript is NOT streamed — see §9 Limitations
  │
  ├─ POST /consultations/upload-chunk  (per slice, authenticated)
  │     └─ chunk buffered to container filesystem  ── see §9 Limitations
  │
  ├─ POST /consultations/transcribe
  │     └─ FFmpeg concat ─> single 16 kHz mono WAV
  │
  ├─ Google Cloud Speech-to-Text  (speech_v1p1beta1)
  │     · SpeakerDiarizationConfig — Doctor / Patient separation
  │     · primary te-IN, alternative_language_codes [en-IN, hi-IN]
  │     └─ transcript + confidence
  │
  ├─ ══ GATE 1: TRANSCRIPT USABILITY ══════════════════════════════
  │     transcript < MIN_USABLE_TRANSCRIPT_CHARS (25)
  │       -> ScribeTranscriptionError -> HTTP 422
  │       -> "Recording too short or unclear"
  │       -> LLM IS NEVER CALLED
  │     [verified live — see §8]
  │
  ├─ Gemini 2.5 Pro — ClinicalScribe   (us-central1)
  │     └─ structured clinical fact extraction (JSON)
  │
  ├─ ══ GATE 2: DETERMINISTIC GROUNDING VALIDATOR ═════════════════
  │     every fact requires an evidence span in the transcript
  │     unsupported facts -> REJECTED + logged, never written
  │     rejections > threshold -> status = "grounding_review_required"
  │     [no LLM in this path — see §3]
  │
  ├─ Grounded SOAP draft
  │     Subjective / Objective / Assessment / Plan + ICD-10
  │     diagnoses flagged is_provisional, status AI_SUGGESTION
  │
  ├─ ══ GATE 3: PRESCRIPTIONSAFE (FAIL-CLOSED) ════════════════════
  │     deterministic allergen conflict check short-circuits
  │     BEFORE the model is called; then Gemini 2.5 Pro interaction review
  │       CRITICAL / unsafe -> is_safe=false
  │            -> Approve button DISABLED
  │            -> separate "Review Safety Block" control
  │            -> override requires written clinical reason
  │       safe -> continue
  │
  ├─ ══ HUMAN-IN-THE-LOOP: CLINICIAN APPROVAL ═════════════════════
  │     explicit sign-off. Nothing below happens automatically.
  │     additional hard stops: low STT confidence (<0.60) unverified,
  │     allergy status unreviewed
  │
  ├─ BillingPulse ─ invoice + UPI payment link   (deterministic, no LLM)
  ├─ ReferralCoordinator ─ referral extraction from the SOAP plan
  │                        (Gemini 2.5 Pro, only if referrals present)
  └─ FHIR R4 / ABDM-aligned export ─ 15 resource types, IPS Bundle

  ── asynchronous, practice-level, decoupled from the visit ──
     RetentionRadar   (Gemini 2.5 Flash)  chronic follow-up + no-show recovery
     InsightEngine    (Gemini 2.5 Pro)    Practice Health Score, weekly briefing
     NOTE: internal trigger endpoints exist and are auth-protected, but no
     Cloud Scheduler jobs are provisioned — see §9 Limitations
```

---

## 3. The Grounding Validator

`backend/utils/grounding_validator.py` — deterministic, no model calls.

### The rule

A clinical fact is admitted only if the transcript supports it. Support is checked two ways: exact
normalised substring match, or ≥75% overlap of significant words (>2 characters) from the claimed
evidence span. Below that threshold the fact is rejected.

### The concrete case

> **Transcript:** `[Patient]: I have cough for 2 days.`
> **Gemini emits:** `symptoms: [{ name: "dry cough" }]`
> **Validator:** rejects the descriptor `dry` — it was never spoken — and admits the bare symptom
> `cough`, which was.

The descriptor is not silently kept, and the underlying symptom is not thrown away with it. The
rejection is recorded with the model's original output and a reason string, so the discarded claim
remains auditable.

The same rule applies to timing. If the transcript says *"I took paracetamol once"* and the model
emits a duration of *"yesterday"*, the duration is rejected — `yesterday` appears nowhere in the
transcript. A fabricated *when* is as clinically dangerous as a fabricated *what*.

Additional deterministic rules:

| Rule | Behaviour |
|---|---|
| Provenance required | Every fact carries `source ∈ {transcript, clinician_entered, patient_record}` |
| Complete evidence spans | Symptom + duration must co-occur in one clause, not be stitched from two |
| Unrecorded vitals | Remain `null`; never inferred, never defaulted |
| AI diagnoses | Marked `is_provisional=true`, `status="AI_SUGGESTION"` |
| Negation normalisation | "No BP" → `condition=hypertension, status=denied`, with the normalisation recorded |
| Rejection threshold | Exceeded ⇒ consultation status becomes `grounding_review_required` |

### Verification status

**Implemented and unit-tested.** `backend/tests/test_grounding_validator_examples.py` pins both
documented examples — the rejected `dry` descriptor and the fabricated duration — plus the inverse
cases proving the validator is not a blunt filter: a descriptor the patient *did* say survives, and
a duration the patient *did* give is preserved with its evidence span. Broader grounding behaviour
is covered by `test_production_hardening.py` (rejection persistence) and `test_vitals_preservation.py`.

---

## 4. Fail-Closed Safety Architecture

The principle: **when an AI component fails, the workflow stops.** It never substitutes a default,
a cached answer, or a mock, and never lets a degraded result continue downstream wearing the
appearance of a real one.

### 4.1 Configuration level

```
LIVE_CLINICAL_AI=true          # clinical AI must execute for real
AI_ALLOW_MOCK_FALLBACK=false   # no synthetic substitution, ever
```

Both are set on the production service. `production_config_errors()` refuses to boot if
`LIVE_CLINICAL_AI` is false or `AI_ALLOW_MOCK_FALLBACK` is true in a production environment — the
unsafe combination cannot be deployed by accident. Covered by `tests/test_llm_failclosed.py` and
`tests/test_config_validation.py`.

### 4.2 The empty-transcript gate — observed live

This is not a design intention; it was exercised against the live deployment on 22 August 2026.

| | |
|---|---|
| **Input** | Recording made in a silent room. Chunks uploaded normally (HTTP 200). |
| **Speech-to-Text** | Executed successfully — `recognized 0 chars in 2106ms, confidence 0.95, te-IN`, `status=live` (not mock). |
| **Gate** | 0 usable characters < 25 ⇒ `ScribeTranscriptionError`. **Gemini was never called.** |
| **API** | `POST /consultations/transcribe` → **HTTP 422** with a clinician-readable reason. |
| **UI** | Persistent inline panel: *"Clinical note was not generated — Recording too short or unclear."* with **Retry without re-recording** and **Record again**, plus *"Nothing has been written to this patient's record."* |
| **Audit** | `clinical_scribe — Rejected SOAP generation for consultation …: transcript held 0 usable characters` |

The failure is loud, specific, recorded, and recoverable without discarding the captured audio.
The alternative — the behaviour this replaced — was a silent no-op where the button reverted and
every SOAP field kept its placeholder text, which is precisely the condition under which a rushed
clinician might mistake placeholder prose for a generated note.

### 4.3 PrescriptionSafe hard stop

Allergen conflicts are evaluated **deterministically first** and short-circuit to `is_safe=false`
before the model is invoked at all — a known allergy conflict does not depend on an LLM judgement
call. Gemini 2.5 Pro then reviews drug-drug interactions on top of that floor.

On an un-overridden critical finding:

- the **Approve** control is rendered disabled and inert;
- a distinct, separately labelled **Review Safety Block** control opens the override flow;
- the override requires a written clinical justification, recorded against the consultation;
- a heavy red banner enumerates the critical findings inline.

The override is deliberately preserved. Removing it would move clinical authority from the doctor to
the model, which is the opposite of the intent — the goal is that overriding is *deliberate and
attributable*, not that it is impossible. Covered by `tests/test_prescription_safe.py`,
`tests/test_safety_gate_regression.py`, `tests/test_billing_safety_gate.py`.

---

## 5. The Seven Agents — Bounded Responsibilities

**Architectural constraint: one agent, one responsibility, no reaching into another agent's
domain.** Agents communicate only by emitting events onto the bus; none calls another directly and
none writes to another's records. This is deliberate, not incidental.

The reason is auditability. A single monolithic prompt doing intake, scribing, safety and billing
produces one opaque decision whose failure cannot be localised or separately tested. Thirteen
discrete event types across seven bounded agents produce a decision trail where each step names its
model, region, latency and outcome — and where a safety regression can be unit-tested without
invoking the entire clinic workflow.

| # | Agent | Model | Why that model | Trigger |
|---|---|---|---|---|
| 1 | **AppointmentFlow** | Gemini 2.5 Flash | Intent classification over short WhatsApp messages — latency dominates; a patient waiting on a reply notices seconds. `asia-south1` keeps the round trip local. | WhatsApp inbound webhook |
| 2 | **ClinicalScribe** | Gemini 2.5 Pro | Long-context clinical reasoning over a code-mixed transcript, producing structured facts and ICD-10 codes. Accuracy dominates; this output is gated downstream anyway. | `POST /consultations/transcribe` |
| 3 | **PrescriptionSafe** | Gemini 2.5 Pro | Drug interaction reasoning where a miss is a patient-safety event. Deterministic allergen check runs first regardless. | Medications extracted, or explicit safety check |
| 4 | **BillingPulse** | *none — deterministic* | Money must be arithmetic, not inference. Fees come from `services/pricing.py`, the single source of truth for every surface. | `PRESCRIPTION_APPROVED` |
| 5 | **ReferralCoordinator** | Gemini 2.5 Pro | Drafting a referral letter to another clinician is a clinical writing task with medico-legal weight. | `SOAP_GENERATED` containing referrals |
| 6 | **RetentionRadar** | Gemini 2.5 Flash | High-volume outreach message generation across Telugu, Hindi, Tamil, English. Throughput dominates; each message is short and reviewed in aggregate. | Internal endpoint (see §9) |
| 7 | **InsightEngine** | Gemini 2.5 Pro | Synthesising a week of clinic metrics into an executive briefing with recommendations — genuine analytical reasoning. | Internal endpoint (see §9) |

Model routing is centralised in `config.py` as `GEMINI_REASONING_MODEL` / `GEMINI_FAST_MODEL`; no
agent hardcodes a model string, so the Pro/Flash split is a configuration decision rather than
scattered constants.

### Event bus

13 clinical event types: `PATIENT_REGISTERED`, `VISIT_CREATED`, `QUEUE_UPDATED`,
`CONSULTATION_STARTED`, `SOAP_GENERATED`, `PRESCRIPTION_CREATED`, `PRESCRIPTION_APPROVED`,
`INVOICE_GENERATED`, `PAYMENT_COMPLETED`, `REFERRAL_CREATED`, `FOLLOWUP_SCHEDULED`,
`ANALYTICS_UPDATED`, `AUDIT_WRITTEN`.

Events are emitted only **after** the database commit that they describe, so a subscriber can never
observe an event for a write that later rolled back. Handler failures are isolated — one failing
subscriber does not prevent the others from running. Covered by `tests/test_event_bus.py`.

---

## 6. Observability as an Architectural Choice

The platform reports its own execution truth through endpoints rather than asserting success in
documentation. This matters because documentation cannot be falsified by a reader; an endpoint can.

| Endpoint | Reports |
|---|---|
| `/health` | Per-dependency status: Vertex AI, Speech-to-Text, Firestore, Postgres, Cloud Tasks, Firebase, Secret Manager; feature flags; the seven agents; resolved model/region string |
| `/api/v1/ai/live-status` | `vertex_ai_initialized`, `last_execution_status`, `last_live_execution`, `last_live_model`, `last_live_location`, `last_live_latency_ms`, `live_clinical_ai_enabled`, `mock_fallback_allowed` |
| `/livez` | Dependency-free liveness — distinguishes a hung container from a degraded one |
| `/readyz` | 503 until lifespan startup validation completes |

The Operations Timeline surfaces the same telemetry in the UI, and claims **"Live & Verified"** only
after an observed successful Vertex execution — otherwise it reports the weaker, truthful state.

### Current reading — 22 August 2026

```
vertex_ai_initialized     : False
last_execution_status     : idle
last_live_execution       : None
last_live_model           : None
last_live_latency_ms      : None
live_clinical_ai_enabled  : True
mock_fallback_allowed     : False
reasoning_model           : gemini-2.5-pro    (us-central1)
fast_model                : gemini-2.5-flash  (asia-south1)
```

**Stated plainly: no Gemini inference has yet completed on this deployment.** The pipeline is
configured for live execution with mock fallback disabled, and the Speech-to-Text stage is verified
working (§4.2), but the transcription attempts made so far produced empty transcripts, so Gate 1
correctly refused before the model was reached. The endpoint above is the check — a reader can
confirm the current state in one request rather than taking this document's word for it. Completing
one consultation with audible speech will flip `last_execution_status` to `success` and populate the
model, region and latency fields.

---

## 7. Debugging Journal

Six production defects found and fixed while hardening the live deployment. Each is given as
*symptom → root cause → fix → verification*, because the root causes are more instructive than the
patches, and two of them share a root pattern worth naming.

### 7.1 Silent transcription failure — a two-bug chain

**Symptom.** "Stop & Generate SOAP Note" produced no output, no error, no loading state. Every SOAP
field kept its placeholder text. The browser console showed only `AxiosError: Network Error` with no
HTTP status.

**Investigation.** Cloud Run logs showed the 15 chunk uploads all returned 200, and
`POST /consultations/transcribe` returned **500 in 2.45s** — far too fast to be a timeout, which
eliminated the leading hypothesis.

**Root cause A — the permission.** `SpeechToTextService` constructed its client with
`ClientOptions(quota_project_id=...)`. Pinning a quota project requires
`serviceusage.services.use` on that project, which the Cloud Run service account did not hold, so
every call failed:

```
Caller does not have required permission to use project vaidyaai-xprize
  ... roles/serviceusage.serviceUsageConsumer         [speech.googleapis.com]
```

**Fix A.** Removed the override. Attached service-account credentials already bill and quota against
their own project, so the pin bought nothing in production while adding a permission requirement —
**resolved with zero new IAM grants**, the least-privilege outcome. It is retained as a fallback for
local user ADC, where the supported remedy is `gcloud auth application-default set-quota-project`.

**Root cause B — why it was invisible.** FastAPI installs a handler registered for bare `Exception`
on Starlette's `ServerErrorMiddleware`, which wraps the *entire* user middleware stack — above
`CORSMiddleware`. A 500 produced there never travels back through the CORS layer, so it ships with no
`Access-Control-Allow-Origin`. The browser discards the response entirely and the client sees an
opaque network failure with no status code. **Two unrelated outages were undiagnosable for this one
reason.**

**Fix B.** Registered an exception guard *before* `CORSMiddleware` so it resolves inside it, letting
error responses travel back out through the CORS layer like any normal response. Since
`add_middleware` inserts at the front, registration order is the mechanism:

```
security_and_tracing        (registered last  -> outermost)
  CORSMiddleware
    unhandled_exception_guard  (registered first -> innermost)
      routes
```

**Verification.** `tests/test_error_response_cors.py` asserts a 500 carries
`Access-Control-Allow-Origin`, and separately asserts the stack ordering, so a future middleware
reshuffle cannot silently reintroduce the defect. Live: the transcribe endpoint now returns a
readable **422**, and `Initialized Google SpeechClient (ADC default quota project)` →
`recognized 0 chars in 2106ms` confirms Speech-to-Text executing.

### 7.2 ORM / migration schema drift

**Symptom.** The entire Billing page failed with `AxiosError: Network Error` (same CORS masking as
above).

**Root cause.** `models/billing.py` declares `Invoice.patient_id`, but `0001_initial_schema` never
created the column and no later migration added it. Every Invoice query selected a column Postgres
did not have: `UndefinedColumnError: column invoices.patient_id does not exist`. It never surfaced
locally because `init_db()` contains a **SQLite-only** patch that adds the column in development —
the drift was masked precisely where it would have been caught.

**Fix.** Alembic migration `0002_add_invoice_patient_id` (nullable column + index, with a working
downgrade), applied to production Cloud SQL through a one-off Cloud Run Job — same image, same
service account, same attached instance, so no database credential left the project. Alembic had
never been stamped on the production database, so the baseline was stamped before upgrading.

**Verification.** `alembic current` → `0002_add_invoice_patient_id (head)`; the endpoint moved from
500 to a normal authenticated response, and the Billing page renders.

### 7.3 A z-index bug that presented as a routing bug

**Symptom.** Pressing "Stop & Generate SOAP Note" navigated the app to `/billing`, which then failed
to load. The obvious hypothesis was a stray `router.push('/billing')` left in from testing.

**Root cause.** No such navigation existed anywhere in the consultation flow. `MobileNav` is
`fixed bottom-0 … z-50` below the `md` breakpoint, and **only the dashboard reserved bottom padding
for it.** On a narrow viewport the nav bar floated on top of the consultation workspace, directly
over the Stop button — the tap landed on the Billing link underneath. Two independent defects
compounded into one plausible-looking symptom.

**Fix.** Reserved the inset centrally in `AppShell` (`pb-24 md:pb-5`) so no page can omit it, and
removed the now-redundant per-page padding.

**Verification.** Stop pressed on the live deployment; the app stayed on the consultation workspace
and rendered the inline transcription error in place.

### 7.4 "Defined in the repo, never released to the project" — twice

The same root pattern produced two separate outages.

| | Firestore security rules | Firestore composite indexes |
|---|---|---|
| **Symptom** | Every authenticated user hit `permission-denied` on `clinic_users/{uid}` and fell through to the onboarding wizard | Agent Activity feed permanently empty; `onSnapshot` error: *"The query requires an index"* |
| **Root cause** | `firestore.rules` was correct — and had **zero** rulesets and **zero** releases in the project. The database was running locked-down defaults. | All nine index definitions in `firestore.indexes.json` were correct, and **zero** composite indexes existed in the project. |
| **Fix** | Published the ruleset. File content unchanged — this was a deployment gap, not a code defect. | Created all 8 composite indexes (the ninth is single-field, which Firestore indexes automatically). |
| **Verification** | Release listed under `projects/vaidyaai-xprize/releases/cloud.firestore`; permission errors gone from the console. | All 8 report `state: READY`; the Agent Activity feed populates with live decisions. |

**The lesson worth extracting:** configuration that is correct *in version control* and configuration
that is *active in the project* are different things, and nothing in a normal build or test pipeline
distinguishes them. Both outages were invisible to CI, code review and local development.

### 7.5 A fail-closed check that failed the wrong way

**Symptom.** No backend deploy from `HEAD` could boot; the container failed its startup probe.

**Root cause.** `production_config_errors()` demanded WhatsApp and Razorpay credentials
unconditionally, while the deployment deliberately sets `FEATURE_WHATSAPP=false` and
`FEATURE_RAZORPAY=false` and wires no such secrets. The live revision predated that check, so the
repository had been undeployable without anyone noticing.

**Fix.** Gated each credential requirement behind its own feature flag. Enabling a flag without
wiring its secrets still fails closed — the safety property is preserved, but it now measures the
right thing. `FEATURE_RAZORPAY` was also added as a real `Settings` field; it had been set by
`cloudbuild.yaml` and silently dropped by `extra="ignore"`.

**Verification.** `tests/test_config_validation.py`; backend revision `00016` onward boots and
serves.

---

## 8. XPRIZE Judging Criteria — Cross-Reference

| Criterion | Where it is demonstrated | Evidence |
|---|---|---|
| **AI-Native Operations** | §5 — seven bounded agents, one responsibility each, coordinated by a 13-event bus rather than a monolithic prompt. §4 — fail-closed execution: AI failure halts the workflow instead of substituting a default. §6 — the platform publishes its own execution telemetry rather than asserting success. | `/api/v1/ai/live-status`, `/health`, exportable agent decision log (CSV/JSON) from the Operations Timeline |
| **Category Impact** *(Professional Services Access)* | §3 and §4 as **patient-safety infrastructure**: the Grounding Validator prevents fabricated clinical fact from entering a record, and PrescriptionSafe fails closed on allergy and interaction conflicts. Interoperability via FHIR R4 with ABDM alignment annotations (15 resource types, IPS Bundle export) means records leave with the patient rather than being locked in. | `utils/grounding_validator.py`, `agents/prescription_safe.py`, `integrations/fhir_r4.py`, `tests/test_grounding_validator_examples.py` |
| **Business Viability** | Three-tier SaaS subscription: **Essential ₹2,999 / Growth ₹5,999 / Pro ₹9,999** per clinic per month, with Growth (all seven agents) as the primary offering. **93% gross margin.** India solo-clinic TAM **₹86 billion annually** at ₹5,999/clinic/month; immediate addressable market of **180,000 clinics** across Andhra Pradesh and Telangana. | [`VaidyaAI_PRD_v2.md`](VaidyaAI_PRD_v2.md) §2.3 Market Size and §Pricing Tiers |

> Figures in the Business Viability row are reproduced from `VaidyaAI_PRD_v2.md`, the single source
> for commercial numbers in this repository. Confirm they match the Devpost submission before
> judging; this document does not introduce independent figures.

---

## 9. Known Limitations

Stated directly. `/health` reports most of this at runtime too.

| Limitation | Detail |
|---|---|
| **No verified Gemini execution yet** | `last_execution_status: idle`. Configured for live execution with mock fallback disabled, but no inference has completed on this deployment. See §6. |
| **Cloud Scheduler jobs not provisioned** | The Cloud Scheduler API is **not enabled** on the project. `/internal/retention/run-daily-outreach`, `/internal/insights/send-weekly-report` and `/internal/billing/send-daily-pnl` exist and are shared-secret authenticated, but nothing invokes them on a schedule — RetentionRadar and InsightEngine currently run only on manual trigger. |
| **WhatsApp in mock mode** | Implemented against Meta Cloud API v19.0 including HMAC webhook verification; no live credentials wired. `FEATURE_WHATSAPP=false`. |
| **Payments in mock mode** | Razorpay UPI link generation and webhook reconciliation implemented against the production contract; no live keys. Payments are recorded manually through the Billing screen. |
| **No streamed interim transcript** | The Live Transcript panel populates after recording stops, not during. Mitigated by a live input-level meter and a 5s silence warning so a muted microphone is visibly distinguishable from a working one. |
| **Audio chunks buffer on container disk** | Chunks are written to the container filesystem between upload and transcription, assuming one consultation's uploads reach one Cloud Run instance. Acceptable at current concurrency (min-instances=1, concurrency=80); object storage is the correct fix before scaling out. |
| **Secret Manager partial** | `/health` reports `secret_manager: env_fallback`; only `DATABASE_URL`, `INTERNAL_TASK_SECRET` and `BACKEND_URL` are injected from Secret Manager. |
| **Single-clinic scale** | Tenant isolation is enforced on every query and in Firestore rules, but the deployment is sized for solo and small practices, not multi-site networks. |

---

## 10. Deployment & Operations

Live services (Cloud Run, `asia-south1`):

| Service | Revision | Configuration |
|---|---|---|
| `vaidyaai-backend` | `00017-fhf` | 2 GiB / 2 vCPU, min 1 / max 10, concurrency 80, timeout 300s, Cloud SQL attached |
| `vaidyaai-frontend` | `00008-gvz` | 512 MiB / 1 vCPU, min 0 / max 5 |

Cloud Tasks queues (all `RUNNING` in `asia-south1`): `appointment-reminders`, `billing-followups`,
`retention-outreach`.

**Build-time constraint worth repeating:** `NEXT_PUBLIC_*` values are inlined into the JavaScript
bundle by Next.js at **build** time. Setting them as Cloud Run runtime environment variables has no
effect. They must be passed as Docker build args — see `infrastructure/frontend-cloudbuild.yaml`,
which also fails the build outright if the backend URL is empty or points at localhost.

Full procedures and the complete environment variable reference live in the dedicated runbooks
rather than being duplicated here:

| Document | Contents |
|---|---|
| [`DEPLOYMENT_RUNBOOK_FINAL.md`](DEPLOYMENT_RUNBOOK_FINAL.md) | Cloud Run deployment, secrets, Cloud SQL, migrations |
| [`RUNBOOK_LOCAL_AND_GCP.md`](RUNBOOK_LOCAL_AND_GCP.md) | Local setup and the full environment variable reference |
| [`SECURITY.md`](SECURITY.md) | Security model, implemented controls, disclosure policy |
| [`VaidyaAI_PRD_v2.md`](VaidyaAI_PRD_v2.md) | Product requirements, market sizing, pricing |
| [`README.md`](README.md) | Two-minute overview and quick start |

---

## 11. Test Coverage

**213 backend tests passing** (`cd backend && python3 -m pytest tests/ -q`).

| Area | Covered |
|---|---|
| Grounding validation | Unsupported descriptor rejection, fabricated duration rejection, inverse (supported facts preserved), rejection persistence, vitals preservation |
| Fail-closed safety | LLM failure behaviour, config validation, prescription safety gates, billing safety gates, override paths |
| Transcription integrity | Empty/unusable transcript refused; the LLM is never reached |
| CORS boundary | Unhandled 500s carry CORS headers; middleware ordering asserted |
| Pricing | Estimate and invoice derive from one function; GST exemption pinned |
| Relational contracts | Agent write kwargs match ORM columns; clinic IDs UUID-typed |
| Event bus | Envelope creation, idempotency, error isolation, DAG registration |
| Security | JWT verification, tenant isolation, webhook signatures, internal task auth, dev-token rejection in production |
| FHIR | Resource construction, bundle assembly, reference integrity, capability statement, IPS export |
| E2E | Full seven-agent patient journey |

CI runs backend lint + tests and the frontend production build on every push and pull request
(`.github/workflows/ci.yml`).

---

<sub>Deployment state verified 22 August 2026 against `vaidyaai-backend-00017-fhf` and
`vaidyaai-frontend-00008-gvz`. Where this document and the live endpoints disagree, the endpoints
are correct — and that disagreement is a bug in this document.</sub>
