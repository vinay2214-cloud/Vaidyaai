# Product Requirements Document — VaidyaAI Agents
## Version 2.0 | Build with Gemini XPRIZE Hackathon | Deadline: August 17, 2026
## Category: Professional Services Access | Target: $500,000 First Prize

---

## DOCUMENT PURPOSE
This PRD is the single source of truth for every coding agent, AI assistant, and developer
working on VaidyaAI Agents. Every functional requirement, data schema, API contract, message
template, and agent prompt specification is defined here. Do not deviate from these specs.
When in doubt, ask — do not invent.

---

## 1. EXECUTIVE SUMMARY

### 1.1 Product Vision
VaidyaAI Agents is a 7-agent autonomous AI workforce that runs the complete back-office
of India's 1.2 million solo medical clinics. Doctors interact only with patients.
Every other decision — booking, documentation, billing, retention, safety, analytics,
referrals — is made and executed by AI agents running 24/7 on Google Cloud.

### 1.2 Hackathon Submission Identity
- **Repo name:** vaidyaai-agents (NEW, standalone — completely separate from any existing code)
- **Category:** Professional Services Access
- **Primary Google Cloud product:** Vertex AI (Gemini 1.5 Flash — all 7 agents)
- **Secondary GCP:** Cloud Run, Firestore, Cloud SQL, Speech-to-Text, Cloud Tasks, Cloud Logging
- **Market:** Solo and 2-3 doctor clinics in India, starting Tirupati, Andhra Pradesh

### 1.3 Judge Scoring Alignment
| Judging Criterion | How VaidyaAI Wins |
|---|---|
| Business Viability | SaaS subscription ₹2,999-₹9,999/month. Zero CAC via IMA network. 93% gross margin. Target 15+ paying clinics by Aug 17. |
| AI-Native Operations | 7 agents make 100% of back-office decisions autonomously. Zero human staff needed. Every decision logged to Cloud Logging. |
| Category Impact | 800M Indians rely on solo practitioners. VaidyaAI gives village doctors the operational capacity of a ₹50L-staffed clinic. |

---

## 2. PROBLEM STATEMENT

### 2.1 The Market Reality
India's 1.2 million solo practitioners collectively see more patients daily than the entire
hospital system combined. Fewer than 8% have any digital infrastructure. The gap is not
desire — it is operational reality:

- A doctor seeing 80 patients/day has zero time to operate software
- Hiring a receptionist costs ₹12,000-18,000/month (significant for ₹1-3L/month net earners)
- Existing tools (Practo Ray, HealthPlix, MocDoc) are digital notebooks — still requiring a
  human to operate them

### 2.2 What Doesn't Exist Yet
No product in the market autonomously:
- Books appointments without a receptionist
- Generates clinical documentation without a transcriptionist
- Collects payments without a billing clerk
- Re-engages lapsed patients without a marketing team
- Checks prescription safety without a pharmacist present
- Analyses practice performance without a data analyst
- Coordinates referrals without an admin

VaidyaAI is not software the doctor uses. It is an AI system that operates the clinic.

### 2.3 Market Size
- India solo clinic TAM: ₹86 billion annually at ₹5,999/clinic/month
- Immediate addressable market (AP + Telangana alone): 180,000 clinics
- Beachhead: Tirupati + Vijayawada corridor (highest pilgrim footfall in India = clinic density)

---

## 3. THE 7-AGENT SYSTEM — MASTER SPECIFICATION

### Agent 1: AppointmentFlow
**Trigger:** Incoming WhatsApp message from a patient
**Primary LLM:** Gemini 1.5 Flash via Vertex AI (asia-south1)
**Autonomous decisions:**
1. Detect language (te/hi/en/ta/other)
2. Detect intent (BOOK/CANCEL/RESCHEDULE/ENQUIRY/EMERGENCY/OTHER)
3. Detect urgency (ROUTINE/URGENT/EMERGENCY)
4. Select available slots from clinic schedule
5. Confirm booking without human involvement
6. Schedule reminder and wellness check tasks

**What it does NOT do:** Any clinical triage, medical advice, diagnosis suggestions.
**Human touchpoint:** None — fully autonomous from patient message to booked appointment.

**Message Flow:**
```
Patient WhatsApp → Webhook → AppointmentFlow Agent → Gemini (intent) →
Firestore (slot lookup) → WhatsApp (slot options) → Patient selects →
Firestore (appointment created) → Cloud Tasks (reminders scheduled) → Done
```

---

### Agent 2: ClinicalScribe
**Trigger:** Doctor taps "Stop Recording" in dashboard after consultation
**Primary LLM:** Gemini 1.5 Pro via Vertex AI (higher quality for clinical text)
**Secondary service:** Google Cloud Speech-to-Text v2 (transcription)
**Autonomous decisions:**
1. Transcribe consultation audio (Indian English + Telugu code-switching)
2. Structure transcript into SOAP note format
3. Assign ICD-10-CM diagnostic codes
4. Extract medication list with generic drug names
5. Generate PDF prescription

**What it does NOT do:** Make any clinical decisions. Final SOAP note requires doctor approval.
**Human touchpoint:** Doctor reviews and approves the AI-generated SOAP note (< 60 seconds).

**SOAP Note Output Schema:**
```json
{
  "subjective": {
    "chief_complaint": "string",
    "history_of_present_illness": "string",
    "review_of_systems": "string",
    "relevant_history": "string",
    "medications_mentioned": ["string"]
  },
  "objective": {
    "vitals": {"bp": "string|null", "temp": "string|null", "spo2": "string|null", "pulse": "string|null"},
    "examination_findings": "string"
  },
  "assessment": {
    "primary_diagnosis": "string",
    "differential_diagnoses": ["string"],
    "icd10_codes": [{"code": "string", "description": "string", "confidence": "high|medium|low"}]
  },
  "plan": {
    "medications": [
      {
        "generic_name": "string",
        "brand_alias": "string|null",
        "dose": "string",
        "route": "string",
        "frequency": "string",
        "duration_days": "integer",
        "instructions": "string"
      }
    ],
    "investigations": ["string"],
    "referrals": ["string"],
    "follow_up_days": "integer|null",
    "advice": "string"
  },
  "flags": ["string"],
  "prescription_safe_status": "PENDING"
}
```

