#!/usr/bin/env bash
# ============================================================================
# VaidyaAI Agents — GCP Infrastructure Setup Script
# ============================================================================
# This script provisions ALL Google Cloud Platform resources required for
# VaidyaAI Agents. Run once per project.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - Billing account linked
#   - Sufficient IAM permissions (Project Creator, Editor)
#
# Usage:
#   chmod +x scripts/gcp_setup.sh
#   ./scripts/gcp_setup.sh
#
# The script is idempotent — safe to re-run.
# ============================================================================

set -euo pipefail

# ─── Configuration ──────────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:-vaidyaai-prod}"
REGION="asia-south1"
ZONE="${REGION}-a"
SERVICE_ACCOUNT_NAME="vaidyaai-backend"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Cloud SQL
SQL_INSTANCE_NAME="vaidyaai-db"
SQL_TIER="db-f1-micro"
SQL_DB_NAME="vaidyaai"
SQL_USER="vaidyaai_user"

# Cloud Storage
GCS_BUCKET_CONSULTATIONS="${PROJECT_ID}-consultations"

# Cloud Tasks Queues
QUEUE_REMINDERS="appointment-reminders"
QUEUE_BILLING="billing-followups"
QUEUE_RETENTION="retention-outreach"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─── Helper Functions ───────────────────────────────────────────────────────
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

check_command() {
    if ! command -v "$1" &> /dev/null; then
        error "$1 is required but not installed."
    fi
}

# ─── Pre-flight Checks ─────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "  VaidyaAI Agents — GCP Infrastructure Setup"
echo "  Project: ${PROJECT_ID}"
echo "  Region: ${REGION}"
echo "=============================================="
echo ""

check_command gcloud
check_command gsutil

# ─── Step 1: Project Setup ──────────────────────────────────────────────────
info "Step 1/9: Setting up GCP project..."

# Check if project exists
if gcloud projects describe "${PROJECT_ID}" &> /dev/null; then
    success "Project ${PROJECT_ID} already exists"
else
    info "Creating project ${PROJECT_ID}..."
    gcloud projects create "${PROJECT_ID}" --name="VaidyaAI Agents" || true
    success "Project ${PROJECT_ID} created"
fi

gcloud config set project "${PROJECT_ID}"
gcloud config set compute/region "${REGION}"
gcloud config set compute/zone "${ZONE}"
success "Default project set to ${PROJECT_ID}"

# ─── Step 2: Enable APIs ───────────────────────────────────────────────────
info "Step 2/9: Enabling APIs (this may take 2-3 minutes)..."

APIS=(
    "run.googleapis.com"                  # Cloud Run
    "aiplatform.googleapis.com"           # Vertex AI (Gemini)
    "speech.googleapis.com"               # Speech-to-Text
    "sqladmin.googleapis.com"             # Cloud SQL Admin
    "cloudtasks.googleapis.com"           # Cloud Tasks
    "firestore.googleapis.com"            # Firestore
    "storage.googleapis.com"              # Cloud Storage
    "cloudbuild.googleapis.com"           # Cloud Build
    "secretmanager.googleapis.com"        # Secret Manager
    "cloudscheduler.googleapis.com"       # Cloud Scheduler
    "logging.googleapis.com"             # Cloud Logging
    "containerregistry.googleapis.com"    # Container Registry
    "artifactregistry.googleapis.com"     # Artifact Registry
    "firebase.googleapis.com"            # Firebase
    "identitytoolkit.googleapis.com"      # Firebase Auth
    "fcm.googleapis.com"                  # Firebase Cloud Messaging
    "iam.googleapis.com"                  # IAM
)

for api in "${APIS[@]}"; do
    if gcloud services list --enabled --filter="name:${api}" --format="value(name)" | grep -q "${api}"; then
        success "API ${api} already enabled"
    else
        info "Enabling ${api}..."
        gcloud services enable "${api}" --quiet
        success "API ${api} enabled"
    fi
done

# ─── Step 3: Service Account ───────────────────────────────────────────────
info "Step 3/9: Creating service account..."

if gcloud iam service-accounts describe "${SERVICE_ACCOUNT_EMAIL}" &> /dev/null 2>&1; then
    success "Service account ${SERVICE_ACCOUNT_EMAIL} already exists"
