# Technical Architecture — VaidyaAI Agents
## Version 2.0 | Complete Implementation Specification
## Build with Gemini XPRIZE | Primary LLM: Gemini 1.5 Flash/Pro via Vertex AI

---

## 1. SYSTEM OVERVIEW

VaidyaAI is a cloud-native, event-driven, multi-agent system hosted entirely on Google Cloud
Platform. The architecture is designed around one constraint: the system must run a medical
clinic autonomously 24/7 with zero human staff operating it.

**Architecture pattern:** Event-driven microservices. WhatsApp messages and scheduled events
are the primary triggers. FastAPI processes webhooks and fires agents. Agents write decisions
to Cloud Logging (evidence) and state to Firestore/PostgreSQL. The Next.js dashboard consumes
real-time Firestore streams. Nothing is synchronous where it doesn't need to be.

---

## 2. TECHNOLOGY STACK — EXACT VERSIONS

### Backend
```
Python               3.11.x
FastAPI              0.111.0
Uvicorn              0.29.0  (with gunicorn workers in prod)
Pydantic             2.7.1
SQLAlchemy           2.0.30
asyncpg              0.29.0
alembic              1.13.1
httpx                0.27.0
python-multipart     0.0.9
firebase-admin       6.5.0
google-cloud-aiplatform  1.59.0
google-cloud-speech  2.26.0
google-cloud-tasks   2.16.3
google-cloud-logging 3.10.0
google-cloud-storage 2.17.0
reportlab            4.2.2
razorpay             1.4.1
python-jose          3.3.0   (JWT validation)
cryptography         42.0.7
Pillow               10.3.0
python-dotenv        1.0.1
```

### Frontend
```
Node.js              20.x LTS
Next.js              14.2.x  (App Router)
React                18.3.x
TypeScript           5.4.x
Tailwind CSS         3.4.x
shadcn/ui            latest  (radix-ui primitives)
Zustand              4.5.x   (global state)
Firebase JS SDK      10.12.x
Axios                1.7.x
Recharts             2.12.x
React Hook Form      7.51.x
Zod                  3.23.x
date-fns             3.6.x
lucide-react         0.383.x
next-pwa             5.6.x   (service worker for mobile install)
```

### Google Cloud Services
```
Vertex AI            Gemini 1.5 Flash (gemini-1.5-flash-001)
                     Gemini 1.5 Pro   (gemini-1.5-pro-001)  — for SOAP + drug checks
Cloud Run            gen2, asia-south1
Firebase Firestore   Native mode, asia-south1
Firebase Auth        Phone OTP
Firebase Storage     asia-south1
Cloud SQL            PostgreSQL 15, db-f1-micro, asia-south1
Cloud Tasks          3 queues — asia-south1
Cloud Scheduler      2 jobs — IST timezone
Cloud Logging        asia-south1
Cloud Storage        asia-south1  (audio files for STT)
Cloud Build          CI/CD pipeline
Secret Manager       All credentials
Speech-to-Text       v2, asia-south1
```

---

## 3. REPOSITORY STRUCTURE

