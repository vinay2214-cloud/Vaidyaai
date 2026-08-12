# VAIDYAAI — FINAL FORENSIC QA REPORT

**Date:** 9 August 2026
**Auditor:** Abacus AI Agent (autonomous forensic QA pass)
**Repo:** `/Users/vinayjanyavula/Desktop/VAIDYAAI` — branch `main`, commit `f9eb14b`
**Working tree:** 122 modified files (prior QA agent pass + this audit's fixes)

---

## 1. Executive Summary

A full forensic audit of the VaidyaAI healthcare application was conducted across backend (FastAPI + Firestore + Vertex AI + Cloud STT), frontend (Next.js 14 + TypeScript), and infrastructure (firestore.rules, CORS, env config, deployment).

**6 code defects were identified and fixed this session.** All backend tests pass (81/81). Frontend build compiles successfully (all 11 routes, zero type errors). The application's clinical safety architecture — grounding validator, deterministic allergen guard, fail-closed LLM, low-confidence transcript gate — is sound and correctly wired into the production code paths.

| Metric | Result |
|--------|--------|
| Backend pytest | **81/81 PASSED** |
| Frontend `next build` | **PASSED** (11 routes, 0 type errors) |
| P0 defects found | 0 (this session) |
| P1 defects found & fixed | 1 (low-confidence transcript review gate) |
| P2 defects found & fixed | 5 (frontend fabrication: hardcoded telemetry, misleading toasts, stale date, missing error handling) |
| P3 noted (not fixed) | 3 (orphaned dead code, static subtitles, CORS wildcard check) |
| Live GCP verification | **NOT RUN** — no `GOOGLE_APPLICATION_CREDENTIALS` in this environment |

---

## 2. Phases Completed

### Phase 1 — Repository Forensic Audit

Searched the entire repo for fabrication patterns. Results by pattern:

| Pattern Searged | Hits in Production Code | Verdict |
|----------------|----------------------|---------|
| `gemini-1.5` / stale model refs | 0 in app code (1 in `scripts/probe_vertex_models.py` — legitimate) | CLEAN |
| Hardcoded vitals `120/80`, `98%`, `70kg` | 0 in production paths; present in `gemini.py` mock fallback (gated, not reachable when `LIVE_CLINICAL_AI=true`) and test fixtures | CLEAN |
| Hardcoded billing `₹500` etc. | 0 — billing reads `amount_rupees` from API; fees from `clinic_doc.consultation_fees` | CLEAN |
| Fake provenance "Agent 6 • Gemini 2.5 Pro" on patient summary | Previously fixed — `generated_by: "system"`, `model: null`, `status: "deterministic"` | CLEAN |
| `demo_mode` / `DEMO_MODE` | 0 in production code | CLEAN |
| `fallback_mock` / `AI_ALLOW_MOCK_FALLBACK` | Correctly gated: requires `is_development AND AI_ALLOW_MOCK_FALLBACK AND NOT LIVE_CLINICAL_AI` | CLEAN |
| `NKDA` handling | Correctly filtered in `_detect_allergen_conflicts` — never triggers a block | CLEAN |
| Mock LLM in production paths | All mock paths in `gemini.py` and `speech_to_text.py` are properly gated | CLEAN |
| `initial_vitals` undefined bug | Fixed — vitals initialize to `{}` | CLEAN |
| gRPC/fork warnings | Handled — per-PID lazy `SpeechClient` init; `close_fds=True` on subprocess | CLEAN |
| Auth gating on API routes | All 40+ patient-facing endpoints use `Depends(get_current_user)`; internal routes use `verify_internal_request`; webhooks use HMAC-SHA256 | CLEAN |
| Secrets committed | `.env.example` has empty values; no secrets in repo | CLEAN |

### Phase 2 — Backend Verification

| Check | Result |
|-------|--------|
| `pytest` (full suite) | **81/81 PASSED** (1.98s) |
| `test_safety_gate_regression.py` | **15/15 PASSED** (includes 3 new tests this session) |
| `test_llm_failclosed.py` | PASSED |
| `test_prescription_safe.py` | PASSED |
| `test_clinical_scribe.py` | PASSED |
| `test_billing_pulse.py` | PASSED |
| Grounding validator (`utils/grounding_validator.py`) | Verified — rejects "dry cough"/"yesterday" hallucinations, nullifies unrecorded vitals, marks diagnoses provisional. **Called in production** at `clinical_scribe.py:128` |
| PrescriptionSafe (`agents/prescription_safe.py`) | Verified — deterministic allergen guard (penicillin→amoxicillin class), NKDA filtered, fail-closed on LLM unavailable, `is_safe=false + requires_manual_review=true` on conflict |
| Config (`config.py`) | Verified — ClinicalScribe=`gemini-2.5-pro`/`us-central1`, fast agents=`gemini-2.5-flash`/`asia-south1`, `LIVE_CLINICAL_AI=true` default, `AI_ALLOW_MOCK_FALLBACK=false` default |
| Firestore rules | Verified — per-clinic tenant isolation (`clinic_id` claim match), backend-only writes, default-deny |
| CORS | Env-configured (`http://localhost:3000` default); production validation checks for SQLite + placeholder secrets |
| Live GCP scripts (`verify_gemini_live.py`, `run_stt_tests.py`, `verify_clinical_workflow_live.py`) | **NOT RUN** — `GOOGLE_APPLICATION_CREDENTIALS` not set in this environment |

### Phase 3–11 — Code Defects Found & Fixed

#### P1-001: Low-Confidence Transcript Review Gate Not Enforced (Rule 11)

**Severity:** P1 (clinical safety)
**Root cause:** `requires_transcript_review` was computed from STT confidence tier but (a) not persisted to `scribe_metadata`, and (b) `approve_consultation` did not gate on it. A consultation with LOW STT confidence (<60%) could be approved without clinician transcript review.
**Files changed:**
- `backend/agents/clinical_scribe.py` — Added `requires_transcript_review` + `transcript_reviewed=False` to `scribe_metadata`; added gate in `approve_consultation` that returns `{"error": "transcript_review_required"}` when low-confidence and not reviewed; persists `transcript_reviewed=True` on approval.
- `backend/api/consultations.py` — Added `transcript_reviewed: Optional[bool] = False` to `ApproveConsultationRequest`; passes through to `approve_consultation`.
- `backend/tests/test_safety_gate_regression.py` — Added 3 regression tests: `test_approve_blocked_when_low_confidence_and_not_reviewed`, `test_approve_allowed_when_low_confidence_but_reviewed`, `test_approve_not_blocked_when_high_confidence`.
**Verification:** All 3 new tests + 12 existing safety gate tests pass (15/15).

#### P2-001: Hardcoded "7 agents running. 0 failures today." in LeftSidebar

**Severity:** P2 (fabricated telemetry)
**Root cause:** `LeftSidebar.tsx` displayed a static string instead of reading from the `useAgentHealth` hook (which was already available and fetches `/agents/health`).
**File:** `frontend/src/components/layout/LeftSidebar.tsx`
**Fix:** Wired `useAgentHealth()` → displays real `${active}/${total} agents active. N failures today.` with amber indicator when failures exist.
**Verification:** Frontend build passes.

#### P2-002: Hardcoded "7/7" Badge on Dashboard

**Severity:** P2 (fabricated telemetry)
**Root cause:** `app/(dashboard)/page.tsx` showed `<Badge variant="green" dot>7/7</Badge>` while "Decisions Today" and "Avg Latency" were already real.
**File:** `frontend/src/app/(dashboard)/page.tsx`
**Fix:** Wired `useAgentHealth()` → displays real `${active_agents}/${total_agents}` with green/orange variant based on failures.
**Verification:** Frontend build passes.

#### P2-003: Hardcoded "7/7 agents healthy" in Logs Page + Fabricated Fallback

**Severity:** P2 (fabricated telemetry)
**Root cause:** `app/(dashboard)/logs/page.tsx` displayed `"7/7 agents healthy"` hardcoded, and used a fabricated `activeAgents: 7` fallback when no platform data was available.
**File:** `frontend/src/app/(dashboard)/logs/page.tsx`
**Fix:** Badge now reads `${stats.activeAgents}/${stats.totalAgents} agents healthy` from real platform data; fallback computes distinct agent count from actual logs instead of fabricating 7.
**Verification:** Frontend build passes.

#### P2-004: Misleading Analytics Toast + Stale Hardcoded Date

**Severity:** P2 (misleading info)
**Root cause:** `app/(dashboard)/analytics/page.tsx` catch-block showed `"Agent 6 executive report generated (dev mode fallback)"` when the API actually FAILED (no fallback occurred — the report wasn't generated). Also hardcoded `"Today, 25-Jul-2026"` which is now stale.
**File:** `frontend/src/app/(dashboard)/analytics/page.tsx`
**Fix:** Catch-block toast now says `"Report generation failed — could not reach the InsightEngine service."` (error level). Date replaced with `new Date().toLocaleDateString("en-IN", ...)`.
**Verification:** Frontend build passes.

#### P2-005: Misleading Patient Summary Toast + SOAP Error Handling + Missing Confidence Banner

**Severity:** P2 (misleading info / missing safety UX)
**Root cause (3 sub-issues):**
1. `app/(dashboard)/patients/[id]/page.tsx` toast said `"AI Summary re-generated by Agent 6 (InsightEngine)"` but the summary is deterministic (compiled from records, no AI involved).
2. `SOAPNoteEditor.tsx` `executeApproval` unconditionally set `approved=true` and showed "SOAP approved" even when the backend returned `{"error": "safety_check_required"}` or `{"error": "transcript_review_required"}`. Also didn't send `transcript_reviewed` to the backend.
3. `ConsultationWorkspace.tsx` SOAP tab showed no STT confidence tier, warning, or AI provenance — the doctor couldn't see why approval was blocked.

**Files changed:**
- `app/(dashboard)/patients/[id]/page.tsx` — Toast now says `"Patient summary refreshed (deterministic compile from records)."`.
- `components/SOAPNoteEditor.tsx` — Added `transcript_reviewed: transcriptVerified` to approve API call; added `res.data?.error` check to detect backend gate blocks and show the specific reason instead of false "approved"; improved error toast to surface `detail` from backend response; added `transcriptVerified` to `useCallback` deps.
- `components/consultation/ConsultationWorkspace.tsx` — Added confidence/provenance info banner in SOAP tab: shows live/mock execution status, model used, provider, STT confidence %, and orange/amber warning banners for LOW/MODERATE confidence tiers.
**Verification:** Frontend build passes.

### Phase 13 — Final Regression

| Test | Result |
|------|--------|
| Backend `pytest` (full suite) | **81/81 PASSED** (1.98s) |
| Frontend `npm run build` | **PASSED** — 11 routes, 0 type errors, 0 lint errors |

---

## 3. Architecture Verification Summary

| Component | Expected | Actual | Status |
|-----------|----------|--------|--------|
| ClinicalScribe model | `gemini-2.5-pro` | `gemini-2.5-pro` | PASS |
| ClinicalScribe region | `us-central1` | `us-central1` | PASS |
| Fast agents model | `gemini-2.5-flash` | `gemini-2.5-flash` | PASS |
| Fast agents region | `asia-south1` | `asia-south1` | PASS |
| STT provider | Google Cloud Speech-to-Text | Google Cloud Speech-to-Text | PASS |
| Audio processing | FFmpeg | FFmpeg (`close_fds=True`) | PASS |
| Grounding validator | Called in production | `clinical_scribe.py:128` | PASS |
| Deterministic allergen guard | String/keyword match | `_detect_allergen_conflicts` | PASS |
| Fail-closed on LLM unavailable | `is_safe=false, requires_manual_review=true` | Verified in `prescription_safe.py` | PASS |
| Mock fallback gating | Dev + mock-allowed + NOT live | Verified in `gemini.py` + `speech_to_text.py` | PASS |
| SOAP stays DRAFT until approval | Status gate in `approve_consultation` | Verified | PASS |
| AI diagnoses provisional | Grounding validator marks them | Verified | PASS |
| Billing source of truth | `clinic_doc.consultation_fees` | Verified in `billing_pulse.py` | PASS |
| Frontend fees | From API, not hardcoded | `ConsultationWorkspace.tsx` fetches `clinicFees` | PASS |
| Firestore tenant isolation | `clinic_id` claim match | Verified in `firestore.rules` | PASS |
| Auth on API routes | `Depends(get_current_user)` | All 40+ endpoints verified | PASS |
| Internal routes auth | `verify_internal_request` | `APIRouter(dependencies=[...])` | PASS |
| Webhook auth | HMAC-SHA256 signature | WhatsApp + Razorpay verified | PASS |
| gRPC fork safety | Per-PID lazy init | `speech_to_text.py:80-99` | PASS |
| Production config validation | Rejects SQLite + placeholders | `config.py:88-124` | PASS |

---

## 4. P3 Items Noted (Not Fixed — Low Priority)

| ID | Description | File | Recommendation |
|----|-------------|------|----------------|
| P3-001 | Orphaned dead code: `components/operations/` and `components/analytics/` directories not imported by any page — contain hardcoded "7/7 Running", "99/100", "Gemini 2.5 Intelligence" labels that never render | `frontend/src/components/operations/`, `frontend/src/components/analytics/` | Delete or wire up; currently inert |
| P3-002 | Static subtitle "7 agents • Powered by Google Cloud Vertex AI & Gemini 2.5" | `settings/page.tsx:181` | Accurate but static; could derive count from `useAgentHealth` |
| P3-003 | No CORS wildcard guard in production validation | `config.py:88-124` | Add check that `CORS_ORIGINS` doesn't contain `*` when `is_production` |

---

## 5. Limitations — Could Not Verify

| Item | Reason | Impact |
|------|--------|--------|
| Live Gemini 2.5 Pro generation | `GOOGLE_APPLICATION_CREDENTIALS` not set | Grounding validator + SOAP prompt logic verified statically; live LLM output not tested |
| Live Google Cloud STT | Same | STT confidence tier logic verified via unit tests; live transcription not tested |
| Live clinical workflow (`verify_clinical_workflow_live.py`) | Same | End-to-end flow tested via `test_e2e_integration.py` (mock transcript path); live flow not tested |
| Razorpay payment link creation | No Razorpay credentials | Billing invoice creation + Razorpay integration tested via unit tests only |
| WhatsApp message delivery | No WhatsApp credentials | AppointmentFlow + RetentionRadar tested via unit tests only |

**Recommendation:** Run the live verification scripts with GCP credentials before production deployment:
```bash
cd backend && source .venv/bin/activate
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
python ../scripts/verify_gemini_live.py
python ../scripts/run_stt_tests.py
python ../scripts/verify_clinical_workflow_live.py
```

---

## 6. Files Modified This Session

| File | Changes |
|------|---------|
| `backend/agents/clinical_scribe.py` | +`requires_transcript_review`/`transcript_reviewed` in metadata; +low-confidence gate in `approve_consultation`; +`transcript_reviewed` param; +persist on approval |
| `backend/api/consultations.py` | +`transcript_reviewed` field in `ApproveConsultationRequest`; +pass-through to agent |
| `backend/tests/test_safety_gate_regression.py` | +3 regression tests for low-confidence transcript review gate |
| `frontend/src/components/layout/LeftSidebar.tsx` | Replaced hardcoded "7 agents running" with real `useAgentHealth()` data |
| `frontend/src/app/(dashboard)/page.tsx` | Replaced hardcoded "7/7" badge with real platform data |
| `frontend/src/app/(dashboard)/logs/page.tsx` | Replaced hardcoded "7/7 agents healthy" + fabricated fallback with real data |
| `frontend/src/app/(dashboard)/analytics/page.tsx` | Fixed misleading catch-block toast; replaced stale hardcoded date with dynamic |
| `frontend/src/app/(dashboard)/patients/[id]/page.tsx` | Fixed misleading "Agent 6" toast on deterministic summary |
| `frontend/src/components/SOAPNoteEditor.tsx` | +`transcript_reviewed` in approve call; +backend error detection; +specific error toasts; +`transcriptVerified` dep |
| `frontend/src/components/consultation/ConsultationWorkspace.tsx` | +STT confidence/provenance banner in SOAP tab |

---

## 7. Final Verdict

**The VaidyaAI application is structurally sound for its clinical safety requirements.** The core safety architecture — grounding validator, deterministic allergen guard, fail-closed LLM, prescription safety gate, and now the low-confidence transcript review gate — is correctly implemented and wired into production code paths. No fabricated clinical data was found in any reachable production code path. All mock/fallback paths are properly gated behind `is_development AND AI_ALLOW_MOCK_FALLBACK AND NOT LIVE_CLINICAL_AI`.

The 6 defects fixed this session were all in the P1–P2 range (safety gate enforcement + UI telemetry honesty). No P0 clinical data integrity violations were found.

**Outstanding:** Live GCP verification (Gemini, STT, end-to-end clinical workflow) requires service account credentials and should be run before production deployment.

---

## 8. Extended Audit (Continued Pass)

Additional areas verified in a deeper second pass:

| Area | File(s) | Finding | Status |
|------|---------|---------|--------|
| Agent health API — data computation | `api/agent_health.py` | All metrics (tasks_today, failures_today, avg_latency, success_rate, status) derived from real Firestore `agent_logs` queries with IST-day filtering. Models from `config.py`. No hardcoded values. | CLEAN |
| SOAP generation prompt — grounding rules | `prompts/soap_generation.py` | Explicit zero-fabrication rules: no unstated descriptors, no invented vitals (null by default), evidence citation required, diagnoses tagged `is_provisional: true`/`AI_SUGGESTION`, "absence of mention is not absence of finding" stated. Production-ready. | CLEAN |
| InsightEngine — health score fallback | `agents/insight_engine.py:106-114` | Deterministic fallback computed from real metrics (completion_rate, collection_rate, no_show_rate). Uses `GEMINI_REASONING_MODEL` (gemini-2.5-pro). PHI stripped before LLM call. Legitimate. | CLEAN |
| RetentionRadar — mock/fabrication | `agents/retention_radar.py` | No mock, fallback, or fabrication patterns found. | CLEAN |
| ReferralCoordinator — mock/fabrication | `agents/referral_coordinator.py` | No mock, fallback, or fabrication patterns found. | CLEAN |
| Frontend consultation list page | `app/(dashboard)/consultation/page.tsx` | No fabrication or hardcoded telemetry. | CLEAN |
| Frontend patients list page | `app/(dashboard)/patients/page.tsx` | Fetches real data from `/patients` API. No fabrication. | CLEAN |
| Frontend auth — dev bypass gating | `lib/auth.ts` | `isDevAuthBypassEnabled()` requires `NODE_ENV !== "production"` AND `NEXT_PUBLIC_DEV_AUTH_BYPASS=true`. Cannot activate in production. Secure cookie on HTTPS. | CLEAN |
| Frontend route protection | `app/(dashboard)/layout.tsx` | Redirects to `/login` when no user; handles `no_clinic` with onboarding wizard. Client-side gating sound. | CLEAN |
| Grounding validator — field name robustness | `utils/grounding_validator.py:363` | Handles both `blood_pressure`/`bp`, `heart_rate`/`pulse` key variants. Nullifies unrecorded vitals correctly. | CLEAN |
| Live grounding test assertions | `scripts/test_grounded_clinical_pipeline.py` | Asserts BP/pulse null when unrecorded, negative findings documented, penicillin→amoxicillin hard stop. Well-designed verification. | CLEAN |
| Billing page — telemetry | `app/(dashboard)/billing/page.tsx` | No fabricated telemetry. "Agent 3" subtitle is a static label, not a health claim. | CLEAN |

**Extended audit verdict: No additional defects found.** The architecture is consistent end-to-end — STT confidence flows from real Cloud Speech-to-Text responses through grounding validation, metadata persistence, the approval gate, and frontend display. All agent metrics are computed from real Firestore data. All LLM calls use the correct models from centralized config.

### Additional Fixes (Continued Pass 2)

#### P2-006: Hardcoded Doctor Name in Referral Letter Fallback

**Severity:** P2 (fabricated data)
**Root cause:** `agents/referral_coordinator.py` fallback referral letter hardcoded `"Thank you,\nDr. Ramesh"` when the LLM didn't return a formal letter. This fabricates the wrong doctor's name.
**Fix:** Now fetches the real `doctor_name` from the Firestore `clinics` document and uses it in the fallback.
**Verification:** 81/81 backend tests pass.

#### P2-007: Hardcoded Doctor Name in Billing PG Auto-Create

**Severity:** P2 (fabricated data)
**Root cause:** `agents/billing_pulse.py` auto-create fallback for the PostgreSQL `Clinic` record hardcoded `"Dr. Vinay Sharma"` and `"VaidyaAI Test Clinic"` instead of using the real clinic data from Firestore.
**Fix:** Now pulls `name`, `doctor_name`, and `phone` from the already-fetched Firestore `clinic_doc` for the PG auto-create.
**Verification:** 81/81 backend tests pass.

#### P2-008: Missing Provisional Label on ICD-10 Diagnoses in Consultation Workspace

**Severity:** P2 (clinical safety UX)
**Root cause:** `ConsultationWorkspace.tsx` displayed ICD-10 diagnoses without the "PROVISIONAL" label, while `SOAPNoteEditor.tsx` correctly labeled them. Inconsistent — the doctor could miss that diagnoses are AI-suggested.
**Fix:** Added provisional ring + "PROVISIONAL" text to diagnosis badges in ConsultationWorkspace, matching the SOAPNoteEditor pattern.
**Verification:** Frontend build passes.

#### Verified Clean (Continued Pass 2):

| Area | Finding | Status |
|------|---------|--------|
| Approval → Billing trigger | `approve_consultation` correctly triggers BillingPulseAgent, marks appointment completed, logs decision. Skips billing for masked phones. | CLEAN |
| Event bus wiring | `WorkflowOrchestrator.register_all()` wires 7 subscriptions with explicit ordering (PrescriptionSafe before ReferralCoordinator), max retries, idempotent registration. Complete workflow chain. | CLEAN |
| Frontend provisional diagnosis display | SOAPNoteEditor shows "AI SUGGESTION / PROVISIONAL" label. ConsultationWorkspace now fixed (P2-008). | CLEAN |
| InsightEngine doctor/clinic name | Fetches `doctor_name` and `clinic_name` from Firestore `clinics` doc. No fabrication. | CLEAN |

---

## 9. Final Defect Summary (All Sessions)

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| P1-001 | P1 | Low-confidence transcript review gate not enforced at approval | FIXED + 3 tests |
| P2-001 | P2 | Hardcoded "7 agents running" in LeftSidebar | FIXED |
| P2-002 | P2 | Hardcoded "7/7" badge on dashboard | FIXED |
| P2-003 | P2 | Hardcoded "7/7 agents healthy" + fabricated fallback in logs page | FIXED |
| P2-004 | P2 | Misleading analytics toast + stale hardcoded date | FIXED |
| P2-005 | P2 | Misleading patient summary toast + SOAP error handling + missing confidence banner | FIXED |
| P2-006 | P2 | Hardcoded "Dr. Ramesh" in referral letter fallback | FIXED |
| P2-007 | P2 | Hardcoded "Dr. Vinay Sharma" in billing PG auto-create | FIXED |
| P2-008 | P2 | Missing PROVISIONAL label on ICD-10 diagnoses in ConsultationWorkspace | FIXED |
| P3-001 | P3 | Orphaned dead code (operations/analytics components) | NOTED |
| P3-002 | P3 | Static "7 agents" subtitle in settings | NOTED |
| P3-003 | P3 | No CORS wildcard guard in production validation | NOTED |

**Total: 9 defects fixed (1 P1 + 8 P2), 3 P3 noted. 0 P0 clinical data integrity violations found.**