---

### Agent 3: BillingPulse
**Trigger:** Doctor approves consultation SOAP note
**Primary LLM:** Gemini 1.5 Flash (billing narrative and message drafting)
**External APIs:** Razorpay (payment links), WhatsApp (invoice delivery)
**Autonomous decisions:**
1. Calculate fee based on consultation type (new/follow-up/procedure)
2. Generate sequential invoice number (VDY-YYYYMMDD-XXXX)
3. Create Razorpay UPI payment link
4. Send invoice to patient WhatsApp
5. Send payment reminder at T+24h if unpaid
6. Generate and send daily P&L to doctor at 9 PM IST
7. Update financial records in real time

**What it does NOT do:** Waive fees, adjust prices (doctor must do this manually).
**Human touchpoint:** Doctor can mark cash payments and waive fees from dashboard.

**Daily P&L WhatsApp Message Format:**
```
📊 Today's Summary — Dr. {name}'s Clinic
Date: {date}

Patients seen: {N}
Billed: ₹{total_billed}
Collected: ₹{collected}
  ├ UPI: ₹{upi_amount}
  └ Cash: ₹{cash_amount}
Pending: ₹{pending}

VaidyaAI BillingPulse • {clinic_name}
```

---

### Agent 4: RetentionRadar
**Trigger:** Cloud Scheduler — 8:00 AM IST daily
**Primary LLM:** Gemini 1.5 Flash (personalised message drafting)
**Autonomous decisions:**
1. Scan all clinic patients for 6 trigger conditions (see Section 4.2)
2. Prioritise by clinical urgency and revenue potential
3. Check messaging frequency limits (max 2/patient/month)
4. Draft personalised WhatsApp message in patient's language
5. Send messages (max 20/clinic/day)
6. Log all outreach for compliance and analytics

**Trigger Priority Order (highest to lowest):**
1. CHRONIC_OVERDUE — diabetes/BP/thyroid patient, last visit > 45 days
2. POST_TREATMENT_FOLLOWUP — follow-up date in SOAP plan has passed
3. REFERRAL_INCOMPLETE — lab/specialist referral sent > 21 days ago, no return
4. SEASONAL_RISK — dengue season (Jul-Sep AP), respiratory season (Dec-Feb)
5. LONG_INACTIVE — last visit > 90 days, no chronic condition
6. BIRTHDAY — patient birthday today or tomorrow (if DOB recorded)

**Human touchpoint:** None. Doctor receives summary at 8:30 AM. Can pause retention for any patient from dashboard.

---

### Agent 5: PrescriptionSafe
**Trigger:** SOAP note generated, before doctor approval prompt is shown
**Primary LLM:** Gemini 1.5 Pro (safety-critical, highest quality model)
**Autonomous decisions:**
1. Check drug-drug interactions in prescribed medication list
2. Check drugs against patient allergy list
3. Flag dosage concerns relative to patient age/weight/condition
4. Classify severity (CRITICAL/WARNING/INFO)
5. Determine if prescription should be blocked pending doctor review

**CRITICAL RULE:** PrescriptionSafe is advisory only. It NEVER blocks a prescription
from a doctor who explicitly overrides with documented reason. It flags and informs.
Every override is logged with doctor acknowledgment.

**Safety Flag Schema:**
```json
{
  "interactions": [
    {
      "drug_a": "string",
      "drug_b": "string",
      "severity": "CRITICAL|WARNING|INFO",
      "mechanism": "string",
      "clinical_significance": "string",
      "recommendation": "string"
    }
  ],
  "allergy_alerts": [
    {
      "drug": "string",
      "allergy": "string",
      "severity": "CRITICAL|WARNING",
      "cross_reactivity_note": "string"
    }
  ],
  "dosage_concerns": [
    {
      "drug": "string",
      "prescribed_dose": "string",
      "standard_adult_range": "string",
      "concern": "string"
    }
  ],
  "overall_safety_level": "CLEAR|WARNING|CRITICAL",
  "block_prescription_pending_review": true,
  "doctor_override_allowed": true
}
```

---

### Agent 6: InsightEngine
**Trigger:** Cloud Scheduler — Monday 9:00 AM IST weekly
**Primary LLM:** Gemini 1.5 Flash (analytics narrative generation)
**Autonomous decisions:**
1. Aggregate 7-day consultation data per clinic
2. Identify top 5 diagnoses by frequency (ICD-10 clustering)
3. Detect anomalies vs 4-week rolling average (spike threshold: 3x)
4. Generate seasonal signal (Tirupati AP disease calendar)
5. Compile revenue performance vs prior week
6. Draft actionable insight report for doctor
7. Send to doctor WhatsApp + store in Firestore

**Disease Calendar for Tirupati AP:**
- June–September: dengue, malaria, gastroenteritis, leptospirosis
- October–November: chikungunya tail, post-monsoon viral fever
- December–February: respiratory tract infections, asthma exacerbation
- March–May: heat exhaustion, dehydration, urinary infections

---