```
vaidyaai-agents/
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   ├── cloudbuild.yaml
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── base_agent.py          ← BaseAgent class (logging, error handling)
│   │   ├── appointment_flow.py    ← Agent 1
│   │   ├── clinical_scribe.py     ← Agent 2
│   │   ├── billing_pulse.py       ← Agent 3
│   │   ├── retention_radar.py     ← Agent 4
│   │   ├── prescription_safe.py   ← Agent 5
│   │   ├── insight_engine.py      ← Agent 6
│   │   └── referral_coordinator.py ← Agent 7
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── webhooks.py            ← WhatsApp + Razorpay webhooks
│   │   ├── appointments.py
│   │   ├── consultations.py
│   │   ├── billing.py
│   │   ├── patients.py
│   │   ├── analytics.py
│   │   ├── clinics.py             ← Setup + onboarding
│   │   └── internal.py            ← Cloud Scheduler + Tasks handlers
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── gemini.py              ← Vertex AI Gemini wrapper (all models)
│   │   ├── whatsapp.py            ← Meta WhatsApp Cloud API
│   │   ├── speech_to_text.py      ← GCS STT v2
│   │   ├── razorpay_svc.py        ← Razorpay payment links
│   │   └── pdf_generator.py       ← ReportLab prescriptions
│   │
│   ├── database/
│   │   ├── __init__.py
│   │   ├── firestore.py           ← Firebase Admin SDK client
│   │   ├── postgres.py            ← SQLAlchemy async engine
│   │   └── migrations/
│   │       └── 001_initial.sql
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── clinic.py
│   │   ├── patient.py
│   │   ├── appointment.py
│   │   ├── consultation.py
│   │   └── billing.py
│   │
│   ├── tasks/
│   │   ├── __init__.py
│   │   └── cloud_tasks.py         ← Task creation + cancellation helpers
│   │
│   ├── prompts/
│   │   ├── __init__.py
│   │   ├── appointment_intent.py  ← APPOINTMENT_INTENT_SYSTEM_PROMPT
│   │   ├── soap_generation.py     ← SOAP_GENERATION_SYSTEM_PROMPT
│   │   ├── drug_interaction.py    ← DRUG_INTERACTION_SYSTEM_PROMPT
│   │   ├── retention_message.py   ← RETENTION_MESSAGE_SYSTEM_PROMPT
│   │   ├── referral_extract.py    ← REFERRAL_EXTRACTION_SYSTEM_PROMPT
│   │   └── insight_report.py      ← INSIGHT_REPORT_SYSTEM_PROMPT
│   │
│   └── utils/
│       ├── __init__.py
│       ├── agent_logger.py        ← Structured Cloud Logging for agent decisions
│       ├── phone_utils.py         ← Masking, formatting, E.164 normalisation
│       ├── phi_anonymiser.py      ← PHI removal before LLM calls
│       ├── date_utils.py          ← IST timezone helpers
│       └── evidence_export.py     ← Hackathon submission evidence generator
│
├── frontend/
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── app/
│       │   ├── layout.tsx          ← Root layout with providers
│       │   ├── globals.css
│       │   ├── (auth)/
│       │   │   └── login/
│       │   │       └── page.tsx    ← Firebase phone OTP login
│       │   └── (dashboard)/
│       │       ├── layout.tsx      ← Auth guard + bottom nav
│       │       ├── page.tsx        ← Home: Today's appointments
│       │       ├── consultation/
│       │       │   └── [id]/
│       │       │       └── page.tsx ← Consultation recorder + SOAP review
│       │       ├── billing/
│       │       │   └── page.tsx
│       │       ├── patients/
│       │       │   ├── page.tsx
│       │       │   └── [id]/
│       │       │       └── page.tsx
│       │       ├── analytics/
│       │       │   └── page.tsx
│       │       └── logs/
│       │           └── page.tsx    ← Agent log feed (key hackathon screen)
│       │
│       ├── components/
│       │   ├── ui/                 ← shadcn/ui base components
│       │   ├── AppointmentCard.tsx
│       │   ├── ConsultationRecorder.tsx
│       │   ├── SOAPNoteEditor.tsx
│       │   ├── SafetyFlagsPanel.tsx
│       │   ├── AgentLogFeed.tsx    ← Real-time decision stream
│       │   ├── BillingCard.tsx
│       │   ├── PatientProfile.tsx
│       │   ├── AgentStatusBar.tsx  ← Shows all 7 agents + last activity
│       │   └── OnboardingWizard.tsx
│       │
│       ├── hooks/
│       │   ├── useAuth.ts          ← Firebase auth state
│       │   ├── useClinic.ts        ← Clinic profile
│       │   ├── useAppointmentsToday.ts ← Firestore onSnapshot
│       │   ├── useAgentLogs.ts     ← Real-time Firestore agent_logs
│       │   ├── useConsultation.ts  ← Audio recording state machine
│       │   └── useBilling.ts       ← Today's P&L
│       │
│       ├── store/
│       │   ├── clinicStore.ts      ← Zustand: clinic, doctor, subscription
│       │   └── uiStore.ts          ← Zustand: sidebar, modals, toasts
│       │
│       └── lib/
│           ├── firebase.ts         ← Firebase app init
│           ├── api.ts              ← Axios instance with auth interceptor
│           └── constants.ts        ← App constants (plans, statuses, etc.)
│
├── infrastructure/
│   ├── cloudbuild.yaml             ← Backend CI/CD
│   ├── frontend-cloudbuild.yaml    ← Frontend CI/CD
│   └── .github/workflows/
│       └── deploy.yml
│
├── scripts/
│   ├── gcp_setup.sh               ← One-command GCP project setup
│   ├── setup_secrets.sh           ← Populate Secret Manager
│   ├── seed_demo_clinic.py        ← Demo data for video recording
│   ├── export_evidence.py         ← Hackathon submission evidence exporter
│   └── deploy.sh                  ← Production deployment trigger
│
└── docs/
    ├── SUBMISSION_EVIDENCE/       ← Drop exported evidence here
    └── VIDEO_SCRIPT.md
```

---

## 4. BACKEND ARCHITECTURE

### 4.1 FastAPI Application Structure (main.py)
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from database.postgres import init_db
from database.firestore import init_firestore
import google.cloud.logging

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    google.cloud.logging.Client().setup_logging()
    await init_db()
    await init_firestore()
    print("VaidyaAI Agents — all 7 agents online")
    yield
    # Shutdown (nothing to clean up for Cloud Run)

app = FastAPI(title="VaidyaAI Agents API", version="1.0.0", lifespan=lifespan)

# Routers
app.include_router(webhooks.router, tags=["webhooks"])
app.include_router(appointments.router, prefix="/api/v1", tags=["appointments"])
app.include_router(consultations.router, prefix="/api/v1", tags=["consultations"])
app.include_router(billing.router, prefix="/api/v1", tags=["billing"])
app.include_router(patients.router, prefix="/api/v1", tags=["patients"])
app.include_router(analytics.router, prefix="/api/v1", tags=["analytics"])
app.include_router(clinics.router, prefix="/api/v1", tags=["clinics"])
app.include_router(internal.router, prefix="/internal", tags=["internal"])

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "agents": ["appointment_flow","clinical_scribe","billing_pulse",
                   "retention_radar","prescription_safe","insight_engine","referral_coordinator"],
        "primary_llm": "gemini-1.5-flash (Vertex AI asia-south1)",
        "version": "1.0.0"
    }
