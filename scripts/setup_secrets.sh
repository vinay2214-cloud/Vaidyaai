#!/usr/bin/env bash
# ============================================================================
# VaidyaAI Agents — Secret Manager Setup Script
# ============================================================================
# Creates all Secret Manager secrets required by the VaidyaAI backend.
# Run after gcp_setup.sh. Fill in actual values before deploying.
#
# Usage:
#   chmod +x scripts/setup_secrets.sh
#   ./scripts/setup_secrets.sh
#
# The script is idempotent — safe to re-run.
# ============================================================================

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-vaidyaai-prod}"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

gcloud config set project "${PROJECT_ID}"

echo ""
echo "=============================================="
echo "  VaidyaAI Agents — Secret Manager Setup"
echo "  Project: ${PROJECT_ID}"
echo "=============================================="
echo ""

# ─── Helper: Create or update secret ───────────────────────────────────────
create_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local description="$3"

    if gcloud secrets describe "${secret_name}" --project="${PROJECT_ID}" &> /dev/null 2>&1; then
        # Secret exists — add new version
        echo -n "${secret_value}" | gcloud secrets versions add "${secret_name}" \
            --data-file=- --project="${PROJECT_ID}" --quiet
        success "Secret ${secret_name} updated (new version)"
    else
        # Create new secret
        echo -n "${secret_value}" | gcloud secrets create "${secret_name}" \
            --data-file=- \
            --replication-policy="user-managed" \
            --locations="asia-south1" \
            --project="${PROJECT_ID}" \
            --quiet
        success "Secret ${secret_name} created"
    fi
}

# ─── Secrets Definition ────────────────────────────────────────────────────
# NOTE: Replace PLACEHOLDER values with real credentials before production deploy

info "Creating secrets..."

# Google Cloud
create_secret "gcp-project-id" \
    "${PROJECT_ID}" \
    "Google Cloud project ID"

# Firebase
create_secret "firebase-project-id" \
    "${PROJECT_ID}" \
    "Firebase project ID (same as GCP)"

# WhatsApp Business API
create_secret "whatsapp-phone-id" \
    "${WHATSAPP_PHONE_ID:-PLACEHOLDER_PHONE_ID}" \
    "Meta WhatsApp Phone Number ID"

create_secret "whatsapp-access-token" \
    "${WHATSAPP_ACCESS_TOKEN:-PLACEHOLDER_ACCESS_TOKEN}" \
    "Meta WhatsApp permanent access token"

create_secret "whatsapp-verify-token" \
    "${WHATSAPP_VERIFY_TOKEN:-vaidyaai_webhook_verify_2026}" \
    "WhatsApp webhook verification token"

create_secret "whatsapp-app-secret" \
    "${WHATSAPP_APP_SECRET:-PLACEHOLDER_APP_SECRET}" \
    "Meta App secret for HMAC webhook validation"

# Razorpay
create_secret "razorpay-key-id" \
    "${RAZORPAY_KEY_ID:-PLACEHOLDER_KEY_ID}" \
    "Razorpay API Key ID"

create_secret "razorpay-key-secret" \
    "${RAZORPAY_KEY_SECRET:-PLACEHOLDER_KEY_SECRET}" \
    "Razorpay API Key Secret"

create_secret "razorpay-webhook-secret" \
    "${RAZORPAY_WEBHOOK_SECRET:-PLACEHOLDER_WEBHOOK_SECRET}" \
    "Razorpay webhook validation secret"

# Database
# Note: db-password is created by gcp_setup.sh during Cloud SQL provisioning
# Only create if it doesn't exist
if ! gcloud secrets describe "db-password" --project="${PROJECT_ID}" &> /dev/null 2>&1; then
    create_secret "db-password" \
        "${DB_PASSWORD:-PLACEHOLDER_DB_PASSWORD}" \
        "Cloud SQL database password"
else
    success "Secret db-password already exists (from gcp_setup.sh)"
fi

create_secret "database-url" \
    "${DATABASE_URL:-postgresql+asyncpg://vaidyaai_user:PASSWORD@/vaidyaai?host=/cloudsql/${PROJECT_ID}:asia-south1:vaidyaai-db}" \
    "Full database connection URL for SQLAlchemy"

# Backend URL (updated after first Cloud Run deploy)
create_secret "backend-url" \
    "${BACKEND_URL:-https://vaidyaai-backend-PLACEHOLDER.run.app}" \
    "Backend Cloud Run URL (update after first deploy)"

# CORS origins
create_secret "cors-origins" \
    "${CORS_ORIGINS:-http://localhost:3000}" \
    "Comma-separated allowed CORS origins"

# Cloud Tasks
create_secret "cloud-tasks-location" \
    "asia-south1" \
    "Cloud Tasks queue location"

# Cloud Storage
create_secret "gcs-bucket-consultations" \
    "${PROJECT_ID}-consultations" \
    "GCS bucket for consultation audio"

echo ""
echo "=============================================="
echo "  Secrets Setup — COMPLETE"
echo "=============================================="
echo ""
echo "  Total secrets created: 15"
echo ""
echo "  PLACEHOLDER secrets that need real values:"
echo "    - whatsapp-phone-id"
echo "    - whatsapp-access-token"
echo "    - whatsapp-app-secret"
echo "    - razorpay-key-id"
echo "    - razorpay-key-secret"
echo "    - razorpay-webhook-secret"
echo "    - database-url (update password)"
echo "    - backend-url (update after first deploy)"
echo "    - cors-origins (update after frontend deploy)"
echo ""
echo "  To update a secret:"
echo "    echo -n 'new_value' | gcloud secrets versions add SECRET_NAME --data-file=-"
echo ""
success "Secret Manager setup complete!"