else
    gcloud iam service-accounts create "${SERVICE_ACCOUNT_NAME}" \
        --display-name="VaidyaAI Backend Service Account" \
        --description="Service account for VaidyaAI backend on Cloud Run"
    success "Service account created"
fi

# Grant IAM roles
info "Granting IAM roles to service account..."

ROLES=(
    "roles/aiplatform.user"               # Vertex AI Gemini calls
    "roles/datastore.user"                # Firestore read/write
    "roles/speech.client"                 # Cloud Speech-to-Text
    "roles/cloudsql.client"               # Cloud SQL connections
    "roles/cloudtasks.enqueuer"           # Create Cloud Tasks
    "roles/storage.objectAdmin"           # Firebase Storage + GCS
    "roles/logging.logWriter"             # Cloud Logging (agent evidence)
    "roles/secretmanager.secretAccessor"  # Read secrets
    "roles/run.invoker"                   # Internal service calls
    "roles/firebase.sdkAdminServiceAgent" # Firebase Admin SDK
    "roles/iam.serviceAccountTokenCreator" # For OIDC tokens (Cloud Scheduler)
)

for role in "${ROLES[@]}"; do
    gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
        --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
        --role="${role}" \
        --condition=None \
        --quiet 2>/dev/null || true
done
success "IAM roles granted"

# ─── Step 4: Cloud SQL PostgreSQL ───────────────────────────────────────────
info "Step 4/9: Setting up Cloud SQL PostgreSQL..."

if gcloud sql instances describe "${SQL_INSTANCE_NAME}" --project="${PROJECT_ID}" &> /dev/null 2>&1; then
    success "Cloud SQL instance ${SQL_INSTANCE_NAME} already exists"
else
    info "Creating Cloud SQL instance (this takes 5-10 minutes)..."
    gcloud sql instances create "${SQL_INSTANCE_NAME}" \
        --database-version=POSTGRES_15 \
        --tier="${SQL_TIER}" \
        --region="${REGION}" \
        --storage-type=SSD \
        --storage-size=10GB \
        --storage-auto-increase \
        --backup-start-time="03:00" \
        --availability-type=zonal \
        --no-assign-ip \
        --network="default" \
        --quiet
    success "Cloud SQL instance created"
fi

# Create database
info "Creating database ${SQL_DB_NAME}..."
gcloud sql databases create "${SQL_DB_NAME}" \
    --instance="${SQL_INSTANCE_NAME}" \
    --quiet 2>/dev/null || success "Database ${SQL_DB_NAME} already exists"

# Create user (generate random password)
SQL_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
info "Creating database user ${SQL_USER}..."
gcloud sql users create "${SQL_USER}" \
    --instance="${SQL_INSTANCE_NAME}" \
    --password="${SQL_PASSWORD}" \
    --quiet 2>/dev/null || warn "User ${SQL_USER} may already exist — update password manually if needed"

# Store password in Secret Manager
echo -n "${SQL_PASSWORD}" | gcloud secrets create "db-password" \
    --data-file=- --quiet 2>/dev/null || \
    echo -n "${SQL_PASSWORD}" | gcloud secrets versions add "db-password" \
    --data-file=- --quiet 2>/dev/null || true
success "Cloud SQL setup complete"

# Get connection name for Cloud Run
SQL_CONNECTION_NAME=$(gcloud sql instances describe "${SQL_INSTANCE_NAME}" \
    --format="value(connectionName)" 2>/dev/null || echo "${PROJECT_ID}:${REGION}:${SQL_INSTANCE_NAME}")
info "Cloud SQL connection name: ${SQL_CONNECTION_NAME}"

# ─── Step 5: Cloud Storage ─────────────────────────────────────────────────
info "Step 5/9: Setting up Cloud Storage buckets..."

if gsutil ls -b "gs://${GCS_BUCKET_CONSULTATIONS}" &> /dev/null 2>&1; then
    success "Bucket ${GCS_BUCKET_CONSULTATIONS} already exists"
else
    gsutil mb -l "${REGION}" -c STANDARD "gs://${GCS_BUCKET_CONSULTATIONS}"
    success "Bucket ${GCS_BUCKET_CONSULTATIONS} created"