```

### 4.2 BaseAgent Class (agents/base_agent.py)
```python
"""
All 7 VaidyaAI agents inherit from BaseAgent.
BaseAgent handles: structured logging, error recovery, Gemini client access.
"""
import time
import logging
from abc import ABC
from services.gemini import GeminiService
from utils.agent_logger import AgentLogger

class BaseAgent(ABC):
    def __init__(self, agent_name: str):
        self.agent_name = agent_name
        self.gemini = GeminiService()
        self.logger = AgentLogger(agent_name)
        self.log = logging.getLogger(f"vaidyaai.{agent_name}")

    async def _timed_gemini_call(self, task: str, prompt: str,
                                  system_prompt: str = None,
                                  model: str = "gemini-1.5-flash") -> tuple[str, int]:
        """Call Gemini and return (response_text, latency_ms)."""
        start = time.monotonic()
        result = await self.gemini.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            model=model
        )
        latency_ms = int((time.monotonic() - start) * 1000)
        self.log.info(f"{task} | latency={latency_ms}ms | model={model}")
        return result, latency_ms
```

### 4.3 GeminiService (services/gemini.py)
```python
"""
Single Gemini client shared by all agents.
Supports both gemini-1.5-flash and gemini-1.5-pro.
Handles: retry on quota errors, JSON extraction, error logging.
"""
import vertexai
import asyncio
from vertexai.generative_models import GenerativeModel, GenerationConfig
import json, re, os

class GeminiService:
    def __init__(self):
        vertexai.init(
            project=os.environ["GOOGLE_CLOUD_PROJECT"],
            location="asia-south1"
        )
        self.models = {
            "gemini-1.5-flash": GenerativeModel(
                "gemini-1.5-flash-001",
                generation_config=GenerationConfig(temperature=0.2, max_output_tokens=2048)
            ),
            "gemini-1.5-pro": GenerativeModel(
                "gemini-1.5-pro-001",
                generation_config=GenerationConfig(temperature=0.1, max_output_tokens=4096)
            )
        }

    async def generate(self, prompt: str, system_prompt: str = None,
                       model: str = "gemini-1.5-flash") -> str:
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        for attempt in range(3):
            try:
                response = await asyncio.to_thread(
                    self.models[model].generate_content, full_prompt
                )
                return response.text
            except Exception as e:
                if attempt == 2: raise
                await asyncio.sleep(5 * (attempt + 1))  # 5s, 10s backoff

    async def generate_json(self, prompt: str, system_prompt: str = None,
                             model: str = "gemini-1.5-flash") -> dict:
        """Generate and parse JSON response. Handles markdown code fences."""
        raw = await self.generate(prompt, system_prompt, model)
        clean = re.sub(r'```(?:json)?\n?', '', raw).strip().rstrip('```').strip()
        try:
            return json.loads(clean)
        except json.JSONDecodeError:
            # Last resort: find JSON object in response
            match = re.search(r'\{.*\}', clean, re.DOTALL)
            if match:
                return json.loads(match.group())
            raise ValueError(f"Gemini did not return valid JSON: {raw[:200]}")
```

### 4.4 Agent Logger (utils/agent_logger.py)
```python
"""
Structured Cloud Logging for all agent decisions.
Every decision is logged here — this is the primary judge evidence.
"""
import logging
import google.cloud.logging
from datetime import datetime, timezone
from typing import Optional

cloud_client = google.cloud.logging.Client()

class AgentLogger:
    def __init__(self, agent_name: str):
        self.agent_name = agent_name
        self.logger = cloud_client.logger("vaidyaai-agents")

    async def log_decision(
        self,
        decision_type: str,
        decision_made: str,
        clinic_id: str,
        input_summary: str = "",
        output_summary: str = "",
        model_used: str = "gemini-1.5-flash",
        latency_ms: int = 0,
        patient_phone_masked: Optional[str] = None,
        appointment_id: Optional[str] = None,
        consultation_id: Optional[str] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        extra: dict = {}
    ):
        payload = {
            "agent": self.agent_name,
            "decision_type": decision_type,
            "decision_made": decision_made,
            "clinic_id": clinic_id,
            "input_summary": input_summary,
            "output_summary": output_summary,
            "model_used": model_used,
            "latency_ms": latency_ms,
            "success": success,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **extra
        }
        if patient_phone_masked:
            payload["patient_phone_masked"] = patient_phone_masked
        if appointment_id:
            payload["appointment_id"] = appointment_id
        if consultation_id:
            payload["consultation_id"] = consultation_id
        if error_message:
            payload["error_message"] = error_message

        self.logger.log_struct(
            payload,
            severity="INFO" if success else "ERROR",
            labels={"agent": self.agent_name, "clinic_id": clinic_id}
        )
```

### 4.5 WhatsApp Service (services/whatsapp.py)
```python
"""
Meta WhatsApp Cloud API wrapper.
All outbound messages go through this class.
"""
import httpx, os, hmac, hashlib, json
from typing import Optional