### Agent 7: ReferralCoordinator
**Trigger:** Consultation approved (listens to consultation approval event)
**Primary LLM:** Gemini 1.5 Flash (referral extraction from SOAP plan section)
**Autonomous decisions:**
1. Parse PLAN section of SOAP note for referral mentions
2. Identify referral type (lab/specialist/imaging)
3. Send referral instruction WhatsApp to patient
4. Create referral tracking record
5. Schedule 7-day follow-up Cloud Task
6. Send one reminder if referral not completed at day 7
7. Mark expired if no completion by day 14

**Tirupati Lab Network (hardcoded, config file):**
```python
TIRUPATI_LABS = {
  "thyrocare": {"name": "Thyrocare", "phone": "+91-9999-THYRO", "home_collection": True},
  "lal_pathlabs": {"name": "Dr. Lal PathLabs", "phone": "+91-9999-LALPL", "home_collection": True},
  "srl": {"name": "SRL Diagnostics", "phone": "+91-9999-SRLDX", "home_collection": False},
  "niims": {"name": "NIIMS Diagnostics", "phone": "+91-9999-NIIMS", "home_collection": True}
}
```

---

## 4. FIRESTORE DATA SCHEMAS

### Collection: `clinics/{clinic_id}`
```
clinic_id:              string (auto-generated UUID)
name:                   string — "Sri Venkateswara Clinic"
doctor_name:            string — "Dr. Ramesh Reddy"
doctor_qualification:   string — "MBBS, MD (General Medicine)"
speciality:             string — "General Medicine"
location:               string — "Tirupati, Andhra Pradesh"
address:                string — full clinic address
phone:                  string — clinic landline/mobile
whatsapp_phone_id:      string — Meta WhatsApp Phone Number ID
whatsapp_number:        string — +91XXXXXXXXXX (the actual number)
registration_number:    string — MCI registration number
schedule: {
  monday:    {open: "09:00", close: "13:00", afternoon_open: "17:00", afternoon_close: "20:00", slot_duration_minutes: 15}
  tuesday:   {...}
  wednesday: {...}
  thursday:  {...}
  friday:    {...}
  saturday:  {...}
  sunday:    null  (closed)
}
consultation_fees: {
  new_patient_paise:    integer — 30000 (= ₹300)
  followup_paise:       integer — 15000 (= ₹150)
  procedure_paise:      integer — 50000 (= ₹500, default, doctor overrides per case)
}
subscription_plan:      string enum — "essential" | "growth" | "pro"
is_active:              boolean
agents_enabled: {
  appointment_flow:     boolean — true
  clinical_scribe:      boolean — true
  billing_pulse:        boolean — true
  retention_radar:      boolean — true
  prescription_safe:    boolean — true
  insight_engine:       boolean — true
  referral_coordinator: boolean — true
}
onboarding_complete:    boolean
created_at:             Firestore Timestamp
updated_at:             Firestore Timestamp
```

### Collection: `patients/{patient_id}`
```
patient_id:             string (auto UUID)
clinic_id:              string (FK → clinics)
phone:                  string — +91XXXXXXXXXX (full, stored encrypted)
phone_masked:           string — XXXXXXX9876 (last 4 digits visible, for logs)
name:                   string | null
age:                    integer | null
sex:                    string "M" | "F" | "O" | null
dob:                    string "YYYY-MM-DD" | null
language_preference:    string "te" | "hi" | "en" | "ta" — detected from messages
allergies:              [string] — ["penicillin", "sulfa", "aspirin"]
chronic_conditions:     [string] — ["diabetes", "hypertension", "thyroid"]
blood_group:            string | null
last_visit:             Firestore Timestamp | null
visit_count:            integer — total visits to this clinic
notes:                  string — doctor's private notes about patient
is_active:              boolean
created_at:             Firestore Timestamp
```

### Collection: `appointments/{appointment_id}`
```
appointment_id:         string (auto UUID)
clinic_id:              string (FK)
patient_id:             string (FK → patients)
patient_phone_masked:   string
slot_time:              Firestore Timestamp — exact appointment datetime
slot_date:              string "YYYY-MM-DD" — for date-only queries
slot_time_str:          string "10:00 AM" — for display
duration_minutes:       integer — 15
complaint_summary:      string — max 50 chars, from intent detection
status:                 string enum:
                          "booked"        — confirmed by agent
                          "reminded"      — T-2h reminder sent
                          "arrived"       — marked by doctor
                          "in_progress"   — consultation started
                          "completed"     — consultation approved
                          "no_show"       — patient did not arrive
                          "cancelled"     — cancelled by patient or doctor
consultation_type:      string "new" | "followup" | "procedure"
booked_by:              string "whatsapp_agent" | "doctor" | "walk_in"
reminder_task_name:     string — Cloud Tasks task name (for cancellation)
wellness_task_name:     string — Cloud Tasks task name
reminder_sent_at:       Firestore Timestamp | null
wellness_sent_at:       Firestore Timestamp | null
cancelled_at:           Firestore Timestamp | null
cancel_reason:          string | null
created_at:             Firestore Timestamp
```

### Collection: `consultations/{consultation_id}`
```
consultation_id:        string (auto UUID)
clinic_id:              string (FK)
appointment_id:         string (FK → appointments)
patient_id:             string (FK → patients)
status:                 string enum:
                          "recording"   — audio capture in progress
                          "processing"  — STT + SOAP generation running
                          "review"      — awaiting doctor approval
                          "approved"    — doctor approved, PDF generated
                          "cancelled"   — consultation cancelled
audio_gcs_uri:          string — gs://vaidyaai-consultations/{id}/full_audio.webm
transcript:             string — full consultation transcript (doctor + patient)
soap_note:              map — full SOAP note JSON (see Agent 2 schema)
icd10_codes:            array — [{code, description, confidence}]
medications:            array — [{generic_name, brand_alias, dose, route, frequency, duration_days, instructions}]
safety_flags:           array — from PrescriptionSafe agent
safety_level:           string "CLEAR" | "WARNING" | "CRITICAL"
doctor_override_reason: string | null — if doctor overrode CRITICAL flag
prescription_pdf_url:   string | null — Firebase Storage URL
invoice_id:             string | null — FK → PostgreSQL invoices
referral_extracted:     boolean
consultation_type:      string "new" | "followup" | "procedure"
recording_started_at:   Firestore Timestamp
recording_ended_at:     Firestore Timestamp | null
soap_generated_at:      Firestore Timestamp | null
approved_at:            Firestore Timestamp | null
created_at:             Firestore Timestamp
```

