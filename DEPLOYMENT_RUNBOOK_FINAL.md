# VaidyaAI — Final Deployment Runbook (Google Cloud)

Authoritative repo: `/Volumes/Extreme SSD/VaidyaAI_FINAL_VALIDATION/Vaidyaai` (branch `main`).

This runbook reflects the **actual, verified** GCP state (project `vaidyaai-xprize`, region
`asia-south1`, Artifact Registry repo `vaidyaai-docker-repo`). It supersedes the older
`RUNBOOK_LOCAL_AND_GCP.md`, which referenced the wrong repo name (`vaidyaai-repo`) and a
different project (`vaidyaai-prod`).

> **Before you deploy**: complete every item in `DEPLOYMENT_MANUAL_ACTIONS.md`. The backend
> **refuses to start in production** until all 8 secrets are configured (fail-closed).

---

## 0. Verified GCP state (this session)

| Resource | Value | Status |
|---|---|---|
| Project | `vaidyaai-xprize` | exists, accessible |
| Region | `asia-south1` | — |
| Artifact Registry repo | `vaidyaai-docker-repo` | exists |
| Cloud Run service | `vaidyaai-backend` | deployed (stale image) |
| Cloud SQL instance | `vaidyaai-postgres` (POSTGRES_15) | RUNNABLE |
| Cloud SQL database | `vaidyaai_db` | exists |
| Cloud Tasks queues | `appointment-reminders`, `billing-followups`, `retention-outreach` | RUNNING |
| Secret Manager | `DATABASE_URL` | exists |
| Backend SA | `vaidyaai-backend@vaidyaai-xprize.iam.gserviceaccount.com` | has required roles |
| Deployed backend URL | `https://vaidyaai-backend-353775352272.asia-south1.run.app` | live, `env: production` |

---

## 1. Prerequisites

```bash
export GCP_PROJECT_ID=vaidyaai-xprize
export REGION=asia-south1
gcloud config set project "$GCP_PROJECT_ID"
gcloud auth configure-docker "${REGION}-docker.pkg.dev"
```

---

## 2. Set the 8 required secrets (BLOCKED on human action)

See `DEPLOYMENT_MANUAL_ACTIONS.md` §1. The validator requires:
`INTERNAL_TASK_SECRET`, `WHATSAPP_PHONE_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`,
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `BACKEND_URL`.

Example (one secret):

```bash
printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create INTERNAL_TASK_SECRET \
  --project=$GCP_PROJECT_ID --data-file=- --replication-policy=automatic
```

---

## 3. Run Alembic migrations on the production DB

Schema is owned by migrations in non-dev environments.

```bash
cd "/Volumes/Extreme SSD/VaidyaAI_FINAL_VALIDATION/Vaidyaai/backend"
source .venv/bin/activate
# Point DATABASE_URL at the production Cloud SQL instance, then:
alembic upgrade head
```

---

## 4. Deploy the backend (Cloud Build)

```bash
cd "/Volumes/Extreme SSD/VaidyaAI_FINAL_VALIDATION/Vaidyaai"
gcloud builds submit --config=backend/cloudbuild.yaml .
```

The pipeline builds, pushes to `asia-south1-docker.pkg.dev/vaidyaai-xprize/vaidyaai-docker-repo/vaidyaai-backend`,
and deploys to Cloud Run `vaidyaai-backend`.

### Attach secrets + env + Cloud SQL

```bash
gcloud run services update vaidyaai-backend --region="$REGION" \
  --add-cloudsql-instances="${GCP_PROJECT_ID}:${REGION}:vaidyaai-postgres" \
  --set-env-vars="ENVIRONMENT=production,GOOGLE_CLOUD_PROJECT=${GCP_PROJECT_ID},GCP_REGION=${REGION},FIREBASE_PROJECT_ID=${GCP_PROJECT_ID},GOOGLE_GENAI_USE_VERTEXAI=true,LIVE_CLINICAL_AI=true,AI_ALLOW_MOCK_FALLBACK=false" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,INTERNAL_TASK_SECRET=INTERNAL_TASK_SECRET:latest,WHATSAPP_PHONE_ID=WHATSAPP_PHONE_ID:latest,WHATSAPP_ACCESS_TOKEN=WHATSAPP_ACCESS_TOKEN:latest,WHATSAPP_APP_SECRET=WHATSAPP_APP_SECRET:latest,RAZORPAY_KEY_ID=RAZORPAY_KEY_ID:latest,RAZORPAY_KEY_SECRET=RAZORPAY_KEY_SECRET:latest,RAZORPAY_WEBHOOK_SECRET=RAZORPAY_WEBHOOK_SECRET:latest,BACKEND_URL=BACKEND_URL:latest"
```

---

## 5. Deploy the frontend

`NEXT_PUBLIC_*` values are baked in at **build** time. The pipeline reads them from Cloud
Build substitutions. Set them at submit time:

```bash
cd "/Volumes/Extreme SSD/VaidyaAI_FINAL_VALIDATION/Vaidyaai"
BACKEND_URL=$(gcloud run services describe vaidyaai-backend --region="$REGION" --format='value(status.url)')
gcloud builds submit --config=infrastructure/frontend-cloudbuild.yaml \
  --substitutions="_BACKEND_URL=${BACKEND_URL},_FIREBASE_API_KEY=<KEY>,_FIREBASE_AUTH_DOMAIN=<DOMAIN>,_FIREBASE_PROJECT_ID=vaidyaai-xprize,_FIREBASE_STORAGE_BUCKET=<BUCKET>,_FIREBASE_MESSAGING_SENDER_ID=<SENDER>,_FIREBASE_APP_ID=<APPID>,_FIREBASE_MEASUREMENT_ID=<MEAS>" .
```

`NEXT_PUBLIC_DEV_AUTH_BYPASS` is hard-set to `false` in the pipeline (never enable it in
production). The Firebase web config values are **public** (safe for the browser) but must be
the real values from the Firebase console.

---

## 6. Wire CORS

```bash
FRONTEND_URL=$(gcloud run services describe vaidyaai-frontend --region="$REGION" --format='value(status.url)')
gcloud run services update vaidyaai-backend --region="$REGION" \
  --update-env-vars="CORS_ORIGINS=${FRONTEND_URL}"
```

---

## 7. Post-deploy smoke test

```bash
BACKEND_URL=$(gcloud run services describe vaidyaai-backend --region="$REGION" --format='value(status.url)')
curl -i "$BACKEND_URL/health"                       # 200, env production, firestore/postgres/vertex online
curl -i "$BACKEND_URL/livez"                        # 200 {"status":"alive"}
curl -i "$BACKEND_URL/readyz"                       # 200 {"status":"ready",...}
# Production MUST reject dev tokens:
curl -i -H "Authorization: Bearer dev_mock_id_token" \
     "$BACKEND_URL/api/v1/patients?clinic_id=cln_e2e_test_clinic"
# MUST be 401/403. A 200 here is a critical security failure.
```

---

## 8. Do NOT do these

- Do **not** run `scripts/seed_demo_data.py` against production — it refuses, and synthetic
  patients must never enter a real clinical database.
- Do **not** set `ENVIRONMENT=development` on Cloud Run — that re-enables the dev auth bypass
  and the in-memory document store.
- Do **not** commit `.env`, service-account JSON, or any real key.
- Do **not** deploy with placeholder secrets — the service will fail closed (by design).
