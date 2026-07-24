import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from database.postgres import Base


class ReferralTracking(Base):
    __tablename__ = "referral_tracking"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False, index=True)
    patient_phone_masked = Column(String(20), nullable=False)
    consultation_firestore_id = Column(String(128), nullable=True)
    referral_type = Column(String(20), nullable=True)
    description = Column(Text, nullable=False)
    urgency = Column(String(20), default="routine")
    suggested_provider = Column(String(255), nullable=True)
    status = Column(String(20), default="sent", index=True)
    patient_notified_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    followup_count = Column(Integer, default=0)
    last_followup_at = Column(DateTime(timezone=True), nullable=True)
    followup_task_name = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