### Collection: `agent_logs/{log_id}`
```
log_id:                 string (auto UUID)
clinic_id:              string (FK)
agent_name:             string — "appointment_flow" | "clinical_scribe" | "billing_pulse" |
                                  "retention_radar" | "prescription_safe" | "insight_engine" |
                                  "referral_coordinator"
decision_type:          string — see per-agent decision types below
decision_made:          string — human-readable description of the decision
input_summary:          string — anonymised summary of what triggered this decision
output_summary:         string — what the agent did as a result
model_used:             string — "gemini-1.5-flash" | "gemini-1.5-pro"
prompt_tokens:          integer | null
completion_tokens:      integer | null
latency_ms:             integer
success:                boolean
error_message:          string | null
patient_phone_masked:   string | null — last 4 digits only
appointment_id:         string | null
consultation_id:        string | null
created_at:             Firestore Timestamp  ← INDEXED
```

**Agent-specific decision_type values:**
```
appointment_flow:   intent_detected | slots_offered | appointment_booked | appointment_cancelled |
                    appointment_rescheduled | emergency_redirected | reminder_sent | wellness_sent
clinical_scribe:    transcription_started | transcription_complete | soap_generated |
                    icd10_assigned | pdf_generated
billing_pulse:      invoice_created | payment_link_sent | payment_confirmed | payment_reminded |
                    cash_payment_logged | daily_pnl_sent | monthly_report_sent
retention_radar:    scan_started | patient_triggered | message_drafted | message_sent |
                    scan_completed | rate_limit_skipped
prescription_safe:  check_initiated | interaction_found | allergy_alert | dosage_concern |
                    prescription_cleared | prescription_flagged | doctor_override_logged
insight_engine:     weekly_scan_started | diagnosis_trend_computed | anomaly_detected |
                    report_generated | report_sent
referral_coordinator: referral_extracted | patient_notified | followup_scheduled |
                      followup_sent | referral_completed | referral_expired
```

### Collection: `pending_bookings/{patient_phone}`
```
patient_phone:          string (document ID = patient phone number)
clinic_id:              string
available_slots:        array of {slot_time: Timestamp, slot_time_str: string, position: integer}
intent:                 map — full intent detection result
language:               string
created_at:             Firestore Timestamp
expires_at:             Firestore Timestamp — now + 30 minutes (auto-delete via TTL)
```

### Collection: `clinic_insights/{clinic_id}/weekly/{week_start_date}`
```
week_start:             string "YYYY-MM-DD"
patients_seen:          integer
unique_patients:        integer
new_patients:           integer
follow_up_patients:     integer
top_diagnoses:          [{icd10_code, description, count, vs_prior_week_pct}]
anomalies:              [{diagnosis, count, rolling_avg, spike_multiplier}]
revenue_collected:      integer (paise)
revenue_billed:         integer (paise)
collection_rate_pct:    float
no_show_rate_pct:       float
retention_messages_sent: integer
appointments_from_retention: integer
report_text:            string — Gemini-generated narrative
sent_to_doctor:         boolean
generated_at:           Firestore Timestamp
```

---

## 5. POSTGRESQL DATABASE SCHEMAS

### Table: `clinics`
```sql
CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_clinic_id VARCHAR(128) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    doctor_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    whatsapp_phone_id VARCHAR(100) NOT NULL,
    speciality VARCHAR(100) DEFAULT 'General Medicine',
    location VARCHAR(255),
    subscription_plan VARCHAR(20) DEFAULT 'essential'
        CHECK (subscription_plan IN ('essential','growth','pro')),
    razorpay_account_id VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    onboarding_complete BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_clinics_firebase_id ON clinics(firebase_clinic_id);
```

