# VaidyaAI — Hackathon Evidence Checklist

> Last updated: 2026-08-09 | Status: Pre-submission audit

---

## A. Repository

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | GitHub repository ready | ⬜ MANUAL | Share with testing@devpost.com and judging@hacker.fund |
| 2 | README complete | ✅ VERIFIED | Comprehensive README.md present (40KB) |
| 3 | Architecture documented | ✅ VERIFIED | VaidyaAI_TECHNICAL_ARCHITECTURE_v2.md present |
| 4 | Setup instructions verified | ⬜ MANUAL | Run setup on clean environment to verify |
| 5 | No secrets committed | ⚠️ CHECK | `.env` exists in backend/ — verify it is in .gitignore |
| 6 | .gitignore covers .env files | ⬜ VERIFY | Check `.gitignore` includes `.env`, `.env.local` |
| 7 | test.db not committed | ⚠️ CHECK | `test.db` exists in root AND backend/ — should be gitignored |

---

## B. AI Production Evidence

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Gemini 2.5 Pro live execution | ⬜ UNVERIFIED | Requires live Vertex AI credentials + actual consultation |
| 2 | Gemini 2.5 Flash live execution | ⬜ UNVERIFIED | Requires live Vertex AI credentials + WhatsApp message |
| 3 | Agent decision logs in Firestore | ⬜ UNVERIFIED | Run consultations → check `agent_logs` collection |
| 4 | API request/response logs | ⬜ UNVERIFIED | Check Cloud Logging in GCP console |
| 5 | Model provenance in SOAP metadata | ✅ VERIFIED (code) | `scribe_metadata.model_used` populated from `settings.GEMINI_REASONING_MODEL` |
| 6 | Execution timestamps | ✅ VERIFIED (code) | `created_at`, `generated_at` use `datetime.now(timezone.utc)` |
| 7 | Error logs | ✅ VERIFIED (code) | Structured logging with `logging.getLogger()` + Cloud Logging |
| 8 | Audit trail | ✅ VERIFIED (code) | `AgentLogger.log_decision()` dual-writes to Cloud Logging + Firestore |
| 9 | Fail-closed behavior verified | ✅ VERIFIED (code) | `GeminiService.generate()` raises RuntimeError in non-dev environments |
| 10 | Mock fallback disabled in production | ✅ VERIFIED (code) | `settings.is_development` gate on all mock paths |

---

## C. Business Evidence

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Real users acquired | ⬜ MANUAL | [INSERT VERIFIED USER COUNT] |
| 2 | Revenue during hackathon | ⬜ MANUAL | [INSERT VERIFIED REVENUE] |
| 3 | Stripe/Razorpay dashboard export | ⬜ MANUAL | Export from Razorpay dashboard |
| 4 | Simple P&L | ⬜ MANUAL | Use BillingPulse daily P&L + manual expense tracking |
| 5 | Expenses breakdown | ⬜ MANUAL | Infrastructure, APIs, AI usage, Marketing |
| 6 | Marketing/customer acquisition spend | ⬜ MANUAL | Must disclose even if zero |
| 7 | Customer evidence | ⬜ MANUAL | Contact info, testimonials (only if legitimately obtained) |
| 8 | Corporate ID | ⬜ MANUAL | If available |

---

## D. Video

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | 3-minute recording | ⬜ MANUAL | See HACKATHON_VIDEO_PLAN.md for script |
| 2 | Real AI execution shown | ⬜ MANUAL | Must show live Gemini call, not development mock |
| 3 | Clinical workflow demonstrated | ⬜ MANUAL | Patient → Consultation → SOAP → Prescription → Billing |
| 4 | Human-in-the-loop visible | ⬜ MANUAL | Doctor editing SOAP, reviewing safety, approving |
| 5 | Agent dashboard visible | ⬜ MANUAL | Settings → AI Agents tab with real metrics |
| 6 | Audit evidence visible | ⬜ MANUAL | Settings → Audit Trail tab with real logs |
| 7 | Model provenance banner shown | ⬜ MANUAL | ClinicalScribe metadata banner in SOAP editor |

---

## E. Deployment

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Production backend URL | ⬜ MANUAL | Set `BACKEND_URL` env var to Cloud Run URL |
| 2 | Production frontend URL | ⬜ MANUAL | Deploy frontend with `NEXT_PUBLIC_BACKEND_URL` pointing to production backend |
| 3 | Backend health endpoint | ⬜ VERIFY | `GET /health` must return real service statuses |
| 4 | Vertex AI configured | ⬜ MANUAL | Verify Application Default Credentials on Cloud Run |
| 5 | Firestore configured | ⬜ MANUAL | Verify Firestore rules and indexes deployed |
| 6 | PostgreSQL configured | ⬜ MANUAL | Set `DATABASE_URL` to Cloud SQL PostgreSQL |
| 7 | Razorpay configured | ⬜ MANUAL | Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| 8 | WhatsApp configured | ⬜ MANUAL | Set `WHATSAPP_PHONE_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET` |
| 9 | CORS configured | ⬜ MANUAL | Set `CORS_ORIGINS` to production frontend domain |
| 10 | Cloud Logging active | ⬜ VERIFY | Set `ENVIRONMENT=production` on Cloud Run |
| 11 | Secrets not in env files | ⬜ VERIFY | Use Secret Manager or Cloud Run secrets |
| 12 | ENVIRONMENT=production set | ⬜ MANUAL | Required for fail-closed behavior and config validation |

---

## F. Written Submission

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | 500-1000 word narrative | ✅ DRAFTED | HACKATHON_NARRATIVE_DRAFT.md — requires verified data |
| 2 | Revenue evidence mentioned | ⬜ MANUAL | Fill in [INSERT VERIFIED REVENUE] placeholder |
| 3 | Expense disclosure | ⬜ MANUAL | Fill in expense breakdown |
| 4 | Jobs/economic opportunities | ✅ DRAFTED | Covered in narrative |
| 5 | AI day-to-day usage explained | ✅ DRAFTED | All 7 agents described |
| 6 | Human vs AI roles clear | ✅ DRAFTED | Doctor role explicitly defined |

---

## Pre-Submission Manual Actions

1. **Deploy backend to Cloud Run** with `ENVIRONMENT=production` and all real secrets
2. **Deploy frontend** with `NEXT_PUBLIC_BACKEND_URL` pointing to Cloud Run backend
3. **Run 3-5 real consultations** to populate agent logs and billing data
4. **Screenshot agent dashboard** (Settings → AI Agents) showing real execution metrics
5. **Screenshot audit trail** showing real agent decision logs
6. **Export Razorpay dashboard** if payments have been processed
7. **Record 3-minute video** following HACKATHON_VIDEO_PLAN.md
8. **Fill in placeholders** in HACKATHON_NARRATIVE_DRAFT.md with verified data
9. **Share GitHub repo** with testing@devpost.com and judging@hacker.fund
10. **Verify .gitignore** covers `.env`, `.env.local`, `test.db`, `*.db`
