FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are baked in at build time by Next.js. Declare them as
# build args so the Cloud Build pipeline can inject the real Firebase web config
# and backend URL without committing secrets.
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_DEV_AUTH_BYPASS=false
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
ARG NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false

# Promote every build arg to a real ENV. Docker does expose ARGs to RUN, but
# only implicitly; making them ENV is explicit, survives a base-image change,
# and keeps the "these are inlined into the JS bundle" contract obvious.
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_DEV_AUTH_BYPASS=$NEXT_PUBLIC_DEV_AUTH_BYPASS
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=$NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
ENV NEXT_PUBLIC_USE_FIREBASE_EMULATOR=$NEXT_PUBLIC_USE_FIREBASE_EMULATOR
ENV NEXT_TELEMETRY_DISABLED 1

# Fail the build here rather than ship a bundle pointing at localhost. The value
# is inlined into static JS, so a wrong one is only discoverable in a browser
# against the deployed site.
RUN test -n "$NEXT_PUBLIC_BACKEND_URL" || \
    (echo "ERROR: NEXT_PUBLIC_BACKEND_URL build arg is empty. The image would ship a frontend that calls http://localhost:8000." && exit 1)
RUN case "$NEXT_PUBLIC_BACKEND_URL" in \
      *localhost*|*127.0.0.1*) echo "ERROR: NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL points at localhost." && exit 1 ;; \
    esac

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