### Table: `subscriptions`
```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    plan VARCHAR(20) NOT NULL CHECK (plan IN ('essential','growth','pro')),
    monthly_fee_paise INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('trial','active','paused','cancelled')),
    razorpay_subscription_id VARCHAR(100),
    trial_ends_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    next_billing_date DATE,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_subscriptions_clinic ON subscriptions(clinic_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

### Table: `invoices`
```sql
CREATE SEQUENCE invoice_sequence START 1000;

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(30) UNIQUE NOT NULL
        DEFAULT ('VDY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('invoice_sequence')::text, 4, '0')),
    clinic_id UUID REFERENCES clinics(id),
    patient_phone_masked VARCHAR(20) NOT NULL,
    consultation_firestore_id VARCHAR(128),
    amount_paise INTEGER NOT NULL,
    consultation_type VARCHAR(20) CHECK (consultation_type IN ('new','followup','procedure')),
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending','paid','waived','failed','refunded')),
    payment_method VARCHAR(20)
        CHECK (payment_method IN ('upi','cash','card','waived',NULL)),
    razorpay_payment_link_id VARCHAR(100),
    razorpay_payment_link_url TEXT,
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    reminder_sent_at TIMESTAMPTZ,
    waived_reason VARCHAR(255)
);
CREATE INDEX idx_invoices_clinic ON invoices(clinic_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_created ON invoices(created_at);
```

### Table: `daily_pl_summary`
```sql
CREATE TABLE daily_pl_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id),
    date DATE NOT NULL,
    patients_seen INTEGER DEFAULT 0,
    total_billed_paise INTEGER DEFAULT 0,
    total_collected_paise INTEGER DEFAULT 0,
    upi_paise INTEGER DEFAULT 0,
    cash_paise INTEGER DEFAULT 0,
    card_paise INTEGER DEFAULT 0,
    pending_paise INTEGER DEFAULT 0,
    waived_paise INTEGER DEFAULT 0,
    invoice_count INTEGER DEFAULT 0,
    pnl_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, date)
);
CREATE INDEX idx_daily_pl_clinic_date ON daily_pl_summary(clinic_id, date);
```

### Table: `agent_execution_stats`
```sql
CREATE TABLE agent_execution_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id),
    date DATE NOT NULL,
    agent_name VARCHAR(50) NOT NULL,
    decisions_made INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    gemini_calls INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    avg_latency_ms FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, date, agent_name)
);
```

### Table: `referral_tracking`
```sql
CREATE TABLE referral_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id),
    patient_phone_masked VARCHAR(20) NOT NULL,
    consultation_firestore_id VARCHAR(128),
    referral_type VARCHAR(20) CHECK (referral_type IN ('lab','specialist','imaging','pharmacy')),
    description TEXT NOT NULL,
    urgency VARCHAR(20) DEFAULT 'routine' CHECK (urgency IN ('routine','urgent')),
    suggested_provider VARCHAR(255),
    status VARCHAR(20) DEFAULT 'sent'
        CHECK (status IN ('sent','acknowledged','completed','expired')),
    patient_notified_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    followup_count INTEGER DEFAULT 0,
    last_followup_at TIMESTAMPTZ,
    followup_task_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_referral_clinic ON referral_tracking(clinic_id);
CREATE INDEX idx_referral_status ON referral_tracking(status);
```

### Table: `retention_outreach`
```sql
CREATE TABLE retention_outreach (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id),
    patient_phone_masked VARCHAR(20) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL,
    message_language VARCHAR(5) NOT NULL,
    message_text TEXT NOT NULL,
    whatsapp_message_id VARCHAR(100),
    delivered BOOLEAN DEFAULT false,
    appointment_booked_after BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_retention_clinic_patient ON retention_outreach(clinic_id, patient_phone_masked);
CREATE INDEX idx_retention_sent_at ON retention_outreach(sent_at);
```

---

## 6. API ENDPOINT CONTRACTS

### Webhooks (Public — no auth)
```
GET  /webhook/whatsapp
     Query: hub.mode, hub.verify_token, hub.challenge
     Response: 200 hub.challenge string | 403

POST /webhook/whatsapp
     Header: X-Hub-Signature-256 (validated with HMAC-SHA256)
     Body: Meta WhatsApp Cloud API payload
     Response: 200 (always — processing is async)

POST /webhook/razorpay
     Header: X-Razorpay-Signature (validated)
     Body: Razorpay payment.captured event
     Response: 200
```

### Appointments (Auth required — Firebase JWT)
```
GET  /api/v1/appointments/today?clinic_id={id}
     Response: [{appointment_id, patient_name, phone_masked, slot_time, slot_time_str,
                 complaint_summary, status, consultation_type}]

POST /api/v1/appointments/walk-in
     Body: {clinic_id, patient_phone, complaint_summary, consultation_type}
     Response: {appointment_id, slot_time}

PATCH /api/v1/appointments/{id}/status
     Body: {status: "arrived"|"no_show"|"cancelled", cancel_reason?: string}
     Response: {updated: true}
```

### Consultations (Auth required)
```
POST /api/v1/consultations/start
     Body: {appointment_id, clinic_id}
     Response: {consultation_id, audio_upload_url}

POST /api/v1/consultations/{id}/audio-chunk
     Body: multipart/form-data — field "audio" (WebM/Opus blob), field "chunk_number" (int)
     Response: {received: true, chunk_number: int}

POST /api/v1/consultations/{id}/stop
     Body: {consultation_id}
     Response: {soap_note, icd10_codes, medications, safety_flags, safety_level, transcript}
     Note: This triggers ClinicalScribe + PrescriptionSafe pipeline (30-60 seconds)

POST /api/v1/consultations/{id}/approve
     Body: {soap_note: {...}, medications: [...], doctor_notes?: string, override_reason?: string}
     Response: {prescription_pdf_url, invoice_id, invoice_number, referrals_extracted: int}

GET  /api/v1/consultations/{id}
     Response: Full consultation document

GET  /api/v1/consultations/patient/{patient_id}?limit=10
     Response: [{consultation_id, date, icd10_primary, invoice_amount, status}]
```

### Billing (Auth required)
```
GET  /api/v1/billing/today?clinic_id={id}
     Response: {patients_seen, total_billed, collected, pending, invoices: [...]}

GET  /api/v1/billing/monthly?clinic_id={id}&month=7&year=2026
     Response: {month, total_billed, total_collected, days: [{date, billed, collected}]}

POST /api/v1/billing/{invoice_id}/mark-cash
     Body: {clinic_id}
     Response: {updated: true, invoice_number}

GET  /api/v1/billing/export-csv?clinic_id={id}&from=2026-07-21&to=2026-08-17
     Response: CSV file download (revenue evidence for submission)
```

### Analytics (Auth required)
```
GET  /api/v1/analytics/agent-logs?clinic_id={id}&agent=all&limit=50
     Response: [{log_id, agent_name, decision_type, decision_made, latency_ms, created_at}]

GET  /api/v1/analytics/agent-stats?clinic_id={id}&days=30
     Response: {total_decisions, by_agent: {agent_name: count}, total_gemini_calls}

GET  /api/v1/analytics/export-evidence?clinic_id={id}
     Response: JSON with all agent logs + stats (for hackathon submission)
