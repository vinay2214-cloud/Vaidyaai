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
# Numeric project number (used to derive the Cloud Run frontend URL for CORS).
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)' 2>/dev/null || echo '')"
FRONTEND_URL="https://vaidyaai-frontend-${PROJECT_NUMBER}.asia-south1.run.app"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

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
    # ENVIRONMENT=production is REQUIRED (otherwise the backend defaults to
    # development). Secrets are referenced from Secret Manager by their real names.
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
        --set-cloudsql-instances="${PROJECT_ID}:${REGION}:vaidyaai-postgres" \
        --set-env-vars="ENVIRONMENT=production,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GCP_REGION=${REGION},FIREBASE_PROJECT_ID=${PROJECT_ID},GOOGLE_GENAI_USE_VERTEXAI=true,LIVE_CLINICAL_AI=true,AI_ALLOW_MOCK_FALLBACK=false,FEATURE_RAZORPAY=false,FEATURE_WHATSAPP=false,CLOUD_TASKS_LOCATION=${REGION},CLOUD_TASKS_QUEUE_REMINDERS=appointment-reminders,CLOUD_TASKS_QUEUE_BILLING=billing-followups,CLOUD_TASKS_QUEUE_RETENTION=retention-outreach,CORS_ORIGINS=${FRONTEND_URL}" \
        --set-secrets="\
DATABASE_URL=DATABASE_URL:latest,\
INTERNAL_TASK_SECRET=INTERNAL_TASK_SECRET:latest,\
BACKEND_URL=BACKEND_URL:latest" \
        --quiet
    
    # Get deployed URL
    local BACKEND_URL=$(gcloud run services describe vaidyaai-backend \
        --region="${REGION}" \
        --format="value(status.url)")
    
    success "Backend deployed: ${BACKEND_URL}"
    
    # Update BACKEND_URL secret with actual URL
    echo -n "${BACKEND_URL}" | gcloud secrets versions add "BACKEND_URL" \
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
    # NEXT_PUBLIC_* values are baked in at build time by Next.js. Resolve the
    # backend URL from the currently-deployed Cloud Run service or Secret Manager,
    # and Firebase web config from environment variables.
    local DEPLOYED_BACKEND_URL
    DEPLOYED_BACKEND_URL="$(gcloud secrets versions access latest --secret=BACKEND_URL 2>/dev/null || \
        gcloud run services describe vaidyaai-backend --region="${REGION}" --format='value(status.url)' 2>/dev/null || \
        echo '')"
    if [[ -z "${DEPLOYED_BACKEND_URL}" ]]; then
        warn "Could not resolve backend URL. Set NEXT_PUBLIC_BACKEND_URL env var or deploy backend first."
    fi

    info "Building frontend Docker image..."
    docker build \
        --build-arg "NEXT_PUBLIC_BACKEND_URL=${DEPLOYED_BACKEND_URL}" \
        --build-arg "NEXT_PUBLIC_DEV_AUTH_BYPASS=false" \
        --build-arg "NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY:-}" \
        --build-arg "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:-${PROJECT_ID}.firebaseapp.com}" \
        --build-arg "NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-${PROJECT_ID}}" \
        --build-arg "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:-${PROJECT_ID}.firebasestorage.app}" \
        --build-arg "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:-}" \
        --build-arg "NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID:-}" \
        --build-arg "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=${NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:-}" \
        --build-arg "NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false" \
        -t "${IMAGE}" -t "${IMAGE_LATEST}" ./frontend/
    
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
    
    # CORS is configured on the backend via the CORS_ORIGINS env var (set during
    # backend deploy). If the frontend URL changed, redeploy the backend so its
    # CORS allow-list includes the new origin.
    if [[ "${FRONTEND_URL}" != "https://vaidyaai-frontend-.asia-south1.run.app" ]]; then
        warn "If the frontend URL changed, redeploy the backend so CORS_ORIGINS includes ${FRONTEND_URL}."
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
