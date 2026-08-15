# VaidyaAI — Local Test Runbook & Google Cloud Deployment

Repo: `/Volumes/Extreme SSD/VaidyaAI_FINAL_VALIDATION/Vaidyaai` (branch `main`, commit `cbef06a`)

---

# PART A — Run and validate locally

## A0. One-time: pick the repo and activate the venv

```bash
cd "/Volumes/Extreme SSD/VaidyaAI_FINAL_VALIDATION/Vaidyaai"
source backend/.venv/bin/activate
```

## A1. Reset to a clean, known demo state

```bash
cd "/Volumes/Extreme SSD/VaidyaAI_FINAL_VALIDATION/Vaidyaai"
source backend/.venv/bin/activate
python scripts/seed_demo_data.py --reset
```

Expect: `10 patients, 19 appointments, 14 consultations, 1 referrals`, `7 agent decision logs`,
`5 invoices created`. All records are synthetic (`data_source=SYNTHETIC_DEMO`).

## A2. Free the ports (only if something is already listening)

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
lsof -nP -iTCP:3000 -sTCP:LISTEN
# kill the PID printed in the second column, e.g.:  kill 80540
```

## A3. Start the backend — terminal 1

```bash
cd "/Volumes/Extreme SSD/VaidyaAI_FINAL_VALIDATION/Vaidyaai/backend"
source .venv/bin/activate
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Health check from another terminal:

```bash
curl -i http://127.0.0.1:8000/health          # expect 200
open http://127.0.0.1:8000/docs               # interactive API docs
```

## A4. Start the frontend — terminal 2

```bash
cd "/Volumes/Extreme SSD/VaidyaAI_FINAL_VALIDATION/Vaidyaai/frontend"
npm run dev
```

Open **http://localhost:3000** — you must use `localhost`, not `127.0.0.1`.
The development auth bypass is deliberately gated to hostname `localhost` **and**
`NODE_ENV !== production`, so `127.0.0.1` and production builds show the phone-login screen
instead of auto-signing you in. That gate is a security control — do not remove it.

## A5. Click-through validation (this is the part to do by hand)

| # | Action | Expected |
|---|---|---|
| 1 | Open `/` | Today's Queue, 5 patients, AI Health 7/7 |
| 2 | `/patients` | 10 patients; 5 show "Today", 5 show real past dates; allergy chips visible |
| 3 | `/patients/pat_004` (Ramesh Sharma) | 3 visits, LAST VISIT 17/5/2026, ALLERGY ALERT (penicillin), SOAP note, Balance = "See Billing" |
| 4 | **Start Consultation** on a queued patient | Consultation workspace opens with the correct patient in context |
| 5 | In the workspace: record/paste a note → generate SOAP | ClinicalScribe returns S/O/A/P + ICD-10 (~15-35 s, live Gemini) |
| 6 | Add a medication → Save → reload the page | Medication persists after reload |
| 7 | On `pat_001` or `pat_004`, prescribe **Amoxicillin** (penicillin class) | PrescriptionSafe must **warn/block** — if it silently allows, stop and report it |
| 8 | Generate the invoice | BillingPulse invoice amount matches the estimate |
| 9 | Create a referral | ReferralCoordinator returns a referral id and urgency |
| 10 | Open `/logs` in a second tab, then check a patient in from tab 1 | A live `queue_updated` entry appears in the Decision Feed ("Just now") |
| 11 | `/billing` | New invoice appears; totals update |
| 12 | `/analytics` | Decision counts and the 7-agent table update |
| 13 | Patient A → B → A | No stale data from the previous patient anywhere |

Step 6 and step 7 are the two flows that were **not** machine-verified — do those manually.

## A6. Automated proof of all 7 agents (no clicking)

```bash
cd "/Volumes/Extreme SSD/VaidyaAI_FINAL_VALIDATION/Vaidyaai"
source backend/.venv/bin/activate
python scripts/e2e_demo_test.py
```

Expect `ALL 7 AI AGENTS OPERATIONAL`, 7/7 PASS, roughly 65-95 s total (real Vertex AI calls).
This covers AppointmentFlow, ClinicalScribe, PrescriptionSafe, BillingPulse,
ReferralCoordinator, InsightEngine. **RetentionRadar is not in that script** — run it with:

```bash
cd "/Volumes/Extreme SSD/VaidyaAI_FINAL_VALIDATION/Vaidyaai/backend"
source .venv/bin/activate
python - <<'PY'
import asyncio, sys; sys.path.insert(0, ".")
from agents.retention_radar import RetentionRadarAgent
asyncio.run(RetentionRadarAgent().scan_and_run_daily_outreach("cln_e2e_test_clinic"))
PY
```

