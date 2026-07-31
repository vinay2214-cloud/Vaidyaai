"""
VaidyaAI Event Bus — In-Process Async Pub/Sub for Clinical Workflow Orchestration.

Design principles:
  - Emit events ONLY after database commit (caller responsibility)
  - Idempotent processing via event_id + processed_events tracking
  - Dead letter queue for failed events (failed_events Firestore collection)
  - Error isolation: one failing handler never blocks others
  - Retry with exponential backoff (configurable per handler)
  - Full event metadata envelope (15 fields)
  - Structured event types (Enum, not raw strings)
"""
import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Coroutine, Dict, List, Optional, Set

logger = logging.getLogger("vaidyaai.event_bus")


# ─── Structured Event Types ─────────────────────────────────────────────────

class ClinicalEvent(str, Enum):
    """All clinical event types in the VaidyaAI workflow."""
    PATIENT_REGISTERED = "patient_registered"
    VISIT_CREATED = "visit_created"
    QUEUE_UPDATED = "queue_updated"
    CONSULTATION_STARTED = "consultation_started"
    SOAP_GENERATED = "soap_generated"
    PRESCRIPTION_CREATED = "prescription_created"
    PRESCRIPTION_APPROVED = "prescription_approved"
    INVOICE_GENERATED = "invoice_generated"
    PAYMENT_COMPLETED = "payment_completed"
    REFERRAL_CREATED = "referral_created"
    FOLLOWUP_SCHEDULED = "followup_scheduled"
    ANALYTICS_UPDATED = "analytics_updated"
    AUDIT_WRITTEN = "audit_written"


# ─── Agent State Machine ────────────────────────────────────────────────────