WHATSAPP_API_URL = "https://graph.facebook.com/v19.0"

class WhatsAppService:
    def __init__(self):
        self.phone_id = os.environ["WHATSAPP_PHONE_ID"]
        self.token = os.environ["WHATSAPP_ACCESS_TOKEN"]
        self.base_url = f"{WHATSAPP_API_URL}/{self.phone_id}/messages"

    async def send_text(self, to: str, message: str) -> dict:
        return await self._send({"type": "text", "text": {"body": message, "preview_url": False}}, to)

    async def send_interactive_list(self, to: str, body: str,
                                     button_label: str, sections: list[dict]) -> dict:
        """sections = [{"title": str, "rows": [{"id": str, "title": str, "description": str}]}]"""
        return await self._send({
            "type": "interactive",
            "interactive": {
                "type": "list",
                "body": {"text": body},
                "action": {"button": button_label, "sections": sections}
            }
        }, to)

    async def send_document(self, to: str, url: str,
                             filename: str, caption: str) -> dict:
        return await self._send({
            "type": "document",
            "document": {"link": url, "filename": filename, "caption": caption}
        }, to)

    def verify_webhook_signature(self, body: bytes, signature: str) -> bool:
        expected = hmac.new(
            os.environ["WHATSAPP_APP_SECRET"].encode(),
            body, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(f"sha256={expected}", signature)

    def parse_incoming_message(self, payload: dict) -> Optional[dict]:
        try:
            entry = payload["entry"][0]["changes"][0]["value"]
            messages = entry.get("messages", [])
            if not messages: return None
            msg = messages[0]
            result = {
                "from_phone": msg["from"],
                "message_id": msg["id"],
                "message_type": msg["type"],
                "timestamp": msg["timestamp"],
                "message_text": None,
                "list_reply_id": None,
                "button_reply_id": None,
            }
            if msg["type"] == "text":
                result["message_text"] = msg["text"]["body"]
            elif msg["type"] == "interactive":
                itype = msg["interactive"]["type"]
                if itype == "list_reply":
                    result["list_reply_id"] = msg["interactive"]["list_reply"]["id"]
                    result["message_text"] = msg["interactive"]["list_reply"]["title"]
                elif itype == "button_reply":
                    result["button_reply_id"] = msg["interactive"]["button_reply"]["id"]
            return result
        except (KeyError, IndexError):
            return None

    async def _send(self, message_obj: dict, to: str) -> dict:
        payload = {"messaging_product": "whatsapp", "recipient_type": "individual",
                   "to": to, **message_obj}
        async with httpx.AsyncClient() as client:
            for attempt in range(3):
                try:
                    r = await client.post(
                        self.base_url,
                        headers={"Authorization": f"Bearer {self.token}",
                                 "Content-Type": "application/json"},
                        json=payload, timeout=10
                    )
                    r.raise_for_status()
                    return r.json()
                except httpx.HTTPStatusError as e:
                    if e.response.status_code < 500 or attempt == 2:
                        raise
```

---

## 5. FRONTEND ARCHITECTURE

### 5.1 Authentication Flow
```
User opens app → layout.tsx checks Firebase Auth state
  → Not authenticated → redirect to /login
  → /login: enter +91 phone number → RecaptchaVerifier (invisible)
  → signInWithPhoneNumber() → OTP arrives → confirmationResult.confirm(otp)
  → Firebase user created → fetch clinic profile from Firestore clinic_users/{uid}
  → Store clinicId, doctorName in Zustand clinicStore
  → Redirect to /dashboard
```

### 5.2 State Management (Zustand stores)
```typescript
// store/clinicStore.ts
interface ClinicStore {
  clinicId: string | null;
  doctorName: string;
  doctorPhone: string;
  subscriptionPlan: 'essential' | 'growth' | 'pro';
  agentsEnabled: Record<string, boolean>;
  // Actions
  setClinic: (data: ClinicProfile) => void;
  reset: () => void;
}

// store/uiStore.ts
interface UIStore {
  activeConsultationId: string | null;
  isRecording: boolean;
  setActiveConsultation: (id: string | null) => void;
  setRecording: (state: boolean) => void;
}
```

### 5.3 Real-time Hooks (Firestore onSnapshot)

#### useAppointmentsToday.ts
```typescript
export function useAppointmentsToday(clinicId: string) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  useEffect(() => {
    if (!clinicId) return;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const q = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinicId),
      where('slot_date', '==', today),
      orderBy('slot_time', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
    });
    return unsub; // Cleanup on unmount
  }, [clinicId]);
  return appointments;
}
```

#### useAgentLogs.ts
```typescript
export function useAgentLogs(clinicId: string, agentFilter: string = 'all', limit: number = 50) {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  useEffect(() => {
    if (!clinicId) return;
    let q = query(
      collection(db, 'agent_logs'),
      where('clinic_id', '==', clinicId),
      orderBy('created_at', 'desc'),
      firestoreLimit(limit)
    );
    if (agentFilter !== 'all') {
      q = query(q, where('agent_name', '==', agentFilter));
    }
    const unsub = onSnapshot(q, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AgentLog)));
    });
    return unsub;
  }, [clinicId, agentFilter, limit]);
  return logs;
}
```

### 5.4 Audio Recording Pipeline (ConsultationRecorder.tsx)
```typescript
/**
 * Audio capture → chunk upload → real-time transcript → SOAP generation
 * Uses MediaRecorder API (WebM/Opus format — best for speech recognition)
 */

const startRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true }
  });
  const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
  let chunkNumber = 0;

  recorder.ondataavailable = async (e) => {
    if (e.data.size > 0) {
      const formData = new FormData();
      formData.append('audio', e.data, `chunk_${chunkNumber}.webm`);
      formData.append('chunk_number', chunkNumber.toString());
      await api.post(`/api/v1/consultations/${consultationId}/audio-chunk`, formData);
      chunkNumber++;
    }
  };

  recorder.start(5000); // Send chunk every 5 seconds
  setIsRecording(true);
  recorderRef.current = recorder;
};

const stopRecording = async () => {
  recorderRef.current?.stop();
  setIsRecording(false);
  setIsProcessing(true);
  // Backend assembles audio, runs STT, generates SOAP note
  const result = await api.post(`/api/v1/consultations/${consultationId}/stop`);
  setSoapNote(result.data.soap_note);
  setSafetyFlags(result.data.safety_flags);
  setIsProcessing(false);
};
```

### 5.5 Agent Logs Screen (logs/page.tsx)
```
This is the most important screen for the hackathon demo video.
Shows real-time feed of all 7 agents making decisions.

Layout:
┌─────────────────────────────────────────────────┐
│  🤖 Agent Decision Feed              [Export]   │
│  Total today: 47 decisions                       │
│  ─────────────────────────────────────────────  │
│  [All] [AppointmentFlow] [Billing] [Scribe]...  │
│  ─────────────────────────────────────────────  │
│  ● appointment_flow    10:23 AM    187ms         │
│    Appointment booked for ****7892               │
│    Telugu | Tomorrow 10:00 AM | gemini-1.5-flash │
│  ─────────────────────────────────────────────  │
│  ● billing_pulse       10:25 AM    312ms         │
│    Invoice VDY-20260804-1023 sent ₹300           │
│    UPI payment link created | gemini-1.5-flash   │
│  ─────────────────────────────────────────────  │
│  ● prescription_safe   10:27 AM    891ms         │
│    Prescription CLEARED — no interactions        │
│    3 medications checked | gemini-1.5-pro        │
└─────────────────────────────────────────────────┘

