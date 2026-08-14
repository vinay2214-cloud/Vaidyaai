"""
VaidyaAI Agent Health API — Live metrics computed from agent_logs.

Returns per-agent health metrics:
  - agent_name, status, tasks_today, avg_latency_ms, success_rate_pct,
    last_run_at, failures_today, last_decision
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, Query

from api.auth import get_current_user, verify_clinic_access
from database.firestore import query_documents
from event_bus import get_event_bus
from utils.date_utils import get_today_ist_date_str, parse_ist_date

from config import settings

logger = logging.getLogger("vaidyaai.api.agent_health")
router = APIRouter()

AGENT_NAMES = [
    "appointment_flow",
    "clinical_scribe",
    "billing_pulse",
    "retention_radar",
    "prescription_safe",
    "insight_engine",
    "referral_coordinator",
]

# Dynamically bind models from centralized config.py
AGENT_DISPLAY = {
    "appointment_flow": {"name": "AppointmentFlow", "role": "WhatsApp Triage & Booking", "model": settings.GEMINI_FAST_MODEL},
    "clinical_scribe": {"name": "ClinicalScribe", "role": "Ambient Audio & SOAP", "model": settings.GEMINI_REASONING_MODEL},
    "billing_pulse": {"name": "BillingPulse", "role": "Invoicing & UPI", "model": settings.GEMINI_FAST_MODEL},
    "retention_radar": {"name": "RetentionRadar", "role": "Follow-up Outreach", "model": settings.GEMINI_FAST_MODEL},
    "prescription_safe": {"name": "PrescriptionSafe", "role": "Drug Safety Audit", "model": settings.GEMINI_REASONING_MODEL},
    "insight_engine": {"name": "InsightEngine", "role": "Analytics & Insights", "model": settings.GEMINI_REASONING_MODEL},
    "referral_coordinator": {"name": "ReferralCoordinator", "role": "Referral Letters", "model": settings.GEMINI_REASONING_MODEL},
}


@router.get("/agents/health", tags=["agents"])
async def get_agent_health(
    clinic_id: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    GET /api/v1/agents/health?clinic_id={id}
    Returns live per-agent health metrics computed from agent_logs.
    """
    verify_clinic_access(clinic_id, current_user)

    # Fetch recent agent logs (limit 200 for performance)
    all_logs = await query_documents(
        "agent_logs",
        [("clinic_id", "==", clinic_id)],
        limit=200,
    )

    def _parse_dt(val):
        if not val:
            return None
        if isinstance(val, datetime):
            return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
        if isinstance(val, str):
            try:
                dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
                return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
            except Exception:
                return None
        if hasattr(val, "toDate"):
            try:
                dt = val.toDate()
                return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
            except Exception:
                pass
        if hasattr(val, "seconds"):
            return datetime.fromtimestamp(val.seconds, tz=timezone.utc)
        return None

    # Restrict to today (IST) so tasks_today / failures_today are genuinely today
    ist_day_start = parse_ist_date(get_today_ist_date_str())
    ist_day_end = ist_day_start + timedelta(days=1)

    def _within_today(ca):
        dt = _parse_dt(ca)
        if not dt:
            return False
        return ist_day_start <= dt < ist_day_end

    all_logs = [l for l in all_logs if _within_today(l.get("created_at"))]

    # Get event bus state
    bus = get_event_bus()
    agent_states = bus.get_agent_states()

    agents_health: List[Dict[str, Any]] = []

    for agent_id in AGENT_NAMES:
        agent_logs = [l for l in all_logs if l.get("agent_name") == agent_id]
        display = AGENT_DISPLAY.get(agent_id, {})

        tasks_today = len(agent_logs)
        failures = [l for l in agent_logs if l.get("success") is False]
        failures_today = len(failures)
        success_count = tasks_today - failures_today

        latencies = [
            l.get("latency_ms")
            for l in agent_logs
            if l.get("latency_ms") is not None
        ]
        avg_latency = (
            round(sum(latencies) / len(latencies)) if latencies else None
        )

        success_rate = (
            round(success_count / tasks_today * 100, 1) if tasks_today > 0 else None
        )

        # Determine status from event bus state or log metrics
        bus_state = agent_states.get(agent_id)
        if bus_state in ["running", "thinking", "Running"]:
            status = "Running"
        elif failures_today > 0 and success_count == 0:
            status = "Failed"
        elif tasks_today > 0:
            status = "Healthy"
        else:
            status = "Idle"

        # Last run timestamp
        last_run_at = None
        last_decision = None
        if agent_logs:
            _epoch = datetime.min.replace(tzinfo=timezone.utc)
            last_log = max(agent_logs, key=lambda l: _parse_dt(l.get("created_at")) or _epoch)
            created_at_dt = _parse_dt(last_log.get("created_at"))
            if created_at_dt:
                last_run_at = created_at_dt.isoformat()
            last_decision = last_log.get("decision_made", "")

        agents_health.append({
            "id": agent_id,
            "name": display.get("name", agent_id),
            "role": display.get("role", ""),
            "model": display.get("model", settings.GEMINI_FAST_MODEL),
            "status": status,
            "tasks_today": tasks_today,
            "avg_latency_ms": avg_latency,
            "success_rate_pct": success_rate,
            "last_run_at": last_run_at,
            "failures_today": failures_today,
            "last_decision": last_decision,
        })

    # Compute platform-wide metrics
    total_tasks = sum(a["tasks_today"] for a in agents_health)
    total_failures = sum(a["failures_today"] for a in agents_health)
    all_latencies = [a["avg_latency_ms"] for a in agents_health if a["avg_latency_ms"] is not None and a["avg_latency_ms"] > 0]
    platform_avg_latency = round(sum(all_latencies) / len(all_latencies)) if all_latencies else 0
    # An agent is "active" only if it has actually executed work today (or is
    # currently running). Merely being registered/Idle does not make it active.
    active_count = sum(1 for a in agents_health if a["tasks_today"] > 0 or a["status"] == "Running")

    return {
        "clinic_id": clinic_id,
        "platform": {
            "active_agents": active_count,
            "total_agents": len(AGENT_NAMES),
            "total_tasks_today": total_tasks,
            "total_failures_today": total_failures,
            "avg_latency_ms": platform_avg_latency,
            "health_pct": round((1 - total_failures / max(total_tasks, 1)) * 100, 1),
        },
        "agents": agents_health,
    }
