import React from "react";
import { ChartContainer } from "./ChartContainer";
import { AgentCard } from "../shared/AgentCard";
import { Cpu } from "lucide-react";

export const AIPerformanceCard: React.FC = () => {
  const agentsPerformance = [
    {
      name: "Agent 1: AppointmentFlow",
      agentId: "appointment_flow",
      role: "Multi-lingual WhatsApp Triage & Booking",
      status: "active" as const,
      lastTask: "Booked 24 appointments today",
      activityCount: 42,
      health: 99,
      latencyMs: 420
    },
    {
      name: "Agent 2: ClinicalScribe",
      agentId: "clinical_scribe",
      role: "Ambient Audio Diarization & SOAP Generation",
      status: "active" as const,
      lastTask: "Generated 18 SOAP notes",
      activityCount: 38,
      health: 98,
      latencyMs: 1450
    },
    {
      name: "Agent 3: BillingPulse",
      agentId: "billing_pulse",
      role: "Automated Invoicing & UPI Payments",
      status: "active" as const,
      lastTask: "Processed ₹35,400 UPI collections",
      activityCount: 30,
      health: 100,
      latencyMs: 310
    },
    {
      name: "Agent 4: RetentionRadar",
      agentId: "retention_radar",
      role: "Chronic Disease & Follow-Up Outreach",
      status: "active" as const,
      lastTask: "Recovered 8 missed follow-ups",
      activityCount: 15,
      health: 96,
      latencyMs: 820
    },
    {
      name: "Agent 5: PrescriptionSafe",
      agentId: "prescription_safe",
      role: "Drug Interaction Audit & Safety Check",
      status: "active" as const,
      lastTask: "Audited 18 prescriptions (0 Conflicts)",
      activityCount: 22,
      health: 100,
      latencyMs: 290
    },
    {
      name: "Agent 6: InsightEngine",
      agentId: "insight_engine",
      role: "Practice Health Score (94/100) & Analytics",
      status: "active" as const,
      lastTask: "Generated Executive Intelligence Briefing",
      activityCount: 8,
      health: 97,
      latencyMs: 1200
    },
    {
      name: "Agent 7: ReferralCoordinator",
      agentId: "referral_coordinator",
      role: "Specialist Referral Letter Extraction",
      status: "active" as const,
      lastTask: "Drafted 5 specialist referral letters",
      activityCount: 10,
      health: 99,
      latencyMs: 650
    }
  ];

  return (
    <ChartContainer title="Autonomous 7-Agent AI Workforce Performance" subtitle="Real-Time Task Execution, Latency & Health Matrix">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {agentsPerformance.map((agent) => (
          <AgentCard key={agent.agentId} {...agent} />
        ))}
      </div>
    </ChartContainer>
  );
};
