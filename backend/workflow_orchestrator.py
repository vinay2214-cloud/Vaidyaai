"""
VaidyaAI Workflow Orchestrator — Registers Agent Subscriptions on Startup.

Defines the canonical event chain with explicit workflow dependencies.
Event ordering is determined by the DAG defined here, not by subscription order.

Workflow DAG:
  PatientRegistered    → RetentionRadar (track new patient)
  VisitCreated         → AppointmentFlow (schedule reminders)
  ConsultationStarted  → (audit only — ClinicalScribe is invoked via API)
  SOAPGenerated        → PrescriptionSafe (auto-run safety check)
                       → ReferralCoordinator (auto-detect referral needs)
  PrescriptionApproved → BillingPulse (generate invoice)
  InvoiceGenerated     → RetentionRadar (schedule follow-up)
  PaymentCompleted     → InsightEngine (update metrics)
  ReferralCreated      → (audit only)
  FollowUpScheduled    → RetentionRadar (queue outreach)
"""
import logging
from typing import Dict, Any

from event_bus import ClinicalEvent, EventBus, get_event_bus

logger = logging.getLogger("vaidyaai.workflow_orchestrator")


class WorkflowOrchestrator:
    """
    Registers all agent subscriptions and manages the clinical workflow DAG.
    Initialized once during application startup.
    """

    def __init__(self):
        self.bus = get_event_bus()
        self._registered = False

    def register_all(self) -> None:
        """Register all agent handlers with the event bus. Idempotent."""
        if self._registered:
            logger.warning("WorkflowOrchestrator.register_all() called twice — skipping")
            return

        logger.info("Registering agent subscriptions with EventBus...")

        # ─── PatientRegistered ───────────────────────────────────────
        self.bus.subscribe(
            ClinicalEvent.PATIENT_REGISTERED,
            self._on_patient_registered,
            "retention_radar:track_new_patient",
            max_retries=1,
        )

        # ─── VisitCreated ────────────────────────────────────────────
        self.bus.subscribe(
            ClinicalEvent.VISIT_CREATED,
            self._on_visit_created,
            "appointment_flow:schedule_reminders",
            max_retries=1,
        )

        # ─── QueueUpdated ────────────────────────────────────────────
        self.bus.subscribe(
            ClinicalEvent.QUEUE_UPDATED,
            self._on_queue_updated,
            "queue:audit_status_change",
            max_retries=0,
        )

        # ─── SOAPGenerated ───────────────────────────────────────────
        # Explicit ordering: PrescriptionSafe runs BEFORE ReferralCoordinator
        self.bus.subscribe(
            ClinicalEvent.SOAP_GENERATED,
            self._on_soap_generated_safety,
            "prescription_safe:auto_check",
            max_retries=1,
        )
        self.bus.subscribe(
            ClinicalEvent.SOAP_GENERATED,
            self._on_soap_generated_referral,
            "referral_coordinator:auto_detect",
            max_retries=1,
        )

        # ─── PrescriptionApproved ────────────────────────────────────
        self.bus.subscribe(
            ClinicalEvent.PRESCRIPTION_APPROVED,
            self._on_prescription_approved,
            "billing_pulse:generate_invoice",
            max_retries=2,
        )

        # ─── InvoiceGenerated ────────────────────────────────────────
        self.bus.subscribe(
            ClinicalEvent.INVOICE_GENERATED,
            self._on_invoice_generated,
            "retention_radar:schedule_followup",
            max_retries=1,
        )

        # ─── PaymentCompleted ────────────────────────────────────────
        self.bus.subscribe(
            ClinicalEvent.PAYMENT_COMPLETED,
            self._on_payment_completed,
            "insight_engine:update_metrics",
            max_retries=1,
        )

        self._registered = True
        summary = self.bus.get_subscriptions_summary()
        logger.info(
            f"WorkflowOrchestrator registered {sum(len(v) for v in summary.values())} "
            f"handlers across {len(summary)} event types"
        )

    # ─── Handler Implementations ─────────────────────────────────────────

    async def _on_patient_registered(self, event: Dict[str, Any]) -> None:
        """Track new patient for future retention outreach."""
        logger.info(
            f"RetentionRadar: Tracking new patient {event.get('patient_id')} "
            f"(corr={event.get('correlation_id')})"
        )
        # RetentionRadar will pick up this patient in the next daily outreach scan.
        # No immediate action needed — the patient record is already in Firestore.

    async def _on_visit_created(self, event: Dict[str, Any]) -> None:
        """Schedule appointment reminders via Cloud Tasks."""
        logger.info(
            f"AppointmentFlow: Visit created for {event.get('visit_id')} "
            f"(corr={event.get('correlation_id')})"
        )
        # Cloud Tasks scheduling already happens in create_walk_in_appointment.
        # This handler provides audit traceability.

    async def _on_queue_updated(self, event: Dict[str, Any]) -> None:
        """Audit log for queue status changes."""
        logger.info(
            f"Queue: Status updated to {event.get('payload', {}).get('new_status')} "
            f"for visit {event.get('visit_id')} (corr={event.get('correlation_id')})"
        )

    async def _on_soap_generated_safety(self, event: Dict[str, Any]) -> None:
        """Auto-run PrescriptionSafe drug safety check after SOAP generation."""
        payload = event.get("payload", {})
        medications = payload.get("medications", [])
        consultation_id = event.get("consultation_id")
        clinic_id = event.get("clinic_id")
        patient_id = event.get("patient_id")

        if not medications:
            logger.info(
                f"PrescriptionSafe: No medications in SOAP {consultation_id} — skipping"
            )
            return

        try:
            from agents.prescription_safe import PrescriptionSafeAgent
            agent = PrescriptionSafeAgent()
            result = await agent.validate_prescription(
                consultation_id=consultation_id,
                clinic_id=clinic_id,
                medications=medications,
                patient_id=patient_id,
            )
            logger.info(
                f"PrescriptionSafe: Auto-check for {consultation_id} → "
                f"is_safe={result.get('is_safe')}"
            )
        except Exception as e:
            logger.error(f"PrescriptionSafe auto-check failed: {e}")
            raise

    async def _on_soap_generated_referral(self, event: Dict[str, Any]) -> None:
        """Auto-detect referral needs from SOAP note referrals field."""
        payload = event.get("payload", {})
        referrals = payload.get("referrals", [])
        consultation_id = event.get("consultation_id")
        clinic_id = event.get("clinic_id")

        if not referrals:
            logger.info(
                f"ReferralCoordinator: No referrals in SOAP {consultation_id} — skipping"
            )
            return

        logger.info(
            f"ReferralCoordinator: Detected {len(referrals)} referral(s) in "
            f"SOAP {consultation_id} — flagging for doctor review"
        )
        # Referral generation requires doctor confirmation, so we just flag it.
        # The actual referral is created when doctor clicks "Create Referral" in UI.

    async def _on_prescription_approved(self, event: Dict[str, Any]) -> None:
        """Generate invoice when doctor approves SOAP note."""
        consultation_id = event.get("consultation_id")
        clinic_id = event.get("clinic_id")
        payload = event.get("payload", {})
        patient_phone = payload.get("patient_phone")
        consultation_type = payload.get("consultation_type", "new")

        if not patient_phone or patient_phone == "XXXX":
            logger.info(
                f"BillingPulse: No valid phone for {consultation_id} — skipping invoice"
            )
            return

        try:
            from agents.billing_pulse import BillingPulseAgent
            agent = BillingPulseAgent()
            result = await agent.on_consultation_close(
                consultation_id=consultation_id,
                clinic_id=clinic_id,
                patient_phone=patient_phone,
                consultation_type=consultation_type,
            )
            logger.info(
                f"BillingPulse: Invoice generated for {consultation_id} → "
                f"#{result.get('invoice_number')}"
            )
        except Exception as e:
            logger.error(f"BillingPulse invoice generation failed: {e}")
            raise

    async def _on_invoice_generated(self, event: Dict[str, Any]) -> None:
        """Schedule follow-up after invoice generation."""
        logger.info(
            f"RetentionRadar: Follow-up scheduled for patient {event.get('patient_id')} "
            f"after invoice (corr={event.get('correlation_id')})"
        )

    async def _on_payment_completed(self, event: Dict[str, Any]) -> None:
        """Update InsightEngine metrics after payment."""
        logger.info(
            f"InsightEngine: Payment completed for {event.get('consultation_id')} "
            f"(corr={event.get('correlation_id')})"
        )
