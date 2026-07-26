"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-07-26

Baseline schema for the VaidyaAI relational store (Cloud SQL / PostgreSQL).
Mirrors the SQLAlchemy models under ``backend/models``.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "clinics",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("firebase_clinic_id", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("doctor_name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("whatsapp_phone_id", sa.String(length=100), nullable=False),
        sa.Column("speciality", sa.String(length=100), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("subscription_plan", sa.String(length=20), nullable=False),
        sa.Column("razorpay_account_id", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("onboarding_complete", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_clinics_firebase_clinic_id", "clinics", ["firebase_clinic_id"], unique=True)

    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("plan", sa.String(length=20), nullable=False),
        sa.Column("monthly_fee_paise", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("razorpay_subscription_id", sa.String(length=100), nullable=True),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_billing_date", sa.Date(), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_subscriptions_clinic_id", "subscriptions", ["clinic_id"], unique=False)
    op.create_index("ix_subscriptions_status", "subscriptions", ["status"], unique=False)

    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invoice_number", sa.String(length=30), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_phone_masked", sa.String(length=20), nullable=False),
        sa.Column("consultation_firestore_id", sa.String(length=128), nullable=True),
        sa.Column("amount_paise", sa.Integer(), nullable=False),
        sa.Column("consultation_type", sa.String(length=20), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("payment_method", sa.String(length=20), nullable=True),
        sa.Column("razorpay_payment_link_id", sa.String(length=100), nullable=True),
        sa.Column("razorpay_payment_link_url", sa.Text(), nullable=True),
        sa.Column("razorpay_order_id", sa.String(length=100), nullable=True),
        sa.Column("razorpay_payment_id", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("waived_reason", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_invoices_invoice_number", "invoices", ["invoice_number"], unique=True)
    op.create_index("ix_invoices_clinic_id", "invoices", ["clinic_id"], unique=False)
    op.create_index("ix_invoices_consultation_firestore_id", "invoices", ["consultation_firestore_id"], unique=False)
    op.create_index("ix_invoices_status", "invoices", ["status"], unique=False)
    op.create_index("ix_invoices_created_at", "invoices", ["created_at"], unique=False)

    op.create_table(
        "daily_pl_summary",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("patients_seen", sa.Integer(), nullable=True),
        sa.Column("total_billed_paise", sa.Integer(), nullable=True),
        sa.Column("total_collected_paise", sa.Integer(), nullable=True),
        sa.Column("upi_paise", sa.Integer(), nullable=True),
        sa.Column("cash_paise", sa.Integer(), nullable=True),
        sa.Column("card_paise", sa.Integer(), nullable=True),
        sa.Column("pending_paise", sa.Integer(), nullable=True),
        sa.Column("waived_paise", sa.Integer(), nullable=True),
        sa.Column("invoice_count", sa.Integer(), nullable=True),
        sa.Column("pnl_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("clinic_id", "date", name="uq_clinic_daily_pl"),
    )
    op.create_index("ix_daily_pl_summary_clinic_id", "daily_pl_summary", ["clinic_id"], unique=False)
    op.create_index("ix_daily_pl_summary_date", "daily_pl_summary", ["date"], unique=False)

    op.create_table(
        "agent_execution_stats",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("agent_name", sa.String(length=50), nullable=False),
        sa.Column("decisions_made", sa.Integer(), nullable=True),
        sa.Column("messages_sent", sa.Integer(), nullable=True),
        sa.Column("gemini_calls", sa.Integer(), nullable=True),
        sa.Column("total_tokens", sa.Integer(), nullable=True),
        sa.Column("errors", sa.Integer(), nullable=True),
        sa.Column("avg_latency_ms", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("clinic_id", "date", "agent_name", name="uq_clinic_date_agent"),
    )
    op.create_index("ix_agent_execution_stats_clinic_id", "agent_execution_stats", ["clinic_id"], unique=False)
    op.create_index("ix_agent_execution_stats_date", "agent_execution_stats", ["date"], unique=False)
    op.create_index("ix_agent_execution_stats_agent_name", "agent_execution_stats", ["agent_name"], unique=False)

    op.create_table(
        "referral_tracking",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_phone_masked", sa.String(length=20), nullable=False),
        sa.Column("consultation_firestore_id", sa.String(length=128), nullable=True),
        sa.Column("referral_type", sa.String(length=20), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("urgency", sa.String(length=20), nullable=True),
        sa.Column("suggested_provider", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("patient_notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("followup_count", sa.Integer(), nullable=True),
        sa.Column("last_followup_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("followup_task_name", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_referral_tracking_clinic_id", "referral_tracking", ["clinic_id"], unique=False)
    op.create_index("ix_referral_tracking_status", "referral_tracking", ["status"], unique=False)

    op.create_table(
        "retention_outreach",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_phone_masked", sa.String(length=20), nullable=False),
        sa.Column("trigger_type", sa.String(length=50), nullable=False),
        sa.Column("message_language", sa.String(length=5), nullable=False),
        sa.Column("message_text", sa.Text(), nullable=False),
        sa.Column("whatsapp_message_id", sa.String(length=100), nullable=True),
        sa.Column("delivered", sa.Boolean(), nullable=True),
        sa.Column("appointment_booked_after", sa.Boolean(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_retention_outreach_clinic_id", "retention_outreach", ["clinic_id"], unique=False)
    op.create_index("ix_retention_outreach_sent_at", "retention_outreach", ["sent_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_retention_outreach_sent_at", table_name="retention_outreach")
    op.drop_index("ix_retention_outreach_clinic_id", table_name="retention_outreach")
    op.drop_table("retention_outreach")

    op.drop_index("ix_referral_tracking_status", table_name="referral_tracking")
    op.drop_index("ix_referral_tracking_clinic_id", table_name="referral_tracking")
    op.drop_table("referral_tracking")

    op.drop_index("ix_agent_execution_stats_agent_name", table_name="agent_execution_stats")
    op.drop_index("ix_agent_execution_stats_date", table_name="agent_execution_stats")
    op.drop_index("ix_agent_execution_stats_clinic_id", table_name="agent_execution_stats")
    op.drop_table("agent_execution_stats")

    op.drop_index("ix_daily_pl_summary_date", table_name="daily_pl_summary")
    op.drop_index("ix_daily_pl_summary_clinic_id", table_name="daily_pl_summary")
    op.drop_table("daily_pl_summary")

    op.drop_index("ix_invoices_created_at", table_name="invoices")
    op.drop_index("ix_invoices_status", table_name="invoices")
    op.drop_index("ix_invoices_consultation_firestore_id", table_name="invoices")
    op.drop_index("ix_invoices_clinic_id", table_name="invoices")
    op.drop_index("ix_invoices_invoice_number", table_name="invoices")
    op.drop_table("invoices")

    op.drop_index("ix_subscriptions_status", table_name="subscriptions")
    op.drop_index("ix_subscriptions_clinic_id", table_name="subscriptions")
    op.drop_table("subscriptions")

    op.drop_index("ix_clinics_firebase_clinic_id", table_name="clinics")
    op.drop_table("clinics")
