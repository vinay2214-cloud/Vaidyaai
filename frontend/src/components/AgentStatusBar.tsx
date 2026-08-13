"use client";

import React from "react";
import { AgentDot } from "./shared/AgentDot";
import { Cpu, Zap, Activity } from "lucide-react";
import { useAgentLogs } from "@/hooks/useAgentLogs";

interface AgentStatusBarProps {
  activeFilter?: string | null;
  onSelectFilter?: (agent: string | null) => void;
  showFilters?: boolean;
  showFiltersOnly?: boolean;
  className?: string;
}

export function AgentStatusBar({
  activeFilter = null,
  onSelectFilter,
  showFilters = false,
  showFiltersOnly = false,
  className
}: AgentStatusBarProps) {
  const { logs } = useAgentLogs();

  const totalDecisionsToday = logs.length;
  const lastDecision = logs.length > 0 ? logs[0] : null;
  const lastDecisionText = lastDecision
    ? `${lastDecision.agent_name}: ${lastDecision.decision_type}`
    : "No agent activity recorded yet";

  const agents = [
    { id: "appointment_flow", label: "Appointment Assistant" },
    { id: "clinical_scribe", label: "Clinical Scribe" },
    { id: "prescription_safe", label: "Medication Safety" },
    { id: "billing_pulse", label: "Billing Assistant" },
    { id: "retention_radar", label: "Follow-up Assistant" },
    { id: "referral_coordinator", label: "Referral Assistant" },
    { id: "insight_engine", label: "Clinical Insights" }
  ];

  if (showFiltersOnly && onSelectFilter) {
    return (
      <div className={`flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none ${className || ""}`}>
        <button
          onClick={() => onSelectFilter(null)}
          className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border ${
            activeFilter === null
              ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
              : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
          }`}
        >
          All 7 Agents
        </button>

        {agents.map((agent) => {
          const isSelected = activeFilter === agent.id;
          return (
            <button
              key={agent.id}
              onClick={() => onSelectFilter(isSelected ? null : agent.id)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border ${
                isSelected
                  ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
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

  return (
    <div className={`space-y-2 ${className || ""}`}>
      {/* Global Status Banner Bar */}
      <div className="bg-slate-800/90 border border-slate-700/70 rounded-2xl px-4 py-2 flex items-center justify-between gap-4 text-xs shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <AgentDot status="active" />
            <span className="font-bold text-white flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-teal-400" />
              AI Workforce Active
            </span>
          </div>

          <span className="text-slate-600">|</span>

          <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 text-[11px]">
            7 agents deployed
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-4 text-slate-400 text-[11px]">
          <div className="flex items-center gap-1.5 truncate max-w-xs">
            <Zap className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="text-slate-500">Last decision:</span>
            <span className="text-slate-200 font-medium truncate">{lastDecisionText}</span>
          </div>

          <span className="text-slate-600">|</span>

          <div className="flex items-center gap-1.5 shrink-0">
            <Activity className="w-3 h-3 text-blue-400" />
            <span className="text-slate-500">Decisions today:</span>
            <span className="text-teal-400 font-bold font-mono">{totalDecisionsToday}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