Agent colour coding:
  appointment_flow    → blue   (#3B82F6)
  clinical_scribe     → orange (#F97316)
  billing_pulse       → green  (#22C55E)
  retention_radar     → purple (#A855F7)
  prescription_safe   → red    (#EF4444)
  insight_engine      → teal   (#14B8A6)
  referral_coordinator→ yellow (#EAB308)
```

### 5.6 Mobile-First Design Rules
```
Primary viewport: 375px (iPhone SE / most Android phones)
Font scale: base 14px, titles 18px, labels 12px
Touch targets: minimum 44px × 44px (WCAG 2.1)
Bottom navigation: 60px fixed, 5 icons max
No horizontal scroll on any screen
Loading states: skeleton cards, not spinners
Error states: inline toast, not modal blocking
Offline: PWA service worker caches dashboard shell
```

---

## 6. AGENT PIPELINE — COMPLETE DATA FLOWS

### 6.1 AppointmentFlow Complete Flow
```
[Patient WhatsApp Message]
       ↓
POST /webhook/whatsapp
  ↓ validate X-Hub-Signature-256
  ↓ parse_incoming_message() → {from_phone, message_text, message_type}
  ↓ lookup clinic_id by whatsapp_phone_id (Firestore clinics query)
  ↓ check pending_bookings/{from_phone} — is there a pending slot selection?

  IF pending booking exists AND message is list_reply:
    ↓ AppointmentFlowAgent._handle_slot_selection()
    ↓ create appointment in Firestore
    ↓ schedule reminders (Cloud Tasks × 2)
    ↓ send confirmation WhatsApp
    ↓ log: "appointment_booked"

  IF new message:
    ↓ AppointmentFlowAgent.handle_incoming_message()
    ↓ Gemini 1.5 Flash: detect_intent(message_text)
    ↓ log: "intent_detected" with language, intent, latency

    IF intent=EMERGENCY:
      ↓ send emergency redirect WhatsApp
      ↓ log: "emergency_redirected"

    IF intent=BOOK:
      ↓ get_available_slots(clinic_id) → Firestore appointments query
      ↓ generate slot options (next 6 available 30-min slots)
      ↓ send WhatsApp interactive list (3 slots shown)
      ↓ save pending_bookings/{from_phone} (expires 30 min)
      ↓ log: "slots_offered"

    IF intent=CANCEL:
      ↓ find patient's upcoming appointment in Firestore
      ↓ update status=cancelled
      ↓ cancel Cloud Tasks (reminder + wellness)
      ↓ send cancellation confirmation
      ↓ log: "appointment_cancelled"

[Return 200 immediately to Meta webhook — all processing is async]
```

### 6.2 ClinicalScribe + PrescriptionSafe Complete Flow
```
[Doctor taps "Stop Recording" in dashboard]
       ↓
POST /api/v1/consultations/{id}/stop
  ↓ retrieve all audio chunks from Firebase Storage
  ↓ concatenate and upload to GCS: gs://vaidyaai-consultations/{id}/full.webm
  ↓ ClinicalScribeAgent.transcribe_and_generate_soap()
  
  PARALLEL:
    ↓ GCS Speech-to-Text v2 batch recognition
       - language: en-IN, alternative: te-IN
       - model: medical_dictation (or latest_long)
       - enable_diarization: 2 speakers
       - medical speech context (drug names, medical terms)
    ↓ Returns transcript (doctor + patient diarized)
    
  ↓ phi_anonymiser.anonymise_for_llm(transcript)
  ↓ Gemini 1.5 Pro: generate_soap_note(anonymised_transcript, patient_history)
  ↓ log: "soap_generated" with word_count, icd10_count, latency_ms
  
  ↓ PrescriptionSafeAgent.validate_prescription(medications, allergies, conditions)
  ↓ Gemini 1.5 Pro: check_drug_interactions(medications, allergies, conditions)
  ↓ log: "prescription_checked" with safety_level, flag_count, latency_ms
  
  ↓ Update Firestore consultation: soap_note, medications, safety_flags, status=review
  ↓ Return full result to dashboard → doctor reviews SOAP note

[Doctor taps "Approve"]
       ↓
POST /api/v1/consultations/{id}/approve
  ↓ Update Firestore consultation status=approved
  ↓ ClinicalScribeAgent.generate_prescription_pdf()
     → ReportLab A5 PDF (clinic letterhead, Rx, medications, ICD-10, advice)
     → Upload to Firebase Storage (private)
     → Return signed URL (valid 7 days)
  ↓ log: "pdf_generated"
  
  PARALLEL:
    ↓ BillingPulseAgent.on_consultation_close() → invoice + WhatsApp
    ↓ ReferralCoordinatorAgent.check_for_referrals() → extract + notify
    ↓ Update patient.last_visit in Firestore
    ↓ Update patient.chronic_conditions if new diagnosis
```

### 6.3 RetentionRadar Daily Scan Flow
```
[Cloud Scheduler: 8:00 AM IST daily]
       ↓
POST /internal/retention/scan
  ↓ validate X-CloudScheduler-ScheduleTime header
  ↓ get all active clinic_ids from PostgreSQL
  ↓ For each clinic (sequential to avoid rate limits):
  
    RetentionRadarAgent.run_daily_scan(clinic_id):
      ↓ load all patients where clinic_id={id} (Firestore)
      ↓ log: "scan_started" with patient_count
      
      For each patient (evaluate triggers in priority order):
        ↓ check retention_outreach table: patient_phone_masked, sent_at > 30 days ago
        ↓ IF recently contacted → skip, log: "rate_limit_skipped"
        
        ↓ Evaluate trigger conditions:
           CHRONIC_OVERDUE: patient.chronic_conditions not empty AND 
                            (now - patient.last_visit) > 45 days
           POST_TREATMENT_FOLLOWUP: last_soap.plan.follow_up_days AND
                                     (now - last_visit) > follow_up_days
           REFERRAL_INCOMPLETE: referral_tracking WHERE clinic_id=X AND
                                 patient_phone_masked=Y AND status='sent' AND
                                 created_at < now - 21 days
           LONG_INACTIVE: (now - last_visit) > 90 days AND NOT chronic
           SEASONAL_RISK: current month in season AND not visited in 60 days
           BIRTHDAY: patient.dob matches today or tomorrow
        
        IF triggered:
          ↓ Gemini 1.5 Flash: draft_retention_message(patient, trigger, language)
          ↓ log: "message_drafted"
          ↓ WhatsAppService.send_text(patient.phone, message)
          ↓ INSERT INTO retention_outreach
          ↓ Firestore agent_logs: log_decision("message_sent")
          ↓ log: "message_sent"
      
      ↓ WhatsAppService.send_text(doctor.phone, morning_summary)
      ↓ log: "scan_completed" with totals
```

---

## 7. GOOGLE CLOUD INTEGRATION DETAILS

### 7.1 Vertex AI — Gemini Configuration
```python
# Region: asia-south1 (Mumbai) — closest to Tirupati, lowest latency
# Models used:
#   gemini-1.5-flash-001 — AppointmentFlow, BillingPulse, RetentionRadar,
#                          InsightEngine, ReferralCoordinator
#   gemini-1.5-pro-001   — ClinicalScribe (SOAP), PrescriptionSafe (drug safety)

import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig

vertexai.init(project="vaidyaai-prod", location="asia-south1")

# Flash config (speed-optimised)
flash_config = GenerationConfig(
    temperature=0.2,
    top_p=0.95,
    max_output_tokens=2048,
    candidate_count=1
)

# Pro config (quality-optimised for clinical tasks)
pro_config = GenerationConfig(
    temperature=0.1,     # Very low — clinical output must be consistent
    top_p=0.9,
    max_output_tokens=4096,
    candidate_count=1
)
```

### 7.2 Cloud Speech-to-Text v2
```python
from google.cloud.speech_v2 import SpeechClient, types

def build_recognizer_config() -> types.RecognitionConfig:
    return types.RecognitionConfig(
        explicit_decoding_config=types.ExplicitDecodingConfig(
            encoding=types.ExplicitDecodingConfig.AudioEncoding.WEBM_OPUS,
            sample_rate_hertz=16000,
            audio_channel_count=1
        ),
        language_codes=["en-IN", "te-IN"],  # Primary: Indian English + Telugu
        model="medical_dictation",          # Best for clinical speech
        features=types.RecognitionFeatures(
            enable_automatic_punctuation=True,
            enable_spoken_punctuation=True,
            diarization_config=types.SpeakerDiarizationConfig(
                enable_speaker_diarization=True,
                min_speaker_count=2,
                max_speaker_count=2
            ),
            # Medical context phrases — improves recognition of clinical terms
        )
    )
```

### 7.3 Cloud Tasks — Queue Configuration
```
Queue: appointment-reminders
  Location: asia-south1
  Max dispatches per second: 100
  Max concurrent dispatches: 1000
  Retry: max_attempts=3, min_backoff=5s, max_backoff=60s
  Task retention: 7 days

Queue: billing-followups
  Location: asia-south1
  Max dispatches per second: 50
  Task retention: 14 days

Queue: retention-outreach
  Location: asia-south1
  Max dispatches per second: 20   (WhatsApp rate limit respect)
  Task retention: 7 days
```

### 7.4 Cloud Scheduler — Job Configuration
```
Job: retention-radar-daily
  Schedule: 0 2 * * *        (2:30 AM UTC = 8:00 AM IST)
  Timezone: UTC
  Target: POST https://{BACKEND_URL}/internal/retention/scan
  Auth: Service account OIDC token
  Retry: max_retry_duration=300s

Job: insight-engine-weekly
  Schedule: 30 3 * * 1       (3:30 AM UTC = 9:00 AM IST, every Monday)
  Timezone: UTC
  Target: POST https://{BACKEND_URL}/internal/insights/scan
  Auth: Service account OIDC token

Job: billing-pnl-daily
  Schedule: 30 15 * * *      (3:30 PM UTC = 9:00 PM IST)
  Timezone: UTC
  Target: POST https://{BACKEND_URL}/internal/billing/send-daily-pnl
  Auth: Service account OIDC token
```

### 7.5 Firebase Firestore Indexes (firestore.indexes.json)
```json
{
  "indexes": [
    {
      "collectionGroup": "appointments",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "clinic_id", "order": "ASCENDING"},
        {"fieldPath": "slot_date", "order": "ASCENDING"},
        {"fieldPath": "status", "order": "ASCENDING"}
      ]
    },
    {
      "collectionGroup": "appointments",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "clinic_id", "order": "ASCENDING"},
        {"fieldPath": "slot_time", "order": "ASCENDING"}
      ]
    },
    {
      "collectionGroup": "patients",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "clinic_id", "order": "ASCENDING"},
        {"fieldPath": "last_visit", "order": "ASCENDING"}
      ]
    },
    {
      "collectionGroup": "agent_logs",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "clinic_id", "order": "ASCENDING"},
        {"fieldPath": "created_at", "order": "DESCENDING"}
      ]
    },
    {
      "collectionGroup": "agent_logs",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "clinic_id", "order": "ASCENDING"},
        {"fieldPath": "agent_name", "order": "ASCENDING"},
        {"fieldPath": "created_at", "order": "DESCENDING"}
      ]
    }
  ]
}
```

---

## 8. DEPLOYMENT ARCHITECTURE

### 8.1 Cloud Run Services
```
Service: vaidyaai-backend
  Image: gcr.io/vaidyaai-prod/vaidyaai-backend:latest
  Region: asia-south1
  Memory: 2GiB
  CPU: 2
  Min instances: 1          (no cold starts — webhooks must respond fast)
  Max instances: 10
  Concurrency: 80
  Request timeout: 300s     (long for transcription jobs)
  Allow unauthenticated: YES (WhatsApp webhooks are public)
  Service account: vaidyaai-backend@vaidyaai-prod.iam.gserviceaccount.com
  Env via Secret Manager: ALL credentials

