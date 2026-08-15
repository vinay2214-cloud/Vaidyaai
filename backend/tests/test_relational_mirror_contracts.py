"""Relational mirror schema contracts for agent-written rows.

RetentionRadar and ReferralCoordinator mirror their Firestore records into the
relational store. Because those writes are wrapped in try/except, a field-name
drift between the agent and the ORM model silently discards the row. These
tests pin the exact kwargs the agents use to the real table schema.
"""
import uuid
from datetime import datetime, timezone

import pytest

from models.patient import RetentionOutreach
from models.consultation import ReferralTracking


def _columns(model):
    return {c.name for c in model.__table__.columns}


def test_retention_outreach_agent_fields_exist_in_schema():
    agent_fields = {
        "clinic_id", "patient_phone_masked", "trigger_type",
        "message_language", "message_text", "sent_at",
    }
    missing = agent_fields - _columns(RetentionOutreach)
    assert not missing, f"RetentionRadar writes unknown columns: {sorted(missing)}"


def test_retention_outreach_row_constructs_with_agent_kwargs():
    row = RetentionOutreach(
        clinic_id=uuid.uuid4(),
        patient_phone_masked="+91XXXXXX3210",
        trigger_type="followup_review",
        message_language="te",
        message_text="Follow-up check-in",
        sent_at=datetime.now(timezone.utc),
    )
    assert row.trigger_type == "followup_review"


def test_referral_tracking_agent_fields_exist_in_schema():
    agent_fields = {
        "clinic_id", "patient_phone_masked", "consultation_firestore_id",
        "referral_type", "description", "urgency", "suggested_provider",
        "status", "created_at",
    }
    missing = agent_fields - _columns(ReferralTracking)
    assert not missing, f"ReferralCoordinator writes unknown columns: {sorted(missing)}"


def test_referral_tracking_row_constructs_with_agent_kwargs():
    row = ReferralTracking(
        clinic_id=uuid.uuid4(),
        patient_phone_masked="+91XXXXXX3210",
        consultation_firestore_id="cons_demo_001",
        referral_type="specialist",
        description="Cardiology: referral letter",
        urgency="urgent",
        suggested_provider="Cardiology",
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    assert row.urgency == "urgent"


@pytest.mark.parametrize("model", [RetentionOutreach, ReferralTracking])
def test_clinic_id_is_uuid_typed_so_placeholder_ints_are_invalid(model):
    """Guards the removed `scalar_one_or_none() or 1` placeholder-FK pattern."""
    col = model.__table__.columns["clinic_id"]
    assert "UUID" in str(col.type).upper()