Note: the E2E script creates extra `VDY-20260815-10xx` invoices. Re-run A1 with `--reset`
before demoing to get back to the clean labelled dataset.

## A7. Test / build gates

```bash
cd backend && source .venv/bin/activate && python -m pytest tests -q   # 183 passed
cd ../frontend && npx tsc --noEmit                                     # 0 errors
cd ../frontend && npm run build                                        # exit 0
```

## A8. Production-mode frontend locally (login screen only)

```bash
cd "/Volumes/Extreme SSD/VaidyaAI_FINAL_VALIDATION/Vaidyaai/frontend"
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
cd .next/standalone && PORT=3000 HOSTNAME=127.0.0.1 node server.js
```

The dev bypass is off here by design; you need real Firebase phone auth to sign in.

## A9. Stop everything

```bash
pkill -f "uvicorn main:app"
pkill -f "next dev"
```

---

# PART B — Google Cloud deployment

## B0. What already exists in the repo

| Artifact | Purpose |
|---|---|
| `backend/Dockerfile` | Backend container |
| `frontend/Dockerfile` | Frontend container (Next.js standalone) |
| `backend/cloudbuild.yaml` | Cloud Build → Artifact Registry → Cloud Run (backend) |
| `scripts/deploy.sh` | Manual deploy of backend and/or frontend to Cloud Run |
| `firestore.rules`, `firestore.indexes.json`, `storage.rules` | Firebase security rules |
| `infrastructure/` | Additional infra assets |

Default region in these files is **`asia-south1`**; default project id is **`vaidyaai-prod`**.

## B1. Set your project and enable APIs

```bash
export GCP_PROJECT_ID="your-project-id"     # e.g. vaidyaai-prod
export REGION="asia-south1"

gcloud auth login
gcloud config set project "$GCP_PROJECT_ID"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  speech.googleapis.com \
  cloudtasks.googleapis.com \
  logging.googleapis.com
```

## B2. Artifact Registry

```bash
gcloud artifacts repositories create vaidyaai-repo \
  --repository-format=docker --location="$REGION" \
  --description="VaidyaAI containers"

gcloud auth configure-docker "${REGION}-docker.pkg.dev"
```

## B3. Service account and IAM

```bash
gcloud iam service-accounts create vaidyaai-backend \
  --display-name="VaidyaAI Backend"

SA="vaidyaai-backend@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

for ROLE in \
  roles/aiplatform.user \
  roles/datastore.user \
  roles/cloudsql.client \
  roles/secretmanager.secretAccessor \
  roles/cloudtasks.enqueuer \
  roles/logging.logWriter \
  roles/speech.client
do
  gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="serviceAccount:${SA}" --role="$ROLE"
done
```

## B4. Firestore + Firebase rules

```bash
gcloud firestore databases create --location="$REGION"

# Requires the Firebase CLI (npm i -g firebase-tools) — not installed on this machine yet
firebase deploy --only firestore:rules,firestore:indexes,storage --project "$GCP_PROJECT_ID"
```

## B5. Cloud SQL (PostgreSQL) — required in production

Production **rejects SQLite**: `backend/config.py` fails closed if `DATABASE_URL` starts with
`sqlite`. Create a managed Postgres instance:

```bash
gcloud sql instances create vaidyaai-pg \
  --database-version=POSTGRES_15 --cpu=2 --memory=4GB --region="$REGION"

gcloud sql databases create vaidyaai --instance=vaidyaai-pg
gcloud sql users create vaidyaai --instance=vaidyaai-pg --prompt-for-password
```

Then run migrations against it (Alembic config lives in `backend/alembic`).

## B6. Secrets — never bake these into an image or a commit

Create one secret per credential and grant the service account access:

```bash
for NAME in DATABASE_URL INTERNAL_TASK_SECRET JWT_SECRET \
            WHATSAPP_PHONE_ID WHATSAPP_ACCESS_TOKEN WHATSAPP_APP_SECRET \
            RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET
do
  gcloud secrets create "$NAME" --replication-policy=automatic 2>/dev/null || true
  gcloud secrets add-iam-policy-binding "$NAME" \
    --member="serviceAccount:${SA}" --role=roles/secretmanager.secretAccessor
done
```

Add each value **interactively** so it never lands in your shell history or a file:

```bash
gcloud secrets versions add DATABASE_URL --data-file=-
# paste the value, then press Ctrl-D
```

`DATABASE_URL` format:
`postgresql+asyncpg://vaidyaai:<PASSWORD>@/vaidyaai?host=/cloudsql/<PROJECT>:<REGION>:vaidyaai-pg`

## B7. Deploy the backend

Option 1 — Cloud Build (recommended, uses the committed pipeline):