Service: vaidyaai-frontend
  Image: gcr.io/vaidyaai-prod/vaidyaai-frontend:latest
  Region: asia-south1
  Memory: 512MiB
  CPU: 1
  Min instances: 0          (doctor dashboard not 24/7 traffic)
  Max instances: 5
  Allow unauthenticated: YES
```

### 8.2 Dockerfile (backend)
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# System dependencies for ReportLab, audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc libc-dev libffi-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run expects the server to listen on PORT env variable
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 2 \
    --timeout-keep-alive 300
```

### 8.3 Environment Variables (.env.example)
```bash
# Google Cloud
GOOGLE_CLOUD_PROJECT=vaidyaai-prod
GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/vaidyaai-backend.json

# Firebase
FIREBASE_PROJECT_ID=vaidyaai-prod

# WhatsApp
WHATSAPP_PHONE_ID=your_phone_number_id_from_meta_dashboard
WHATSAPP_ACCESS_TOKEN=your_permanent_whatsapp_token
WHATSAPP_VERIFY_TOKEN=vaidyaai_webhook_verify_2026
WHATSAPP_APP_SECRET=your_app_secret_for_hmac_validation

# Razorpay (India)
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Database
DATABASE_URL=postgresql+asyncpg://vaidyaai_user:PASSWORD@/vaidyaai?host=/cloudsql/vaidyaai-prod:asia-south1:vaidyaai-db

# Backend URL (needed for Cloud Tasks target)
BACKEND_URL=https://vaidyaai-backend-HASH-uc.a.run.app

# Cloud Tasks
CLOUD_TASKS_LOCATION=asia-south1
CLOUD_TASKS_QUEUE_REMINDERS=appointment-reminders
CLOUD_TASKS_QUEUE_BILLING=billing-followups
CLOUD_TASKS_QUEUE_RETENTION=retention-outreach

# Storage
GCS_BUCKET_CONSULTATIONS=vaidyaai-consultations
```

