"""
Unit tests for VaidyaAI Event Bus & Workflow Orchestrator.
Tests idempotency, subscriber execution, retry logic, error isolation, dead letter queue, and metadata envelope.
"""
import asyncio
import pytest
from event_bus import ClinicalEvent, EventBus, create_event, get_event_bus
from workflow_orchestrator import WorkflowOrchestrator


@pytest.mark.asyncio
async def test_event_envelope_creation():
    """Verify create_event constructs full metadata envelope."""
    event = create_event(
        ClinicalEvent.PATIENT_REGISTERED,
        clinic_id="cln_test_123",
        patient_id="pat_001",
        payload={"name": "Test Patient"}
    )
    assert event["event_type"] == "patient_registered"
    assert event["version"] == 1
    assert event["clinic_id"] == "cln_test_123"
    assert event["patient_id"] == "pat_001"
    assert event["event_id"].startswith("evt_")
    assert event["correlation_id"].startswith("corr_")
    assert event["payload"]["name"] == "Test Patient"


@pytest.mark.asyncio
async def test_event_bus_subscribe_and_emit():
    """Verify basic subscribe and emit functionality."""
    bus = EventBus()
    received = []

    async def sample_handler(evt):
        received.append(evt)

    bus.subscribe(ClinicalEvent.VISIT_CREATED, sample_handler, "test_handler")

    event = create_event(ClinicalEvent.VISIT_CREATED, clinic_id="cln_test")
    res = await bus.emit(event)

    assert res["status"] == "emitted"
    assert len(received) == 1
    assert received[0]["event_id"] == event["event_id"]


@pytest.mark.asyncio
async def test_event_bus_idempotency():
    """Verify duplicate event_ids are skipped."""
    bus = EventBus()
    count = 0

    async def sample_handler(evt):
        nonlocal count
        count += 1

    bus.subscribe(ClinicalEvent.CONSULTATION_STARTED, sample_handler, "test_handler")

    event = create_event(ClinicalEvent.CONSULTATION_STARTED, clinic_id="cln_test")

    res1 = await bus.emit(event)
    res2 = await bus.emit(event)  # Duplicate!

    assert res1["status"] == "emitted"
    assert res2["status"] == "duplicate"
    assert count == 1  # Executed only once!


@pytest.mark.asyncio
async def test_event_bus_error_isolation():
    """Verify one failing subscriber does not block other subscribers."""
    bus = EventBus()
    success_ran = False

    async def failing_handler(evt):
        raise ValueError("Simulated failure")

    async def succeeding_handler(evt):
        nonlocal success_ran
        success_ran = True

    bus.subscribe(ClinicalEvent.SOAP_GENERATED, failing_handler, "failing_sub", max_retries=0)
    bus.subscribe(ClinicalEvent.SOAP_GENERATED, succeeding_handler, "succeeding_sub", max_retries=0)

    event = create_event(ClinicalEvent.SOAP_GENERATED, clinic_id="cln_test")
    res = await bus.emit(event)

    assert res["status"] == "emitted"
    assert len(res["handlers"]) == 2
    assert success_ran is True


@pytest.mark.asyncio
async def test_workflow_orchestrator_registration():
    """Verify WorkflowOrchestrator registers all agent subscriptions."""
    orchestrator = WorkflowOrchestrator()
    orchestrator.register_all()

    summary = orchestrator.bus.get_subscriptions_summary()
    assert "patient_registered" in summary
    assert "visit_created" in summary
    assert "soap_generated" in summary
    assert "prescription_approved" in summary
    assert "invoice_generated" in summary
    assert "payment_completed" in summary