```bash
cd "/Volumes/Extreme SSD/VaidyaAI_FINAL_VALIDATION/Vaidyaai"
gcloud builds submit --config=backend/cloudbuild.yaml .
```

Option 2 — the repo's script:

```bash
GCP_PROJECT_ID="$GCP_PROJECT_ID" ./scripts/deploy.sh backend
```

Then attach environment, secrets and Cloud SQL to the service:

```bash
gcloud run services update vaidyaai-backend --region="$REGION" \
  --add-cloudsql-instances="${GCP_PROJECT_ID}:${REGION}:vaidyaai-pg" \
  --set-env-vars="ENVIRONMENT=production,GCP_PROJECT_ID=${GCP_PROJECT_ID},GCP_REGION=${REGION}" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,INTERNAL_TASK_SECRET=INTERNAL_TASK_SECRET:latest,JWT_SECRET=JWT_SECRET:latest,WHATSAPP_PHONE_ID=WHATSAPP_PHONE_ID:latest,WHATSAPP_ACCESS_TOKEN=WHATSAPP_ACCESS_TOKEN:latest,WHATSAPP_APP_SECRET=WHATSAPP_APP_SECRET:latest,RAZORPAY_KEY_ID=RAZORPAY_KEY_ID:latest,RAZORPAY_KEY_SECRET=RAZORPAY_KEY_SECRET:latest"

BACKEND_URL=$(gcloud run services describe vaidyaai-backend --region="$REGION" --format='value(status.url)')
echo "$BACKEND_URL"
curl -i "$BACKEND_URL/health"
```

**Production fails closed on misconfiguration.** If any required secret is a placeholder, the
service refuses to start and logs exactly which key is wrong — that is intended. Check with:

```bash
gcloud run services logs read vaidyaai-backend --region="$REGION" --limit=50
```

## B8. Deploy the frontend

```bash
cd "/Volumes/Extreme SSD/VaidyaAI_FINAL_VALIDATION/Vaidyaai"

gcloud builds submit --tag "${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/vaidyaai-repo/vaidyaai-frontend:latest" ./frontend

gcloud run deploy vaidyaai-frontend \
  --image="${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/vaidyaai-repo/vaidyaai-frontend:latest" \
  --region="$REGION" --platform=managed --allow-unauthenticated \
  --memory=1Gi --cpu=1 --min-instances=1 \
  --set-env-vars="NEXT_PUBLIC_BACKEND_URL=${BACKEND_URL},NEXT_PUBLIC_DEV_AUTH_BYPASS=false"
```

`NEXT_PUBLIC_*` values are baked in at **build** time by Next.js. If the backend URL is not
correct at build time, pass it as a build arg in `frontend/Dockerfile` or rebuild after the
backend URL is known.

**`NEXT_PUBLIC_DEV_AUTH_BYPASS` must be `false` in production.** It is already double-gated in
code (`NODE_ENV` + hostname `localhost`), but set it explicitly anyway.

## B9. Wire CORS back to the frontend

```bash
FRONTEND_URL=$(gcloud run services describe vaidyaai-frontend --region="$REGION" --format='value(status.url)')

gcloud run services update vaidyaai-backend --region="$REGION" \
  --update-env-vars="CORS_ORIGINS=${FRONTEND_URL}"
```

## B10. Post-deploy smoke test

```bash
curl -i "$BACKEND_URL/health"                       # 200
curl -i "$BACKEND_URL/docs"                         # 200
curl -i -H "Authorization: Bearer dev_mock_id_token" \
     "$BACKEND_URL/api/v1/patients?clinic_id=cln_e2e_test_clinic"
# MUST be 401/403 — production rejects dev_* tokens. A 200 here is a critical security failure.
open "$FRONTEND_URL"                                # phone-login screen, no auto-login
```

## B11. Do NOT do these

- Do **not** run `scripts/seed_demo_data.py` against production — it refuses, and synthetic
  patients must never enter a real clinical database.
- Do **not** set `ENVIRONMENT=development` on Cloud Run — that would re-enable the dev auth
  bypass path and the in-memory document store.
- Do **not** commit `.env`, service-account JSON, or any real key. `.gitignore` already covers
  the env files.

---

# Gaps to close before a real production launch

1. **Firebase Admin credentials** are unconfigured — required for real phone auth.
2. **WhatsApp is a development mock** (`DEVELOPMENT_MOCK`). Real Meta Cloud API credentials are
   needed before claiming a live WhatsApp channel.
3. **Cloud Tasks queue** is unconfigured in dev (`unconfigured_dev`); create the queue and set
   its name before relying on scheduled outreach.
4. **Alembic migrations have not been run against a real Postgres instance** in this session.
5. The Firebase CLI is not installed on this machine, so `firestore.rules` has not been deployed
   from here.