---

## 9. SECURITY ARCHITECTURE

### 9.1 Authentication Layers
```
Layer 1 — Public webhooks:
  WhatsApp: X-Hub-Signature-256 HMAC-SHA256 validation
  Razorpay: X-Razorpay-Signature HMAC-SHA256 validation
  Internal tasks: X-CloudTasks-QueueName header check + IP allowlist

Layer 2 — Doctor API endpoints:
  Firebase Auth JWT in Authorization header
  Token verified with firebase_admin.auth.verify_id_token()
  clinic_id extracted from JWT custom claims
  Every request validated: JWT clinic_id == requested resource clinic_id

Layer 3 — Service-to-service:
  Cloud Scheduler uses OIDC token with service account
  Cloud Tasks use service account authentication
  Cloud Run service account has minimum required IAM roles only
```

### 9.2 IAM Roles (vaidyaai-backend service account)
```
roles/aiplatform.user          — Vertex AI Gemini calls
roles/datastore.user           — Firestore read/write
roles/speech.client            — Cloud Speech-to-Text
roles/cloudsql.client          — Cloud SQL connections
roles/cloudtasks.enqueuer      — Create Cloud Tasks
roles/storage.objectAdmin      — Firebase Storage + GCS
roles/logging.logWriter        — Cloud Logging (agent evidence)
roles/secretmanager.secretAccessor — Read secrets
roles/run.invoker              — Internal service calls
```

### 9.3 Data Security
```
Firestore: security rules prevent cross-clinic data access
  - Every document has clinic_id
  - Rules validate: request.auth.token.clinic_id == resource.data.clinic_id
  - agent_logs: read only by clinic owner, write only by service account

PostgreSQL: Cloud SQL with private IP only (no public IP)
  - Access via Cloud SQL Auth Proxy (automatic in Cloud Run)
  - All connections via asyncpg over Unix socket

Firebase Storage: private by default
  - Prescription PDFs: signed URLs, 7-day expiry
  - Consultation audio: service account access only, auto-deleted after 30 days
```

---

## 10. MONITORING AND OBSERVABILITY

### 10.1 Cloud Logging Filters (for evidence export)
```bash
# All agent decisions:
logName="projects/vaidyaai-prod/logs/vaidyaai-agents"
jsonPayload.agent!=""

# Specific agent:
jsonPayload.agent="appointment_flow"

# Errors only:
severity>=ERROR

# Today's decisions:
timestamp >= "2026-08-17T00:00:00Z"
timestamp <= "2026-08-17T23:59:59Z"
```

### 10.2 Key Metrics to Monitor
```
Business metrics (PostgreSQL):
  - Daily active clinics (clinics with appointments today)
  - Daily revenue collected (sum of invoices.amount_paise WHERE status=paid AND paid_at=today)
  - Monthly recurring revenue (sum of subscriptions.monthly_fee_paise WHERE status=active)
  - Collection rate % (collected / billed × 100)

Agent metrics (Cloud Logging):
  - Decisions per agent per day
  - Average Gemini latency per task type
  - Error rate per agent
  - WhatsApp delivery success rate

Infrastructure (Cloud Run):
  - Request latency P50/P95/P99
  - Error rate (5xx responses)
  - Instance count (autoscaling)
  - Cold start frequency (should be 0 with min-instances=1)
```

---

## 11. PERFORMANCE TARGETS

| Metric | Target | Why |
|---|---|---|
| WhatsApp response time | < 5 seconds | Patient waits for slot options — > 10s feels broken |
| Gemini intent detection | < 2 seconds | Core of AppointmentFlow loop |
| SOAP note generation | < 45 seconds | Doctor reviews SOAP — 45s acceptable |
| Drug interaction check | < 15 seconds | Shown before doctor approves |
| Invoice → WhatsApp | < 10 seconds | After consultation close |
| Dashboard load | < 2 seconds | Next.js static generation |
| Firestore update → dashboard | < 1 second | onSnapshot real-time |
| Backend cold start | 0 (min-instances=1) | Webhooks must respond immediately |

---

*TECHNICAL_ARCHITECTURE v2.0 | VaidyaAI Agents*
*Build with Gemini XPRIZE | Primary LLM: Gemini 1.5 Flash + Pro (Vertex AI, asia-south1)*
*All agent decisions logged to Cloud Logging — verifiable evidence for judges*
