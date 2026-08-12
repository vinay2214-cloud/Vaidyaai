# VaidyaAI — Hackathon Narrative

## How AI Runs Our Healthcare Business

### The Problem

In India's outpatient clinics — the backbone of primary care — a single doctor sees 60 to 80 patients every day. Each consultation generates documentation, prescriptions, billing, insurance notes, follow-up scheduling, and referral letters. The administrative burden is immense. Doctors spend more time writing than listening. Critical safety checks — drug interactions, allergy conflicts, dose verification — are done manually under time pressure. Patient follow-ups fall through the cracks. Revenue leaks through unbilled consultations and uncollected payments.

This is not a technology access problem. India has the infrastructure — smartphones, UPI payments, WhatsApp. What's missing is an intelligent operating layer that can autonomously handle clinical operations while keeping the doctor in control of medical decisions.

### What VaidyaAI Is

VaidyaAI is an AI-native clinical operating system for Indian outpatient clinics. It deploys 7 autonomous AI agents — powered by Google Cloud Vertex AI and Gemini 2.5 — that handle clinical documentation, prescription safety, billing, patient engagement, analytics, and referral coordination.

The system is designed for a single principle: **AI operates, human decides.**

### How AI Runs Day-to-Day Operations

Every patient interaction flows through our autonomous agent architecture:

**AppointmentFlow** (Gemini 2.5 Flash) handles WhatsApp-based booking and triage. When a patient messages the clinic, the agent classifies intent, offers available slots, confirms appointments, and sends automated reminders 2 hours before the visit — all in Telugu, Hindi, or English.

**ClinicalScribe** (Gemini 2.5 Pro) is the core clinical agent. During a consultation, it captures the ambient doctor-patient conversation via Speech-to-Text with speaker diarization, anonymizes Protected Health Information, and sends the transcript to Gemini 2.5 Pro for structured SOAP note generation. The output includes ICD-10 diagnosis codes, medication extraction, investigation recommendations, and follow-up scheduling — all presented as a draft for the doctor to review, edit, and approve.

**PrescriptionSafe** (Gemini 2.5 Pro) performs autonomous drug safety analysis. It checks for drug-drug interactions, allergy conflicts, contraindications, and duplicate therapy. If the AI safety check is unavailable — due to any infrastructure failure — the system fails closed: it flags the prescription for mandatory manual pharmacist review rather than assuming safety. High-severity warnings require the doctor to provide a documented clinical rationale before proceeding.

**BillingPulse** (Gemini 2.5 Flash) triggers automatically when a consultation is approved. It generates sequentially-numbered invoices with correct tax calculations, sends Razorpay UPI payment links via WhatsApp, reconciles payments, and produces daily P&L summaries.

**RetentionRadar** (Gemini 2.5 Flash) scans for patients who missed follow-ups and generates personalized outreach messages in the patient's preferred language via WhatsApp.

**InsightEngine** (Gemini 2.5 Pro) produces weekly executive briefings analyzing clinic throughput, revenue patterns, operational health, and growth recommendations.

**ReferralCoordinator** (Gemini 2.5 Pro) generates formal referral letters with clinical summaries when specialist consultation is needed.

### What Humans Do

The doctor's role is clear and protected: verify patient identity, confirm allergies, review medical history, validate vitals, review AI-generated SOAP notes, confirm diagnoses, resolve safety warnings, approve prescriptions, and make every final clinical decision. AI never silently diagnoses, prescribes, or overrides a safety rule.

Reception staff register walk-in patients, manage queue status, and handle cash payments. The clinic manager reviews financial summaries and operational analytics.

### Clinical Safety Model

Every AI action goes through a human review gate. SOAP notes are generated as drafts. Prescription safety warnings require explicit clinician override with documented rationale. Allergy status must be reviewed before any prescription workflow proceeds. If critical AI infrastructure is unavailable, the system refuses to operate rather than producing unreliable outputs.

All AI decisions are logged with full provenance: agent name, model used, latency, correlation ID, timestamp, and success/failure status. This creates a complete audit trail that connects every consultation to every AI action.

### Jobs and Economic Opportunity

VaidyaAI enables a new category of AI-augmented clinic operations. By automating documentation and administrative tasks, it allows doctors to see more patients with better clinical outcomes. It enables clinic managers to run data-driven operations. It creates opportunities for clinical AI support roles and health technology implementation specialists.

The platform is designed for multi-tenant deployment, allowing a single operational team to support [INSERT VERIFIED CLINIC COUNT] clinics across different specialties and languages.

### Business Model

VaidyaAI operates as a SaaS platform with subscription-based pricing. Revenue is generated through monthly clinic subscriptions that include all 7 AI agents, unlimited consultations, WhatsApp integration, and Razorpay payment processing.

[INSERT VERIFIED REVENUE DURING HACKATHON PERIOD]

[INSERT VERIFIED USER/CUSTOMER COUNT]

[INSERT VERIFIED EXPENSE BREAKDOWN: Infrastructure, APIs, AI usage, Marketing]

### Why This Matters

The Indian outpatient healthcare system serves hundreds of millions of patients annually through small clinics. If every clinic could operate with autonomous AI documentation, safety checking, billing, and patient engagement — while keeping the doctor firmly in control of clinical decisions — the impact on healthcare quality, efficiency, and accessibility would be transformative.

VaidyaAI isn't a demo. It's a live business built on AI-native operations, where Gemini 2.5 Pro and Gemini 2.5 Flash are not features — they are the operating infrastructure.

---

*Word count: ~825 words (excluding placeholders)*

> **NOTE:** Sections marked with [INSERT ...] require verified data from actual business operations. Do not fabricate these values. Provide real figures or remove the sections before submission.