```

### Internal (Cloud Scheduler/Tasks only — no public auth)
```
POST /internal/retention/scan
     Header: X-CloudScheduler-ScheduleTime (validation)
     Body: {} (scans all active clinics)
     Response: {clinics_scanned, patients_contacted, errors}

POST /internal/insights/scan
     Header: X-CloudScheduler-ScheduleTime
     Body: {}
     Response: {clinics_processed, reports_sent}

POST /internal/tasks/execute
     Header: X-CloudTasks-QueueName (validation)
     Body: {task_type, ...payload}
     task_type values: APPOINTMENT_REMINDER | WELLNESS_CHECK | BILLING_FOLLOWUP | REFERRAL_FOLLOWUP
     Response: {executed: true}
```

### Patients (Auth required)
```
GET  /api/v1/patients?clinic_id={id}&page=1&limit=20
     Response: paginated patient list

GET  /api/v1/patients/{id}?clinic_id={id}
     Response: full patient profile

PUT  /api/v1/patients/{id}
     Body: {name?, age?, sex?, dob?, allergies?, chronic_conditions?, notes?}
     Response: {updated: true}
```

### Health + Onboarding
```
GET  /health
     Response: {status: "ok", agents: [...agent names], timestamp}

POST /api/v1/clinics/setup
     Body: {firebase_clinic_id, name, doctor_name, speciality, location, whatsapp_phone_id,
             schedule, consultation_fees, subscription_plan}
     Response: {clinic_id (postgres), onboarding_complete: true}
```

---

## 7. WHATSAPP MESSAGE TEMPLATES

### Appointment Confirmation (all 4 languages)
```python
CONFIRMATION = {
  "te": "మీ అపాయింట్‌మెంట్ నిర్ధారించబడింది!\nడాక్టర్: {doctor_name}\nతేదీ: {date}\nసమయం: {time}\nక్రమ సంఖ్య: {queue_number}\nDr. {doctor_name} క్లినిక్",
  "hi": "आपका अपॉइंटमेंट बुक हो गया!\nडॉक्टर: {doctor_name}\nतारीख: {date}\nसमय: {time}\nनंबर: {queue_number}\nDr. {doctor_name} Clinic",
  "en": "Appointment Confirmed!\nDoctor: {doctor_name}\nDate: {date}\nTime: {time}\nQueue: #{queue_number}\n{clinic_name}",
  "ta": "உங்கள் சந்திப்பு உறுதிசெய்யப்பட்டது!\nமருத்துவர்: {doctor_name}\nதேதி: {date}\nநேரம்: {time}\nவரிசை: {queue_number}\n{clinic_name}"
}
```

### 2-Hour Reminder
```python
REMINDER = {
  "te": "గుర్తుచేయడం: మీ అపాయింట్‌మెంట్ 2 గంటల్లో ఉంది.\nసమయం: {time}\nవరుస స్థానం: {queue_position}\nDr. {doctor_name} క్లినిక్",
  "hi": "याद दिलाना: 2 घंटे में आपका अपॉइंटमेंट है।\nसमय: {time}\nनंबर: {queue_position}\nDr. {doctor_name}",
  "en": "Reminder: Your appointment with Dr. {doctor_name} is in 2 hours.\nTime: {time} | Queue: #{queue_position}",
  "ta": "நினைவூட்டல்: 2 மணி நேரத்தில் சந்திப்பு.\nநேரம்: {time} | வரிசை: {queue_position}"
}
```

### Post-Visit Wellness (T+24h)
```python
WELLNESS = {
  "te": "నమస్కారం! Dr. {doctor_name} టీమ్ మీ ఆరోగ్యం గురించి ఆందోళన చెందుతోంది. మీరు ఇప్పుడు ఎలా అనుభవిస్తున్నారు?",
  "hi": "नमस्ते! Dr. {doctor_name} की टीम आपकी सेहत की परवाह करती है। आप अभी कैसा महसूस कर रहे हैं?",
  "en": "Hello! Dr. {doctor_name}'s team is checking in. How are you feeling today?",
  "ta": "வணக்கம்! Dr. {doctor_name} குழு உங்கள் உடல்நலம் பற்றி அக்கறை கொள்கிறது. இப்போது எப்படி இருக்கிறீர்கள்?"
}
```

### Invoice with Payment Link
```python
INVOICE = {
  "en": "Invoice #{invoice_number}\n{clinic_name} — Dr. {doctor_name}\n\nConsultation: {consultation_type}\nAmount: ₹{amount}\n\nPay securely via UPI:\n{payment_link}\n\nLink valid 48 hours.",
  "te": "ఇన్వాయిస్ #{invoice_number}\n{clinic_name}\n\nసంప్రదింపు: {consultation_type}\nమొత్తం: ₹{amount}\n\nUPI ద్వారా చెల్లించండి:\n{payment_link}"
}
```

### Emergency Redirect
```python
EMERGENCY = {
  "te": "అత్యవసర పరిస్థితికి వెంటనే 108కి కాల్ చేయండి. అర్జెంట్ కంసల్టేషన్ కోసం: {clinic_phone}",
  "hi": "आपातकाल के लिए तुरंत 108 पर कॉल करें। तत्काल परामर्श: {clinic_phone}",
  "en": "For emergency, please call 108 immediately. For urgent consultation: {clinic_phone}",
  "ta": "அவசரநிலைக்கு உடனே 108ஐ அழைக்கவும். அவசர ஆலோசனை: {clinic_phone}"
}
```

---

## 8. GEMINI PROMPT SPECIFICATIONS

### 8.1 AppointmentFlow Intent Detection Prompt
**Model:** Gemini 1.5 Flash | **Temperature:** 0.1 | **Max tokens:** 256
```
SYSTEM: You are an AI that analyses WhatsApp messages sent to medical clinic appointment systems in India. Your only job is to detect the patient's intent and return structured JSON. You must handle messages in Telugu (te), Hindi (hi), English (en), and Tamil (ta).

