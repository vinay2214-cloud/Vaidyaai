#!/usr/bin/env bash
# ============================================================================
# VaidyaAI Agents — Production Deployment Script
# ============================================================================
# Deploys backend and/or frontend to Cloud Run.
#
# Usage:
#   ./scripts/deploy.sh              # Deploy both
#   ./scripts/deploy.sh backend      # Deploy backend only
#   ./scripts/deploy.sh frontend     # Deploy frontend only
# ============================================================================

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-vaidyaai-xprize}"
REGION="asia-south1"
REPO="${REGION}-docker.pkg.dev/${PROJECT_ID}/vaidyaai-docker-repo"
SERVICE_ACCOUNT="vaidyaai-backend@${PROJECT_ID}.iam.gserviceaccount.com"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

DEPLOY_TARGET="${1:-all}"

# ─── Backend Deployment ────────────────────────────────────────────────────
deploy_backend() {
    info "Deploying backend to Cloud Run..."
    
    local IMAGE="${REPO}/vaidyaai-backend:$(date +%Y%m%d-%H%M%S)"
    local IMAGE_LATEST="${REPO}/vaidyaai-backend:latest"

    # Build Docker image
    info "Building backend Docker image..."
    docker build -t "${IMAGE}" -t "${IMAGE_LATEST}" ./backend/
    
    # Push to Artifact Registry
    info "Pushing to Artifact Registry..."
    docker push "${IMAGE}"
    docker push "${IMAGE_LATEST}"
    
    # Deploy to Cloud Run
    info "Deploying to Cloud Run..."
    gcloud run deploy vaidyaai-backend \
        --image="${IMAGE}" \
        --region="${REGION}" \
        --platform=managed \
        --memory=2Gi \
        --cpu=2 \
        --min-instances=1 \
        --max-instances=10 \
        --concurrency=80 \
        --timeout=300s \
        --allow-unauthenticated \
        --service-account="${SERVICE_ACCOUNT}" \
        --set-cloudsql-instances="${PROJECT_ID}:${REGION}:vaidyaai-db" \
        --set-secrets="\
GOOGLE_CLOUD_PROJECT=gcp-project-id:latest,\
FIREBASE_PROJECT_ID=firebase-project-id:latest,\
WHATSAPP_PHONE_ID=whatsapp-phone-id:latest,\
WHATSAPP_ACCESS_TOKEN=whatsapp-access-token:latest,\
WHATSAPP_VERIFY_TOKEN=whatsapp-verify-token:latest,\
WHATSAPP_APP_SECRET=whatsapp-app-secret:latest,\
RAZORPAY_KEY_ID=razorpay-key-id:latest,\
RAZORPAY_KEY_SECRET=razorpay-key-secret:latest,\
RAZORPAY_WEBHOOK_SECRET=razorpay-webhook-secret:latest,\
DATABASE_URL=database-url:latest,\
BACKEND_URL=backend-url:latest,\
CORS_ORIGINS=cors-origins:latest,\
GCS_BUCKET_CONSULTATIONS=gcs-bucket-consultations:latest,\
CLOUD_TASKS_LOCATION=cloud-tasks-location:latest" \
        --quiet
    
    # Get deployed URL
    local BACKEND_URL=$(gcloud run services describe vaidyaai-backend \
        --region="${REGION}" \
        --format="value(status.url)")
    
    success "Backend deployed: ${BACKEND_URL}"
    
    # Update backend-url secret with actual URL
    echo -n "${BACKEND_URL}" | gcloud secrets versions add "backend-url" \
        --data-file=- --quiet 2>/dev/null || true
    
    # Health check
    info "Running health check..."
    local HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/health")
    if [ "${HEALTH}" = "200" ]; then
        success "Health check passed (200 OK)"
    else
        error "Health check failed (HTTP ${HEALTH}). Check Cloud Run logs."
    fi

    # Update Cloud Scheduler jobs with actual backend URL
    info "Updating Cloud Scheduler jobs with backend URL..."
    for job in retention-radar-daily insight-engine-weekly billing-pnl-daily; do
        gcloud scheduler jobs update http "${job}" \
            --location="${REGION}" \
            --uri="${BACKEND_URL}/internal/$(echo ${job} | sed 's/-daily/\/scan/;s/-weekly/\/scan/;s/billing-pnl/billing\/send-daily-pnl/')" \
            --oidc-token-audience="${BACKEND_URL}" \
            --quiet 2>/dev/null || warn "Could not update scheduler job ${job}"
    done
    
    echo ""
    success "Backend deployment complete: ${BACKEND_URL}"
}

# ─── Frontend Deployment ──────────────────────────────────────────────────
deploy_frontend() {
    info "Deploying frontend to Cloud Run..."
    
    local IMAGE="${REPO}/vaidyaai-frontend:$(date +%Y%m%d-%H%M%S)"
    local IMAGE_LATEST="${REPO}/vaidyaai-frontend:latest"

    # Build Docker image
    info "Building frontend Docker image..."
    docker build -t "${IMAGE}" -t "${IMAGE_LATEST}" ./frontend/
    
    # Push to Artifact Registry
    info "Pushing to Artifact Registry..."
    docker push "${IMAGE}"
    docker push "${IMAGE_LATEST}"
    
    # Deploy to Cloud Run
    info "Deploying to Cloud Run..."
    gcloud run deploy vaidyaai-frontend \
        --image="${IMAGE}" \
        --region="${REGION}" \
        --platform=managed \
        --memory=512Mi \
        --cpu=1 \
        --min-instances=0 \
        --max-instances=5 \
        --allow-unauthenticated \
        --quiet
    
    local FRONTEND_URL=$(gcloud run services describe vaidyaai-frontend \
        --region="${REGION}" \
        --format="value(status.url)")
    
    success "Frontend deployed: ${FRONTEND_URL}"
    
    # Update CORS origins to include frontend URL
    local CURRENT_CORS=$(gcloud secrets versions access latest --secret="cors-origins" 2>/dev/null || echo "")
    if [[ "${CURRENT_CORS}" != *"${FRONTEND_URL}"* ]]; then
        local NEW_CORS="${CURRENT_CORS},${FRONTEND_URL}"
        echo -n "${NEW_CORS}" | gcloud secrets versions add "cors-origins" \
            --data-file=- --quiet 2>/dev/null || true
        warn "CORS origins updated. Redeploy backend for changes to take effect."
    fi
    
    echo ""
    success "Frontend deployment complete: ${FRONTEND_URL}"
}

# ─── Main ──────────────────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "  VaidyaAI Agents — Production Deploy"
echo "  Project: ${PROJECT_ID} | Region: ${REGION}"
echo "  Target: ${DEPLOY_TARGET}"
echo "=============================================="
echo ""

# Authenticate Docker with Artifact Registry
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet 2>/dev/null || true

case "${DEPLOY_TARGET}" in
    backend)
        deploy_backend
        ;;
    frontend)
        deploy_frontend
        ;;
    all)
        deploy_backend
        deploy_frontend
        ;;
    *)
        error "Unknown target: ${DEPLOY_TARGET}. Use: backend, frontend, or all"
        ;;
esac

echo ""
echo "=============================================="
echo "  Deployment Complete"
echo "=============================================="
