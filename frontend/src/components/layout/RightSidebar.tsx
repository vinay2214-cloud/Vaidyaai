"use client";

import React from "react";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { ActivityFeed, ActivityItem } from "@/components/design-system/ActivityFeed";
import { Panel, SectionHeader, Badge, AIStatus } from "@/components/design-system";
import { Bot, ShieldAlert, ClipboardList, CheckCircle2 } from "lucide-react";
import { AgentLog } from "@/hooks/useAgentLogs";

const agentColorMap: Record<string, "teal" | "blue" | "orange" | "red" | "green" | "gray"> = {
  appointment_flow: "blue",
  clinical_scribe: "teal",
  billing_pulse: "green",
  retention_radar: "orange",
  prescription_safe: "red",
  insight_engine: "teal",
  referral_coordinator: "blue",
};

function logToActivity(log: AgentLog, index: number): ActivityItem {
  const agentName = log.agent_name.includes(" ")
    ? log.agent_name.split(" ").slice(2).join(" ")
    : log.agent_name;

  const key = log.agent_name.toLowerCase().replace(/\s/g, "_").replace(/agent_\d+:/, "").trim();

  return {
    id: log.id || `log_${index}`,
    time: log.created_at ? new Date(log.created_at.toDate?.() || log.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--",
    agent: agentName,
    agentColor: agentColorMap[key] || "gray",
    message: log.decision_made,
    status: log.success === false ? "failed" : "completed",
    details: `${log.model_used || "gemini"} • ${log.latency_ms || 0}ms`,
  };
}

export function RightSidebar() {
  const { logs, loading } = useAgentLogs();
  const activities = logs.slice(0, 8).map(logToActivity);

  const aiTasks = [
    { label: "Clinical Scribe", state: "running" as const, sublabel: "Listening" },
    { label: "SOAP Generation", state: "completed" as const, sublabel: "Ready" },
    { label: "Drug Interaction", state: "completed" as const, sublabel: "0 conflicts" },
    { label: "Billing Pulse", state: "running" as const, sublabel: "₹500 ready" },
  ];

  return (
    <aside className="w-72 bg-background-panel border-l border-border flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
            <Bot className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">AI Assistant</h2>
            <p className="text-[10px] text-foreground-subtle">Working beside you</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="space-y-2">
          {aiTasks.map((task) => (
            <AIStatus key={task.label} state={task.state} label={`${task.label}: ${task.sublabel}`} />
          ))}
        </div>

        <Panel padding="sm">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-semibold text-foreground">Safety Alerts</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-start gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5" />
              <p className="text-xs text-foreground">Penicillin allergy on file. Avoid beta-lactam antibiotics.</p>
            </div>
            <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5" />
              <p className="text-xs text-foreground">Diabetic retinopathy screening overdue by 60 days.</p>
            </div>
          </div>
        </Panel>

        <div>
          <SectionHeader
            icon={Bot}
            title="Agent Activity"
            subtitle="Live workflow trace"
          />
          <ActivityFeed items={activities} loading={loading} className="mt-3" />
        </div>

        <Panel padding="sm">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold text-foreground">Tasks</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span>Review 2 pending prescriptions</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span>Send 1 follow-up reminder</span>
            </div>
          </div>
        </Panel>
      </div>
    </aside>
  );
}