class AgentState(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    RETRYING = "retrying"
    DISABLED = "disabled"


# ─── Event Envelope ─────────────────────────────────────────────────────────

def create_event(
    event_type: ClinicalEvent,
    clinic_id: str,
    *,
    correlation_id: Optional[str] = None,
    causation_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    visit_id: Optional[str] = None,
    consultation_id: Optional[str] = None,
    doctor_id: Optional[str] = None,
    user_id: Optional[str] = None,
    trigger: str = "api",
    payload: Optional[Dict[str, Any]] = None,
    version: int = 1,
) -> Dict[str, Any]:
    """
    Create a standardized event envelope with full metadata.

    Args:
        event_type: Structured ClinicalEvent enum value.
        clinic_id: Tenant isolation key.
        correlation_id: Links all events in a single patient visit journey. If None, generates new UUID.
        causation_id: The event_id of the event that caused this one. Forms a causal chain.
        patient_id: Patient identifier.
        visit_id: Appointment / visit identifier.
        consultation_id: Consultation document identifier.
        doctor_id: Acting doctor UID.
        user_id: Acting user UID (may differ from doctor for reception staff).
        trigger: What triggered this event (api, webhook, scheduler, agent).
        payload: Event-specific data dictionary.
        version: Event schema version for forward compatibility.
    """
    event_id = f"evt_{uuid.uuid4().hex[:16]}"
    return {
        "event_id": event_id,
        "event_type": event_type.value,
        "version": version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "correlation_id": correlation_id or f"corr_{uuid.uuid4().hex[:12]}",
        "causation_id": causation_id,
        "tenant_id": clinic_id,
        "clinic_id": clinic_id,
        "patient_id": patient_id,
        "visit_id": visit_id,
        "consultation_id": consultation_id,
        "doctor_id": doctor_id,
        "user_id": user_id,
        "trigger": trigger,
        "payload": payload or {},
    }


# ─── Subscriber Registration ────────────────────────────────────────────────

class _Subscription:
    """Internal subscription record with retry configuration."""

    __slots__ = ("handler", "handler_name", "max_retries")

    def __init__(
        self,
        handler: Callable[[Dict[str, Any]], Coroutine],
        handler_name: str,
        max_retries: int = 1,
    ):
        self.handler = handler
        self.handler_name = handler_name
        self.max_retries = max_retries


# ─── Event Bus ───────────────────────────────────────────────────────────────

class EventBus:
    """
    In-process async event bus for clinical workflow orchestration.

    Usage:
        bus = EventBus()
        bus.subscribe(ClinicalEvent.SOAP_GENERATED, my_handler, "prescription_safe_check")
        await bus.emit(event)
    """

    def __init__(self):
        self._subscriptions: Dict[str, List[_Subscription]] = {}
        self._processed_events: Set[str] = set()
        self._processed_events_max = 10_000  # Rolling cap to prevent memory leak
        self._agent_states: Dict[str, AgentState] = {}

    def subscribe(
        self,
        event_type: ClinicalEvent,
        handler: Callable[[Dict[str, Any]], Coroutine],
        handler_name: str,
        max_retries: int = 1,
    ) -> None:
        """Register a handler for a specific event type."""
        key = event_type.value
        if key not in self._subscriptions:
            self._subscriptions[key] = []
        self._subscriptions[key].append(
            _Subscription(handler, handler_name, max_retries)
        )
        logger.info(f"Subscribed '{handler_name}' to {key}")

    async def emit(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Emit an event to all registered subscribers.

        IMPORTANT: Caller must ensure database writes are committed BEFORE calling emit().

        Returns a summary dict with per-handler results.
        """
        event_id = event.get("event_id", "unknown")
        event_type = event.get("event_type", "unknown")

        # ── Idempotency guard ────────────────────────────────────────────
        if event_id in self._processed_events:
            logger.warning(f"Duplicate event {event_id} ({event_type}) — skipping")
            return {"event_id": event_id, "status": "duplicate", "handlers": []}

        self._processed_events.add(event_id)
        # Rolling eviction to prevent unbounded memory growth
        if len(self._processed_events) > self._processed_events_max:
            # Remove oldest ~20% (sets are unordered, so just clear a chunk)
            to_remove = list(self._processed_events)[:2000]
            for item in to_remove:
                self._processed_events.discard(item)

        subscribers = self._subscriptions.get(event_type, [])
        if not subscribers:
            logger.debug(f"No subscribers for {event_type}")
            return {"event_id": event_id, "status": "no_subscribers", "handlers": []}

        logger.info(
            f"Emitting {event_type} (event_id={event_id}, corr={event.get('correlation_id')}) "
            f"→ {len(subscribers)} subscriber(s)"
        )

        handler_results = []
        for sub in subscribers:
            result = await self._execute_handler(sub, event)
            handler_results.append(result)

        # Write audit entry for the event emission
        await self._write_audit(event, handler_results)

        return {
            "event_id": event_id,
            "status": "emitted",
            "handlers": handler_results,
        }

    async def _execute_handler(
        self, sub: _Subscription, event: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a single handler with retry and error isolation."""
        event_id = event.get("event_id", "unknown")
        event_type = event.get("event_type", "unknown")
        attempt = 0
        last_error = None

        while attempt <= sub.max_retries:
            try:
                self._agent_states[sub.handler_name] = (
                    AgentState.RUNNING if attempt == 0 else AgentState.RETRYING
                )

                start = time.monotonic()
                await sub.handler(event)
                latency_ms = int((time.monotonic() - start) * 1000)

                self._agent_states[sub.handler_name] = AgentState.SUCCESS
                logger.info(
                    f"  ✓ {sub.handler_name} handled {event_type} in {latency_ms}ms"
                )
                return {
                    "handler": sub.handler_name,
                    "status": "success",
                    "latency_ms": latency_ms,
                    "attempt": attempt + 1,
                }

            except Exception as e:
                last_error = str(e)
                attempt += 1
                self._agent_states[sub.handler_name] = AgentState.FAILED

                if attempt <= sub.max_retries:
                    backoff = min(2 ** attempt * 0.1, 2.0)  # 0.2s, 0.4s, max 2s
                    logger.warning(
                        f"  ⚠ {sub.handler_name} failed ({event_type}): {e}. "
                        f"Retrying in {backoff}s (attempt {attempt}/{sub.max_retries})"
                    )
                    await asyncio.sleep(backoff)

        # All retries exhausted — write to dead letter queue
        logger.error(
            f"  ✗ {sub.handler_name} FAILED after {sub.max_retries + 1} attempts "
            f"for {event_type}: {last_error}"
        )
        await self._write_dead_letter(event, sub.handler_name, last_error)

        return {
            "handler": sub.handler_name,
            "status": "failed",
            "error": last_error,
            "attempt": attempt,
        }

    async def _write_dead_letter(
        self, event: Dict[str, Any], handler_name: str, error: str
    ) -> None:
        """Write failed event to dead letter queue for admin review."""
        try:
            from database.firestore import set_document

            dlq_id = f"dlq_{uuid.uuid4().hex[:12]}"
            await set_document(
                "failed_events",
                dlq_id,
                {
                    "dlq_id": dlq_id,
                    "event_id": event.get("event_id"),
                    "event_type": event.get("event_type"),
                    "correlation_id": event.get("correlation_id"),
                    "clinic_id": event.get("clinic_id"),
                    "handler_name": handler_name,
                    "error": error,
                    "retry_count": event.get("_retry_count", 0),
                    "event_payload": event,
                    "created_at": datetime.now(timezone.utc),
                    "status": "pending_review",
                },
            )
        except Exception as e:
            logger.error(f"Failed to write dead letter entry: {e}")

    async def _write_audit(
        self, event: Dict[str, Any], handler_results: List[Dict[str, Any]]
    ) -> None:
        """Write an audit entry for the event emission."""
        try:
            from database.firestore import set_document

            audit_id = f"audit_{event.get('event_id', 'unknown')}"
            await set_document(
                "agent_logs",
                audit_id,
                {
                    "agent_name": "event_bus",
                    "decision_type": f"event_emitted:{event.get('event_type')}",
                    "decision_made": (
                        f"Emitted {event.get('event_type')} → "
                        f"{len(handler_results)} handler(s), "
                        f"{sum(1 for h in handler_results if h['status'] == 'success')} succeeded"
                    ),
                    "clinic_id": event.get("clinic_id", ""),
                    "correlation_id": event.get("correlation_id"),
                    "causation_id": event.get("causation_id"),
                    "event_id": event.get("event_id"),
                    "patient_id": event.get("patient_id"),
                    "visit_id": event.get("visit_id"),
                    "consultation_id": event.get("consultation_id"),
                    "success": all(h["status"] == "success" for h in handler_results),
                    "created_at": datetime.now(timezone.utc),
                    "handler_results": handler_results,
                },
            )
        except Exception as e:
            logger.debug(f"Event bus audit write error: {e}")

    def get_agent_states(self) -> Dict[str, str]:
        """Return current state of all registered agent handlers."""
        return {name: state.value for name, state in self._agent_states.items()}

    def get_subscriptions_summary(self) -> Dict[str, List[str]]:
        """Return summary of all subscriptions for diagnostics."""
        return {
            event_type: [s.handler_name for s in subs]
            for event_type, subs in self._subscriptions.items()
        }


# ─── Global Singleton ────────────────────────────────────────────────────────

_event_bus: Optional[EventBus] = None


def get_event_bus() -> EventBus:
    """Get or create the global EventBus singleton."""
    global _event_bus
    if _event_bus is None:
        _event_bus = EventBus()
    return _event_bus