Return ONLY valid JSON matching this exact schema. No markdown. No explanation. No code fences.

{
  "intent": "BOOK" | "CANCEL" | "RESCHEDULE" | "ENQUIRY" | "EMERGENCY" | "OTHER",
  "language": "te" | "hi" | "en" | "ta" | "other",
  "urgency": "ROUTINE" | "URGENT" | "EMERGENCY",
  "preferred_time": "string describing preferred time or null",
  "complaint_summary": "5-word max description of medical complaint or null",
  "confidence": 0.0-1.0
}

EMERGENCY indicators (any → urgency=EMERGENCY regardless of intent): chest pain, breathing problem,
unconscious, stroke, severe bleeding, accident, heart attack, నొప్పి చాలా ఉంది (severe pain),
సాయం చేయండి (help me), emergency, 911, ambulance.

EXAMPLES:
Input: "doctor garu appointment kavali" → {"intent":"BOOK","language":"te","urgency":"ROUTINE","preferred_time":null,"complaint_summary":null,"confidence":0.92}
Input: "రేపు 10 కి appointment book cheyandi" → {"intent":"BOOK","language":"te","urgency":"ROUTINE","preferred_time":"tomorrow 10 AM","complaint_summary":null,"confidence":0.95}
Input: "Appointment cancel cheyali" → {"intent":"CANCEL","language":"te","urgency":"ROUTINE","preferred_time":null,"complaint_summary":null,"confidence":0.93}
Input: "Chest pain chala undi urgent ga chupiyandi" → {"intent":"BOOK","language":"te","urgency":"EMERGENCY","preferred_time":"immediately","complaint_summary":"severe chest pain","confidence":0.99}
Input: "mujhe kal doctor se milna hai fever hai" → {"intent":"BOOK","language":"hi","urgency":"ROUTINE","preferred_time":"tomorrow","complaint_summary":"fever","confidence":0.94}
Input: "I need to reschedule my 3pm appointment" → {"intent":"RESCHEDULE","language":"en","urgency":"ROUTINE","preferred_time":"3pm","complaint_summary":null,"confidence":0.97}
Input: "Doctor availability check cheyali" → {"intent":"ENQUIRY","language":"te","urgency":"ROUTINE","preferred_time":null,"complaint_summary":null,"confidence":0.88}
Input: "Doctor fees enta" → {"intent":"ENQUIRY","language":"te","urgency":"ROUTINE","preferred_time":null,"complaint_summary":null,"confidence":0.85}

USER: {patient_message}
```

### 8.2 SOAP Note Generation Prompt
**Model:** Gemini 1.5 Pro | **Temperature:** 0.2 | **Max tokens:** 2048
```
SYSTEM: You are a clinical documentation AI trained on Indian primary care workflows. You receive consultation transcripts from solo practitioners in Tirupati, Andhra Pradesh. The transcripts may mix English and Telugu. Your job is to produce a structured SOAP note from the transcript.

RULES:
1. All output is in English regardless of transcript language.
2. Medication names must be generic (e.g., paracetamol NOT Crocin or Dolo 650).
3. If the doctor mentions a brand, include it in brand_alias field.
4. Extract only what was actually said — do not invent information.
5. If something was not discussed (e.g., no vitals), leave that field as null or empty.
6. ICD-10 codes: use ICD-10-CM 2025 edition. Provide the most specific applicable code.
7. drug_route options: oral | topical | IV | IM | sublingual | inhalation | rectal | nasal
8. frequency options: OD (once daily) | BD (twice daily) | TDS (thrice daily) | QID (four times daily) | SOS (as needed) | HS (at bedtime)
9. Flags: list anything unclear, missing, or that needs doctor's attention in review.

Return ONLY valid JSON matching the SOAP schema. No markdown fences.

{soap_output_schema}

USER: TRANSCRIPT:\n{transcript}\n\nPATIENT HISTORY:\n{patient_history_json}
```

### 8.3 Drug Interaction Check Prompt
**Model:** Gemini 1.5 Pro | **Temperature:** 0.0 | **Max tokens:** 1024
```
SYSTEM: You are a pharmacist safety screening AI. Your job is to check a list of prescribed medications for interactions, allergy conflicts, and dosage concerns. This is a safety screening tool only — the prescribing doctor makes all final clinical decisions.

CRITICAL RULES:
1. Always return valid JSON. Never return null or empty response.
2. Only flag interactions with clinical significance — avoid theoretical/minor concerns unless severity is INFO.
3. CRITICAL severity: contraindicated combinations (e.g., warfarin + aspirin), life-threatening allergy
4. WARNING: significant interaction requiring monitoring or dose adjustment
5. INFO: minor interaction or monitoring suggestion

Return ONLY valid JSON:
{"interactions":[...],"allergy_alerts":[...],"dosage_concerns":[...],"overall_safety_level":"CLEAR|WARNING|CRITICAL","block_prescription_pending_review":bool,"doctor_override_allowed":true}

USER: PRESCRIBED MEDICATIONS: {medications_json}
PATIENT ALLERGIES: {allergies_list}
PATIENT CONDITIONS: {conditions_list}
PATIENT AGE: {age}
```

### 8.4 Retention Message Drafting Prompt
**Model:** Gemini 1.5 Flash | **Temperature:** 0.7 | **Max tokens:** 150
```
SYSTEM: You draft warm, caring WhatsApp messages for a medical clinic. Messages must be under 100 words, in the specified language, respectful, and never mention specific diagnoses. End with "— Team Dr. {doctor_name}".