fi

# Set lifecycle policy (auto-delete consultation audio after 30 days)
cat > /tmp/lifecycle.json << 'EOF'
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 30}
      }
    ]
  }
}
EOF
gsutil lifecycle set /tmp/lifecycle.json "gs://${GCS_BUCKET_CONSULTATIONS}"
success "Lifecycle policy set (30-day auto-delete)"

# ─── Step 6: Cloud Tasks Queues ────────────────────────────────────────────
info "Step 6/9: Creating Cloud Tasks queues..."

# Queue: appointment-reminders
if gcloud tasks queues describe "${QUEUE_REMINDERS}" --location="${REGION}" &> /dev/null 2>&1; then
    success "Queue ${QUEUE_REMINDERS} already exists"
else
    gcloud tasks queues create "${QUEUE_REMINDERS}" \
        --location="${REGION}" \
        --max-dispatches-per-second=100 \
        --max-concurrent-dispatches=1000 \
        --max-attempts=3 \
        --min-backoff=5s \
        --max-backoff=60s \
        --quiet
    success "Queue ${QUEUE_REMINDERS} created"
fi

# Queue: billing-followups
if gcloud tasks queues describe "${QUEUE_BILLING}" --location="${REGION}" &> /dev/null 2>&1; then
    success "Queue ${QUEUE_BILLING} already exists"
else
    gcloud tasks queues create "${QUEUE_BILLING}" \
        --location="${REGION}" \
        --max-dispatches-per-second=50 \
        --max-concurrent-dispatches=500 \
        --max-attempts=3 \
        --min-backoff=5s \
        --max-backoff=120s \
        --quiet
    success "Queue ${QUEUE_BILLING} created"
fi

# Queue: retention-outreach
if gcloud tasks queues describe "${QUEUE_RETENTION}" --location="${REGION}" &> /dev/null 2>&1; then
    success "Queue ${QUEUE_RETENTION} already exists"
else
    gcloud tasks queues create "${QUEUE_RETENTION}" \
        --location="${REGION}" \
        --max-dispatches-per-second=20 \
        --max-concurrent-dispatches=100 \
        --max-attempts=3 \
        --min-backoff=10s \
        --max-backoff=120s \
        --quiet
    success "Queue ${QUEUE_RETENTION} created"
fi

# ─── Step 7: Cloud Scheduler Jobs ──────────────────────────────────────────
info "Step 7/9: Creating Cloud Scheduler jobs..."

# Note: BACKEND_URL must be updated after first Cloud Run deployment
BACKEND_URL="${BACKEND_URL:-https://vaidyaai-backend-PLACEHOLDER.run.app}"

# Job: retention-radar-daily (8:00 AM IST = 2:30 AM UTC)
if gcloud scheduler jobs describe "retention-radar-daily" --location="${REGION}" &> /dev/null 2>&1; then
    success "Scheduler job retention-radar-daily already exists"
else
    gcloud scheduler jobs create http "retention-radar-daily" \
        --location="${REGION}" \
        --schedule="30 2 * * *" \
        --time-zone="UTC" \
        --uri="${BACKEND_URL}/internal/retention/scan" \
        --http-method=POST \
        --headers="Content-Type=application/json" \
        --message-body='{}' \
        --oidc-service-account-email="${SERVICE_ACCOUNT_EMAIL}" \
        --oidc-token-audience="${BACKEND_URL}" \
        --max-retry-duration=300s \
        --attempt-deadline=600s \
        --quiet
    # Pause until backend is deployed
    gcloud scheduler jobs pause "retention-radar-daily" --location="${REGION}" --quiet 2>/dev/null || true
    success "Scheduler job retention-radar-daily created (paused)"
fi

# Job: insight-engine-weekly (Monday 9:00 AM IST = 3:30 AM UTC Monday)
if gcloud scheduler jobs describe "insight-engine-weekly" --location="${REGION}" &> /dev/null 2>&1; then
    success "Scheduler job insight-engine-weekly already exists"
