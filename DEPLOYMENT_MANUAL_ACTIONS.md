# VaidyaAI — Deployment Manual Actions (Credentials & Secrets)

This file lists every credential, secret, and manual step that **only a human with the
correct accounts can complete**. The automated pipeline cannot and must not fabricate these.

> **IMPORTANT**: The backend refuses to start in production until every item below is
> configured (fail-closed). Do not attempt to deploy the new image until all secrets are set.

---

## 1. Required secrets (must be set before production deploy)

The production config validator (`config.validate_production()`) refuses to start if any of
these is unset or still a placeholder. Set each one in **Google Cloud Secret Manager**
(`gcloud secrets create <NAME> --data-file=-`) and reference it from the Cloud Run service,
**or** set it as a Cloud Run environment variable.

| # | Secret / Env var | Purpose | Where to get it |
|---|---|---|---|
| 1 | `INTERNAL_TASK_SECRET` | Authenticates Cloud Tasks / Scheduler → `/internal/*` calls | Generate a long random string: `openssl rand -hex 32` |
| 2 | `WHATSAPP_PHONE_ID` | WhatsApp Business API phone number ID | Meta WhatsApp Business dashboard |
| 3 | `WHATSAPP_ACCESS_TOKEN` | WhatsApp Business API access token | Meta WhatsApp Business dashboard |
| 4 | `WHATSAPP_APP_SECRET` | WhatsApp webhook signature verification | Meta App dashboard |
| 5 | `RAZORPAY_KEY_ID` | Razorpay payment link creation | Razorpay dashboard |
| 6 | `RAZORPAY_KEY_SECRET` | Razorpay API authentication | Razorpay dashboard |
| 7 | `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook signature verification | Razorpay dashboard → Webhooks |
| 8 | `BACKEND_URL` | Public HTTPS URL of the backend (for links in messages) | `https://vaidyaai-backend-<PROJECT_NUMBER>.asia-south1.run.app` |

### How to set a secret in Secret Manager

```bash
export PROJECT_ID=vaidyaai-xprize
# Example for INTERNAL_TASK_SECRET
printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create INTERNAL_TASK_SECRET \
  --project=$PROJECT_ID --data-file=- --replication-policy=automatic
```

Then reference it from Cloud Run:

```bash
gcloud run services update vaidyaai-backend \
  --project=$PROJECT_ID --region=asia-south1 \
  --set-secrets=INTERNAL_TASK_SECRET=INTERNAL_TASK_SECRET:latest
```

Repeat for each of the 8 secrets above.

---

## 2. Firebase Admin SDK / service account

The backend uses **Application Default Credentials (ADC)** to talk to Firestore, Vertex AI,
Cloud SQL, Cloud Storage, and Cloud Tasks. On Cloud Run this is the service account
`vaidyaai-backend@vaidyaai-xprize.iam.gserviceaccount.com`, which already has the required
roles (verified). No action needed unless the service account is recreated.

For **local development**, run:

```bash
gcloud auth application-default login
```

---

## 3. Firebase project / auth

- Firebase project: `vaidyaai-xprize` (already configured).
- The frontend needs the Firebase web config in `frontend/.env.local`:
  `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.
- These are **public** (safe for the browser) but must be the real values from the Firebase
  console, not placeholders.

---

## 4. Vertex AI / Gemini

- `GOOGLE_GENAI_USE_VERTEXAI=true`, `LIVE_CLINICAL_AI=true`, `AI_ALLOW_MOCK_FALLBACK=false`
  (already set on the deployed service).
- The service account needs `roles/aiplatform.user` (already granted, verified).
- Both `gemini-2.5-pro` (us-central1) and `gemini-2.5-flash` (asia-south1) were verified
  live in this session (both returned `PONG`).

---

## 5. Cloud SQL (PostgreSQL)

- Instance: `vaidyaai-postgres` (POSTGRES_15, asia-south1-c), database `vaidyaai_db`.
- `DATABASE_URL` secret must point to it, e.g.:
  `postgresql+asyncpg://<user>:<password>@<PRIVATE_IP>/vaidyaai_db`
- The service account has `roles/cloudsql.client` (verified).
- **Manual**: run `alembic upgrade head` against the production DB before first deploy of
  the new image (schema is owned by migrations in non-dev environments).

---

## 6. Cloud Tasks queues

- Queues `appointment-reminders`, `billing-followups`, `retention-outreach` exist and are
  RUNNING (verified). No action needed.

---

## 7. Frontend deployment

- The frontend is deployed via `infrastructure/frontend-cloudbuild.yaml` to Cloud Run.
- `NEXT_PUBLIC_*` values are baked in at **build** time. The pipeline reads them from Cloud
  Build substitutions. You must supply the real Firebase web config at submit time:
  `_BACKEND_URL`, `_FIREBASE_API_KEY`, `_FIREBASE_AUTH_DOMAIN`, `_FIREBASE_PROJECT_ID`,
  `_FIREBASE_STORAGE_BUCKET`, `_FIREBASE_MESSAGING_SENDER_ID`, `_FIREBASE_APP_ID`,
  `_FIREBASE_MEASUREMENT_ID`.
- These are **public** (safe for the browser) but must be the real values from the Firebase
  console, not placeholders.
- `NEXT_PUBLIC_DEV_AUTH_BYPASS` is hard-set to `false` in the pipeline.

---

## 8. Judge / demo account

- Create a Firebase Auth user for the judge (phone-based) and assign the `doctor` role with
  `clinic_id` set to the demo clinic, so the judge can log in via the real Firebase flow.
- This is a manual Firebase console / Admin SDK action.

---

## 9. Post-deploy smoke test (manual confirmation)

After the new image is deployed, confirm:

```bash
curl -s https://vaidyaai-backend-<PROJECT_NUMBER>.asia-south1.run.app/health
# expect: status ok, environment production, firestore online, postgres online, vertex online
```

---

## Summary of what is BLOCKED on human action

1. Set the **8 secrets** (Section 1) — otherwise the new image will not start in production.
2. Run **`alembic upgrade head`** on the production DB.
3. Provide the **real Firebase web config** for the frontend build.
4. Create the **judge Firebase account**.
5. Confirm the **post-deploy smoke test**.
