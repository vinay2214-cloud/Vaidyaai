"use client";

import React, { useEffect, useState } from "react";
import { useClinicStore } from "@/store/clinicStore";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { OperationsHeader } from "@/components/operations/OperationsHeader";
import { AgentStatusCard, FullAgentStatus } from "@/components/operations/AgentStatusCard";
import { SystemHealthCard } from "@/components/operations/SystemHealthCard";
import { IntegrationCard } from "@/components/operations/IntegrationCard";
import { DecisionMonitor } from "@/components/operations/DecisionMonitor";
import { ConfigurationCard } from "@/components/operations/ConfigurationCard";
import { AuditCard, AuditSecurityEvent } from "@/components/operations/AuditCard";
import { PerformanceCard } from "@/components/operations/PerformanceCard";
import { OperationsInsightCard, OperationsInsightsData } from "@/components/operations/OperationsInsightCard";
import { OperationsSidebar } from "@/components/operations/OperationsSidebar";
import { OperationsSkeleton } from "@/components/operations/OperationsSkeleton";

export default function AIOperationsCenterPage() {
  const clinicId = useClinicStore((state) => state.clinicId);
  const { logs, loading: logsLoading } = useAgentLogs();
  const [loading, setLoading] = useState(true);

  const agents: FullAgentStatus[] = [
    {
      name: "Agent 1: AppointmentFlow",
      agentId: "appointment_flow",
      role: "Multi-lingual WhatsApp Triage & Booking",
      status: "active",
      currentTask: "Listening on WhatsApp Webhook (Cloud API v18.0)",
      tasksCompletedToday: 42,
      avgLatencyMs: 420,
      successRatePct: 99.2,
      recentErrorsCount: 0,
      lastActivityTime: "2 mins ago",
      modelUsed: "gemini-1.5-flash"
    },
    {
      name: "Agent 2: ClinicalScribe",
      agentId: "clinical_scribe",
      role: "Ambient Audio Diarization & SOAP Generation",
      status: "active",
      currentTask: "Diarizing 4-min consult audio stream",
      tasksCompletedToday: 18,
      avgLatencyMs: 1450,
      successRatePct: 98.5,
      recentErrorsCount: 0,
      lastActivityTime: "Just now",
      modelUsed: "gemini-1.5-pro"
    },
    {
      name: "Agent 3: BillingPulse",
      agentId: "billing_pulse",
      role: "Automated Invoicing & Razorpay UPI Payments",
      status: "active",
      currentTask: "Listening on Razorpay Webhooks",
      tasksCompletedToday: 30,
      avgLatencyMs: 310,
      successRatePct: 100.0,
      recentErrorsCount: 0,
      lastActivityTime: "10 mins ago",
      modelUsed: "gemini-1.5-flash"
    },
    {
      name: "Agent 4: RetentionRadar",
      agentId: "retention_radar",
      role: "Chronic Disease & Follow-Up Outreach",
      status: "active",
      currentTask: "Cron schedule active (Daily 9 AM IST)",
      tasksCompletedToday: 15,
      avgLatencyMs: 820,
      successRatePct: 96.0,
      recentErrorsCount: 0,
      lastActivityTime: "1 hour ago",
      modelUsed: "gemini-1.5-flash"
    },
    {
      name: "Agent 5: PrescriptionSafe",
      agentId: "prescription_safe",
      role: "Drug Interaction Audit & Safety Check",
      status: "active",
      currentTask: "Auditing prescription drug-drug interactions",
      tasksCompletedToday: 22,
      avgLatencyMs: 290,
      successRatePct: 100.0,
      recentErrorsCount: 0,
      lastActivityTime: "5 mins ago",
      modelUsed: "gemini-1.5-flash"
    },
    {
      name: "Agent 6: InsightEngine",
      agentId: "insight_engine",
      role: "Practice Health Analytics & Operational Insights",
      status: "active",
      currentTask: "Generating real-time executive brief",
      tasksCompletedToday: 8,
      avgLatencyMs: 1200,
      successRatePct: 97.5,
      recentErrorsCount: 0,
      lastActivityTime: "Just now",
      modelUsed: "gemini-1.5-pro"
    },
    {
      name: "Agent 7: ReferralCoordinator",
      agentId: "referral_coordinator",
      role: "Specialist Referral Letter Extraction",
      status: "active",
      currentTask: "Idle (Awaiting specialist dispatch signal)",
      tasksCompletedToday: 5,
      avgLatencyMs: 650,
      successRatePct: 99.0,
      recentErrorsCount: 0,
      lastActivityTime: "30 mins ago",
      modelUsed: "gemini-1.5-pro"
    }
  ];

  const operationsInsights: OperationsInsightsData = {
    generated_at: "Today, 10:55 AM IST",
    capacity_planning: "Vertex AI quota utilization at 14%. Cloud SQL CPU load at 8%. System can handle 10x traffic spike.",
    observations: [
      "All 7 autonomous AI agents running in nominal health state.",
      "Average AI response latency across all agents is 650 ms.",
      "Zero critical failures logged in past 24 hours."
    ],
    recommendations: [
      "Keep gemini-1.5-flash as primary model for low-latency triage & billing tasks.",
      "Maintain gemini-1.5-pro for complex clinical scribe and longitudinal summary tasks."
    ],
    risks: [
      "WhatsApp Cloud API rate limits must be monitored during 10 AM appointment surge."
    ],
    optimizations: [
      "Pre-warm Vertex AI connection pools to shave ~50ms off initial cold start latency."
    ]
  };

  const auditEvents: AuditSecurityEvent[] = [
    {
      id: "aud_evt_1",
      event_type: "Login",
      actor: "Dr. Vinay Sharma",
      description: "Authenticated via Firebase Auth (Multi-Factor Enabled)",
      timestamp: "Today, 08:30 AM IST",
      severity: "info"
    },
    {
      id: "aud_evt_2",
      event_type: "Config Change",
      actor: "System Administrator",
      description: "Updated WhatsApp Cloud API Webhook Secret Token",
      timestamp: "Yesterday, 06:15 PM IST",
      severity: "info"
    },
    {
      id: "aud_evt_3",
      event_type: "AI Audit",
      actor: "Agent 5 (PrescriptionSafe)",
      description: "Prescription drug-drug interaction audit passed with 0 conflicts",
      timestamp: "Today, 10:22 AM IST",
      severity: "info"
    }
  ];

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading || logsLoading) {
    return <OperationsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* SECTION 1: AI Operations Header */}
      <OperationsHeader
        platformHealthScore={99}
        uptimePct="99.99%"
        version="v2.0.0"
        environment="Production (asia-south1)"
        lastSync="Just now"
        onRefresh={() => window.location.reload()}
      />

      {/* SECTION 9: Operational Intelligence Briefing */}
      <OperationsInsightCard insights={operationsInsights} />

      {/* Main Grid Layout: Left Content (2 Cols), Right Sidebar (1 Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Primary Operations Workspaces */}
        <div className="lg:col-span-2 space-y-6">
          {/* SECTION 2: AI Workforce Status (7 Agents) */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white">Autonomous 7-Agent Workforce Health</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {agents.map((agent) => (
                <AgentStatusCard key={agent.agentId} agent={agent} />
              ))}
            </div>
          </div>

          {/* SECTION 3: System Health */}
          <SystemHealthCard />

          {/* SECTION 4: Integration Status */}
          <IntegrationCard />

          {/* SECTION 5: AI Decision Monitor & Feed */}
          <DecisionMonitor logs={logs} />

          {/* SECTION 6: System Configuration */}
          <ConfigurationCard />

          {/* SECTION 7: Audit & Security Trail */}
          <AuditCard events={auditEvents} />

          {/* SECTION 8: Performance Metrics */}
          <PerformanceCard />
        </div>

        {/* SECTION 10: Right Sidebar (Operations Status & Quick Links) */}
        <div className="space-y-6">
          <OperationsSidebar />
        </div>
      </div>
    </div>
  );
}