else
    gcloud scheduler jobs create http "insight-engine-weekly" \
        --location="${REGION}" \
        --schedule="30 3 * * 1" \
        --time-zone="UTC" \
        --uri="${BACKEND_URL}/internal/insights/scan" \
        --http-method=POST \
        --headers="Content-Type=application/json" \
        --message-body='{}' \
        --oidc-service-account-email="${SERVICE_ACCOUNT_EMAIL}" \
        --oidc-token-audience="${BACKEND_URL}" \
        --max-retry-duration=300s \
        --attempt-deadline=600s \
        --quiet
    gcloud scheduler jobs pause "insight-engine-weekly" --location="${REGION}" --quiet 2>/dev/null || true
    success "Scheduler job insight-engine-weekly created (paused)"
fi

# Job: billing-pnl-daily (9:00 PM IST = 3:30 PM UTC)
if gcloud scheduler jobs describe "billing-pnl-daily" --location="${REGION}" &> /dev/null 2>&1; then
    success "Scheduler job billing-pnl-daily already exists"
else
    gcloud scheduler jobs create http "billing-pnl-daily" \
        --location="${REGION}" \
        --schedule="30 15 * * *" \
        --time-zone="UTC" \
        --uri="${BACKEND_URL}/internal/billing/send-daily-pnl" \
        --http-method=POST \
        --headers="Content-Type=application/json" \
        --message-body='{}' \
        --oidc-service-account-email="${SERVICE_ACCOUNT_EMAIL}" \
        --oidc-token-audience="${BACKEND_URL}" \
        --max-retry-duration=300s \
        --attempt-deadline=600s \
        --quiet
    gcloud scheduler jobs pause "billing-pnl-daily" --location="${REGION}" --quiet 2>/dev/null || true
    success "Scheduler job billing-pnl-daily created (paused)"
fi

# ─── Step 8: Artifact Registry ─────────────────────────────────────────────
info "Step 8/9: Setting up Artifact Registry..."

if gcloud artifacts repositories describe vaidyaai-docker-repo \
    --location="${REGION}" --format="value(name)" &> /dev/null 2>&1; then
    success "Artifact Registry repo already exists"
else
    gcloud artifacts repositories create vaidyaai-docker-repo \
        --repository-format=docker \
        --location="${REGION}" \
        --description="VaidyaAI Docker images" \
        --quiet
    success "Artifact Registry repo created"
fi

# ─── Step 9: Summary ───────────────────────────────────────────────────────
info "Step 9/9: Generating setup summary..."

echo ""
echo "=============================================="
echo "  VaidyaAI GCP Setup — COMPLETE"
echo "=============================================="
echo ""
echo "  Project:         ${PROJECT_ID}"
echo "  Region:          ${REGION}"
echo "  Service Account: ${SERVICE_ACCOUNT_EMAIL}"
echo ""
echo "  Cloud SQL:"
echo "    Instance:       ${SQL_INSTANCE_NAME}"
echo "    Database:       ${SQL_DB_NAME}"
echo "    User:           ${SQL_USER}"
echo "    Connection:     ${SQL_CONNECTION_NAME}"
echo "    Password:       Stored in Secret Manager (db-password)"
echo ""
echo "  Cloud Storage:"
echo "    Consultations:  gs://${GCS_BUCKET_CONSULTATIONS}"
echo ""
echo "  Cloud Tasks Queues:"
echo "    1. ${QUEUE_REMINDERS}"
echo "    2. ${QUEUE_BILLING}"
echo "    3. ${QUEUE_RETENTION}"
echo ""
echo "  Cloud Scheduler Jobs (all paused — resume after backend deploy):"
echo "    1. retention-radar-daily   (8:00 AM IST daily)"
echo "    2. insight-engine-weekly   (9:00 AM IST Monday)"
echo "    3. billing-pnl-daily      (9:00 PM IST daily)"
echo ""
echo "  Artifact Registry:"
echo "    ${REGION}-docker.pkg.dev/${PROJECT_ID}/vaidyaai-docker-repo"
echo ""
echo "=============================================="
echo "  NEXT STEPS:"
echo "  1. Run: firebase init --project ${PROJECT_ID}"
echo "  2. Run: scripts/setup_secrets.sh"
echo "  3. Run: Apply database migration (001_initial.sql)"
echo "  4. Run: First Cloud Run deploy"
echo "=============================================="
echo ""

success "GCP infrastructure setup complete!"
