import uuid
from datetime import datetime, timezone, date
from sqlalchemy import Column, String, Boolean, DateTime, Date, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database.postgres import Base


class Clinic(Base):
    __tablename__ = "clinics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firebase_clinic_id = Column(String(128), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    doctor_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=False)
    whatsapp_phone_id = Column(String(100), nullable=False)
    speciality = Column(String(100), default="General Medicine")
    location = Column(String(255), nullable=True)
    subscription_plan = Column(
        String(20),
        default="essential",
        nullable=False
    )
    razorpay_account_id = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    onboarding_complete = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    subscriptions = relationship("Subscription", back_populates="clinic", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="clinic")
    daily_pl_summaries = relationship("DailyPLSummary", back_populates="clinic")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True)
    plan = Column(String(20), nullable=False)
    monthly_fee_paise = Column(Integer, nullable=False)
    status = Column(String(20), default="trial", nullable=False, index=True)
    razorpay_subscription_id = Column(String(100), nullable=True)
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    next_billing_date = Column(Date, nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationship
    clinic = relationship("Clinic", back_populates="subscriptions")
