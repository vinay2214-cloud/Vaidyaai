# Security Policy

## Reporting Vulnerabilities
- Email security issues to the maintainers (do not open public issues)
- Include detailed reproduction steps
- Expected response time: 72 hours for acknowledgment

## Implemented Security Controls

### Authentication
- Firebase JWT verification (async, non-blocking via `asyncio.to_thread`)
- Dev-only auth bypass tokens (`dev_mock_id_token`, `dev_token`, `dev_mock_token`) — disabled in production
- Session management via HTTP-only cookies (`vaidyaai_session`)

### Authorization & Tenant Isolation
- `verify_clinic_access()` enforces `clinic_id` JWT custom claim matches request parameter
- HTTP 403 on cross-tenant access attempts
- Firestore security rules enforce tenant-scoped reads via `request.auth.token.clinic_id`
- ALL Firestore writes denied to clients — backend uses Firebase Admin SDK exclusively
- ALL Cloud Storage access denied to clients — prescriptions accessed via signed URLs

### Internal Endpoint Security
- `/internal/*` routes authenticated via shared secret (HMAC `compare_digest`) or OIDC token
- Fail-closed in production: rejects if `INTERNAL_TASK_SECRET` equals placeholder value (HTTP 503)

### Webhook Security
- WhatsApp webhooks: HMAC-SHA256 signature verification with `sha256=` prefix
- Razorpay webhooks: HMAC-SHA256 signature verification
- Both reject missing, forged, or malformed signatures

### PHI / PII Protection
- `anonymise_for_llm()` strips Indian phone numbers, Aadhaar patterns (12-digit), email addresses, and patient names before passing text to Vertex AI Gemini
- `mask_phone()` converts `+919876543210` to `+91XXXXXX3210` for all logs, database storage, and API responses
- Phone number masking at database, logging, and LLM prompt layers

### HTTP Security Headers
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Correlation-ID` header for distributed request tracing

### LLM Safety
- Fail-closed: `GeminiService` raises `RuntimeError` in production when model is unavailable
- Mock fallback enabled ONLY in development environments
- 30-second timeout with 3-retry exponential backoff for LLM calls

### Production Configuration Validation
- `validate_production()` rejects SQLite database URLs in production
- Rejects placeholder values for 7 secrets: `INTERNAL_TASK_SECRET`, `WHATSAPP_PHONE_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`

### Secrets Management
- Production: Google Cloud Secret Manager with runtime mounting via Cloud Run `--set-secrets`
- `.gitignore` blocks all credential files (`.env`, `*.pem`, `*.key`, `*service-account*.json`, `*credentials*.json`)

### Event Bus Security
- Event deduplication by `event_id` prevents duplicate invoice generation
- Dead-letter queue captures failed events for manual review
- Correlation ID chain: `event_id` to `causation_id` to `correlation_id`

### Audit Logging
- Dual-write to Google Cloud Logging + Firestore `agent_logs` collection
- Structured payloads with agent_name, decision_type, clinic_id, correlation_id, timestamps

## Security Testing
- 8 internal auth security tests (valid/wrong/missing secret, placeholder detection, clinic access)
- 7 webhook signature tests (WhatsApp + Razorpay valid/forged/missing signatures)
- 2 LLM fail-closed tests (production raises, development mocks)
- 3 config validation tests (placeholder rejection, production acceptance, dev bypass)

## NOT Implemented (Future Work)
- HIPAA compliance certification
- GDPR compliance
- ISO 27001 certification
- NABH accreditation alignment
- HL7 FHIR R4 interoperability
- ABDM (Ayushman Bharat Digital Mission) integration
- Content Security Policy (CSP) headers
- CSRF token protection
- Rate limiting
- IP allowlisting
- WAF (Web Application Firewall)
- Penetration testing report
- SOC 2 Type II audit
