import uuid
from datetime import datetime, timezone, date
from sqlalchemy import Column, String, Integer, Float, DateTime, Date, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from database.postgres import Base


class AgentExecutionStats(Base):
    __tablename__ = "agent_execution_stats"
    __table_args__ = (UniqueConstraint("clinic_id", "date", "agent_name", name="uq_clinic_date_agent"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    agent_name = Column(String(50), nullable=False, index=True)
    decisions_made = Column(Integer, default=0)
    messages_sent = Column(Integer, default=0)
    gemini_calls = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    errors = Column(Integer, default=0)
    avg_latency_ms = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
