import React from "react";
import { AgentCard } from "../shared/AgentCard";
import { DecisionCard } from "../shared/DecisionCard";
import { Cpu, Bot, ShieldCheck } from "lucide-react";

export const PatientSidebar: React.FC = () => {
  const patientAgents = [
    {
      name: "Agent 2: ClinicalScribe",
      agentId: "clinical_scribe",
      role: "Ambient Audio & SOAP Note Generation",
      status: "active" as const,
      lastTask: "Diarized 4-min Audio & Generated ICD-10 Note",
      activityCount: 18,
      health: 98,
      latencyMs: 1450
    },
    {
      name: "Agent 5: PrescriptionSafe",
      agentId: "prescription_safe",
      role: "Drug Interaction Audit & Allergy Check",
      status: "active" as const,
      lastTask: "Audited Metformin + Glimepiride (0 Critical Conflicts)",
      activityCount: 18,
      health: 100,
      latencyMs: 290
    },
    {
      name: "Agent 6: InsightEngine",
      agentId: "insight_engine",
      role: "Longitudinal AI Summary & Care Gaps",
      status: "active" as const,
      lastTask: "Generated Longitudinal Summary Package",
      activityCount: 4,
      health: 97,
      latencyMs: 1200
    },
    {
      name: "Agent 4: RetentionRadar",
      agentId: "retention_radar",
      role: "Chronic Disease & Follow-Up Tracking",
      status: "active" as const,
      lastTask: "Scheduled 30-Day Follow-Up Outreach",
      activityCount: 8,
      health: 96,
      latencyMs: 820
    },
    {
      name: "Agent 7: ReferralCoordinator",
      agentId: "referral_coordinator",
      role: "Specialist Referral Letter Extraction",
      status: "active" as const,
      lastTask: "Drafted Cardiology Referral Letter",
      activityCount: 5,
      health: 99,
      latencyMs: 650
    }
  ];

  return (
    <aside className="space-y-4">
      {/* AI Workforce Panel */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-teal-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Active Patient AI Workforce</h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
            Active
          </span>
        </div>

        <div className="space-y-2">
          {patientAgents.map((agent) => (
            <AgentCard key={agent.agentId} {...agent} />
          ))}
        </div>
      </div>

      {/* Recent Patient Decisions */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-teal-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Patient AI Audit Decisions</h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">Live</span>
        </div>

        <div className="space-y-2">
          <DecisionCard
            id="dec_1"
            agentName="ClinicalScribe"
            decisionType="soap_generated"
            decisionMade="Generated SOAP note & ICD-10 diagnoses for Type-2 Diabetes consult."
            timeAgo="Today"
            modelUsed="gemini-1.5-pro"
            latencyMs={1450}
          />
          <DecisionCard
            id="dec_2"
            agentName="PrescriptionSafe"
            decisionType="rx_audit_passed"
            decisionMade="Audited prescription regimen: Metformin 500mg (0 Conflicts)."
            timeAgo="Today"
            modelUsed="gemini-1.5-flash"
            latencyMs={290}
          />
        </div>
      </div>
    </aside>
  );
};