CRITICAL: Never write in English if language is te/hi/ta. Write authentically in the target script.
Never be pushy. Never use the word "appointment" in the first sentence.
Never mention money or fees.

USER: Draft a {trigger_type} message for a {age}-year-old patient in {language}.
Trigger context: {trigger_context}
Doctor name: {doctor_name}
Clinic name: {clinic_name}
```

### 8.5 Referral Extraction Prompt
**Model:** Gemini 1.5 Flash | **Temperature:** 0.1 | **Max tokens:** 512
```
SYSTEM: Extract all referrals, lab orders, and specialist consultations from the PLAN section of a clinical note. Return only what is explicitly mentioned. Return JSON array only.

Format: [{"type":"lab|specialist|imaging|pharmacy","description":"exact test/referral name","urgency":"routine|urgent"}]
If no referrals found, return [].

USER: PLAN SECTION: {plan_text}
```

### 8.6 Weekly Insight Report Prompt
**Model:** Gemini 1.5 Flash | **Temperature:** 0.5 | **Max tokens:** 400
```
SYSTEM: You are a healthcare analytics assistant for solo practitioners in India. Generate a weekly practice intelligence report that is actionable, concise, and written in plain English that a busy doctor can read in under 60 seconds.

Format: 3-4 short paragraphs. No bullet points. No tables. Warm, collegial tone.
Cover: this week's highlights, any diagnosis spikes or public health signals for the region, revenue trend, one actionable recommendation.

USER: CLINIC: {clinic_name}, {location}
WEEK: {week_start} to {week_end}
SEASON: {current_season} (current public health context for {location})
STATS: {clinic_stats_json}
DIAGNOSIS TRENDS: {diagnosis_trends_json}
PRIOR WEEK COMPARISON: {prior_week_json}
```

---

## 9. SUBSCRIPTION PLANS

| Plan | Price/month | Agents Included | Clinics/Doctor | Ideal For |
|---|---|---|---|---|
| Essential | ₹2,999 | AppointmentFlow + BillingPulse | 1 | New adopters, validation |
| Growth | ₹5,999 | All 7 agents | 1 | Main hackathon offering |
| Pro | ₹9,999 | All 7 agents | Up to 3 | Clinics with 2-3 doctors |

**Monthly COGS per clinic (Growth plan):**
- Gemini 1.5 Flash API: ~₹8 (intent detection, billing, retention, referral, insights)
- Gemini 1.5 Pro API: ~₹15 (SOAP notes, drug interactions)
- Google Cloud Speech-to-Text: ~₹30/30 mins of consultations
- Cloud Run (shared): ~₹5 per clinic
- Firestore + Cloud SQL: ~₹10 per clinic
- WhatsApp Cloud API: ₹0 (free tier: 1000 business-initiated / month)
- Razorpay: 2% per transaction (variable)
**Total COGS: ~₹70-90/month → Gross margin: ~97% at ₹5,999**

---

## 10. PRIVACY AND COMPLIANCE

### 10.1 India DPDP Act 2023 Compliance
- Patient consent collected at first WhatsApp interaction via interactive message
- Consent record stored in Firestore patient document (consent_given: bool, consent_at: Timestamp)
- Patients can opt out of retention messages via WhatsApp reply "STOP"
- All opt-outs respected within 24 hours

### 10.2 PHI Handling Rules (enforced in code, not just policy)
- Full phone numbers stored only in Firestore (encrypted at rest by Google)
- All Cloud Logging entries use phone_masked (last 4 digits only)
- No raw patient data in Gemini prompts — SOAP transcripts are anonymised before LLM call:
  - Patient names removed (replaced with "the patient")
  - Phone numbers removed
  - Identifying addresses removed
- Prescription PDFs stored in Firebase Storage with private access control (signed URLs)
- Cloud SQL audit logging enabled

### 10.3 PHI Anonymisation Function (reference implementation)
```python
def anonymise_for_llm(text: str, patient_name: str = None) -> str:
    """Remove PHI from text before sending to Gemini."""
    import re
    # Remove Indian phone numbers
    text = re.sub(r'(\+91|0)?[6-9]\d{9}', '[PHONE]', text)
    # Remove patient name if known
    if patient_name:
        text = text.replace(patient_name, 'the patient')
    # Remove Aadhaar patterns
    text = re.sub(r'\d{4}\s?\d{4}\s?\d{4}', '[ID]', text)
    return text
```

---

## 11. SUCCESS METRICS FOR HACKATHON

### Revenue Milestones
| Date | Target Paying Clinics | Monthly Revenue | Cumulative Evidence |
|---|---|---|---|
| July 27 | 3 | ₹8,997 | First Razorpay payments |
| August 3 | 8 | ₹23,992 | Agent log count: 500+ |
| August 10 | 12 | ₹35,988 | Agent log count: 2,000+ |
| August 17 | 15+ | ₹44,985+ | Agent log count: 5,000+ |

### Agent Activity Targets (by submission)
- AppointmentFlow decisions: 1,000+ (appointments booked, reminders, wellness checks)
- BillingPulse decisions: 500+ (invoices, payments, P&Ls)
- ClinicalScribe decisions: 200+ (SOAP notes, ICD-10 assignments)
- PrescriptionSafe decisions: 200+ (safety checks)
- RetentionRadar decisions: 300+ (patient scans, messages sent)
- InsightEngine decisions: 15+ (weekly reports = ~3 per clinic × 5 weeks)
- ReferralCoordinator decisions: 100+ (referral extractions, follow-ups)
- **Total target: 2,300+ logged agent decisions**

---

*PRD v2.0 | VaidyaAI Agents | Last updated: July 2026*
*Owner: Vinay (Health Informatician, Moana Digital Health)*
*Build with Gemini XPRIZE — Professional Services Access Category*
