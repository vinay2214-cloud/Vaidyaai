import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from database.postgres import Base


class RetentionOutreach(Base):
    __tablename__ = "retention_outreach"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False, index=True)
    patient_phone_masked = Column(String(20), nullable=False)
    trigger_type = Column(String(50), nullable=False)
    message_language = Column(String(5), nullable=False)
    message_text = Column(Text, nullable=False)
    whatsapp_message_id = Column(String(100), nullable=True)
    delivered = Column(Boolean, default=False)
    appointment_booked_after = Column(Boolean, default=False)
    sent_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
