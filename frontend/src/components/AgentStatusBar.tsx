"use client";

import React from "react";
import { AGENT_COLOR_MAP } from "@/lib/constants";
import { Cpu } from "lucide-react";

export function AgentStatusBar({
  activeFilter,
  onSelectFilter
}: {
  activeFilter: string | null;
  onSelectFilter: (agent: string | null) => void;
}) {
  const agents = [
    { id: "appointment_flow", label: "Agent 1: AppointmentFlow" },
    { id: "clinical_scribe", label: "Agent 2: ClinicalScribe" },
    { id: "billing_pulse", label: "Agent 3: BillingPulse" },
    { id: "retention_radar", label: "Agent 4: RetentionRadar" },
    { id: "prescription_safe", label: "Agent 5: PrescriptionSafe" },
    { id: "insight_engine", label: "Agent 6: InsightEngine" },
    { id: "referral_coordinator", label: "Agent 7: ReferralCoordinator" }
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
      <button
        onClick={() => onSelectFilter(null)}
        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border ${
          activeFilter === null
            ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
            : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
        }`}
      >
        All 7 Agents
      </button>

      {agents.map((agent) => {
        const colors = AGENT_COLOR_MAP[agent.id];
        const isSelected = activeFilter === agent.id;
        return (
          <button
            key={agent.id}
            onClick={() => onSelectFilter(isSelected ? null : agent.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border ${
              isSelected
                ? `${colors.bg} ${colors.text} ${colors.border}`
                : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
            }`}
          >
            {agent.label}
          </button>
        );
      })}
    </div>
  );
}
