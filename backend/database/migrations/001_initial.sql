-- ============================================================================
-- VaidyaAI Agents — PostgreSQL Initial Migration
-- Version: 001_initial
-- Database: vaidyaai (PostgreSQL 15, Cloud SQL, asia-south1)
-- ============================================================================
-- This migration creates all tables required for VaidyaAI financial,
-- billing, subscription, referral, retention, and agent metrics data.
--
-- Firestore handles: clinics (config), patients, appointments, consultations,
--                    agent_logs, pending_bookings, clinic_insights
-- PostgreSQL handles: financial records, subscriptions, invoices, P&L,
--                     referral tracking, retention outreach, agent stats
--
-- Run:
--   psql $DATABASE_URL -f backend/database/migrations/001_initial.sql
-- ============================================================================

BEGIN;

-- ─── Extension: UUID generation ────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Table: clinics ────────────────────────────────────────────────────────
-- Financial identity of each clinic. Mirrors subset of Firestore clinics/{id}.
CREATE TABLE IF NOT EXISTS clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_clinic_id VARCHAR(128) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    doctor_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    whatsapp_phone_id VARCHAR(100) NOT NULL,
    speciality VARCHAR(100) DEFAULT 'General Medicine',
    location VARCHAR(255),
    subscription_plan VARCHAR(20) DEFAULT 'essential'
        CHECK (subscription_plan IN ('essential', 'growth', 'pro')),
    razorpay_account_id VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    onboarding_complete BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinics_firebase_id 
    ON clinics(firebase_clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinics_active 
    ON clinics(is_active) WHERE is_active = true;

-- ─── Table: subscriptions ──────────────────────────────────────────────────
-- SaaS subscription lifecycle per clinic.
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    plan VARCHAR(20) NOT NULL 
        CHECK (plan IN ('essential', 'growth', 'pro')),
    monthly_fee_paise INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'trial'
        CHECK (status IN ('trial', 'active', 'paused', 'cancelled')),
    razorpay_subscription_id VARCHAR(100),
    trial_ends_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    next_billing_date DATE,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_clinic 
    ON subscriptions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status 
    ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active 
    ON subscriptions(clinic_id, status) WHERE status IN ('trial', 'active');

-- ─── Table: invoices ───────────────────────────────────────────────────────
-- Patient consultation invoices with Razorpay payment tracking.
-- Invoice number format: VDY-YYYYMMDD-XXXX (monotonic sequence per day).
CREATE SEQUENCE IF NOT EXISTS invoice_sequence START 1000;

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(30) UNIQUE NOT NULL,
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    patient_phone_masked VARCHAR(20) NOT NULL,
    consultation_firestore_id VARCHAR(128),
    amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0),
    consultation_type VARCHAR(20) 
        CHECK (consultation_type IN ('new', 'followup', 'procedure')),
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'waived', 'failed', 'refunded')),
    payment_method VARCHAR(20)
        CHECK (payment_method IN ('upi', 'cash', 'card', 'waived') OR payment_method IS NULL),
    razorpay_payment_link_id VARCHAR(100),
    razorpay_payment_link_url TEXT,
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    reminder_sent_at TIMESTAMPTZ,
    waived_reason VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_invoices_clinic 
    ON invoices(clinic_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status 
    ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created 
    ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_consultation 
    ON invoices(consultation_firestore_id);
CREATE INDEX IF NOT EXISTS idx_invoices_clinic_date 
    ON invoices(clinic_id, created_at DESC);

-- ─── Table: daily_pl_summary ───────────────────────────────────────────────
-- Daily P&L per clinic. Aggregated from invoices, sent to doctor at 9 PM IST.
CREATE TABLE IF NOT EXISTS daily_pl_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    date DATE NOT NULL,
    patients_seen INTEGER DEFAULT 0,
    total_billed_paise INTEGER DEFAULT 0,
    total_collected_paise INTEGER DEFAULT 0,
    upi_paise INTEGER DEFAULT 0,
    cash_paise INTEGER DEFAULT 0,
    card_paise INTEGER DEFAULT 0,
    pending_paise INTEGER DEFAULT 0,
    waived_paise INTEGER DEFAULT 0,
    invoice_count INTEGER DEFAULT 0,
    pnl_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_pl_clinic_date 
    ON daily_pl_summary(clinic_id, date DESC);

-- ─── Table: agent_execution_stats ──────────────────────────────────────────
-- Per-agent daily metrics for analytics dashboard.
CREATE TABLE IF NOT EXISTS agent_execution_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    date DATE NOT NULL,
    agent_name VARCHAR(50) NOT NULL,
    decisions_made INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    gemini_calls INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    avg_latency_ms FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, date, agent_name)
);

CREATE INDEX IF NOT EXISTS idx_agent_stats_clinic_date 
    ON agent_execution_stats(clinic_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_agent_stats_agent 
    ON agent_execution_stats(agent_name, date DESC);

-- ─── Table: referral_tracking ──────────────────────────────────────────────
-- Lab/specialist/imaging referral lifecycle tracking.
CREATE TABLE IF NOT EXISTS referral_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    patient_phone_masked VARCHAR(20) NOT NULL,
    consultation_firestore_id VARCHAR(128),
    referral_type VARCHAR(20) 
        CHECK (referral_type IN ('lab', 'specialist', 'imaging', 'pharmacy')),
    description TEXT NOT NULL,
    urgency VARCHAR(20) DEFAULT 'routine' 
        CHECK (urgency IN ('routine', 'urgent')),
    suggested_provider VARCHAR(255),
    status VARCHAR(20) DEFAULT 'sent'
        CHECK (status IN ('sent', 'acknowledged', 'completed', 'expired')),
    patient_notified_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    followup_count INTEGER DEFAULT 0,
    last_followup_at TIMESTAMPTZ,
    followup_task_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_clinic 
    ON referral_tracking(clinic_id);
CREATE INDEX IF NOT EXISTS idx_referral_status 
    ON referral_tracking(status);
CREATE INDEX IF NOT EXISTS idx_referral_pending 
    ON referral_tracking(clinic_id, status, created_at) 
    WHERE status IN ('sent', 'acknowledged');

-- ─── Table: retention_outreach ────────────────────────────────────────────
-- Retention message log for rate limiting and analytics.
CREATE TABLE IF NOT EXISTS retention_outreach (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    patient_phone_masked VARCHAR(20) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL,
    message_language VARCHAR(5) NOT NULL,
    message_text TEXT NOT NULL,
    whatsapp_message_id VARCHAR(100),
    delivered BOOLEAN DEFAULT false,
    appointment_booked_after BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retention_clinic_patient 
    ON retention_outreach(clinic_id, patient_phone_masked);
CREATE INDEX IF NOT EXISTS idx_retention_sent_at 
    ON retention_outreach(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_retention_rate_limit 
    ON retention_outreach(clinic_id, patient_phone_masked, sent_at DESC);

-- ─── Updated_at trigger function ──────────────────────────────────────────
-- Auto-update updated_at timestamp on row modification.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_clinics_updated_at
    BEFORE UPDATE ON clinics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_pl_updated_at
    BEFORE UPDATE ON daily_pl_summary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Verification ──────────────────────────────────────────────────────────
-- Run this after migration to verify all tables exist:
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
    
    IF table_count < 7 THEN
        RAISE EXCEPTION 'Expected at least 7 tables, found %', table_count;
    END IF;
    
    RAISE NOTICE 'Migration 001_initial: SUCCESS — % tables created', table_count;
END $$;

COMMIT;
