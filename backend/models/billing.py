import uuid
from datetime import datetime, timezone, date
from sqlalchemy import Column, String, Integer, DateTime, Date, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database.postgres import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_number = Column(String(30), unique=True, nullable=False, index=True)
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False, index=True)
    patient_phone_masked = Column(String(20), nullable=False)
    consultation_firestore_id = Column(String(128), nullable=True, index=True)
    amount_paise = Column(Integer, nullable=False)
    consultation_type = Column(String(20), nullable=True)
    status = Column(String(20), default="pending", nullable=False, index=True)
    payment_method = Column(String(20), nullable=True)
    razorpay_payment_link_id = Column(String(100), nullable=True)
    razorpay_payment_link_url = Column(Text, nullable=True)
    razorpay_order_id = Column(String(100), nullable=True)
    razorpay_payment_id = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    reminder_sent_at = Column(DateTime(timezone=True), nullable=True)
    waived_reason = Column(String(255), nullable=True)

    clinic = relationship("Clinic", back_populates="invoices")


class DailyPLSummary(Base):
    __tablename__ = "daily_pl_summary"
    __table_args__ = (UniqueConstraint("clinic_id", "date", name="uq_clinic_daily_pl"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    patients_seen = Column(Integer, default=0)
    total_billed_paise = Column(Integer, default=0)
    total_collected_paise = Column(Integer, default=0)
    upi_paise = Column(Integer, default=0)
    cash_paise = Column(Integer, default=0)
    card_paise = Column(Integer, default=0)
    pending_paise = Column(Integer, default=0)
    waived_paise = Column(Integer, default=0)
    invoice_count = Column(Integer, default=0)
    pnl_sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    clinic = relationship("Clinic", back_populates="daily_pl_summaries")
