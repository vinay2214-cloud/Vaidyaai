"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { useAgentHealth } from "@/hooks/useAgentHealth";
import { Panel, SectionHeader, ActivityFeed, ActivityItem, AIStatus } from "@/components/design-system";
import { Cpu, Bot, Activity } from "lucide-react";

const agentColorMap: Record<string, "teal" | "blue" | "orange" | "red" | "green" | "gray"> = {
  appointment_flow: "blue",
  clinical_scribe: "teal",
  billing_pulse: "green",
  retention_radar: "orange",
  prescription_safe: "red",
  insight_engine: "teal",
  referral_coordinator: "blue",
};

export const PatientSidebar: React.FC = () => {
  const params = useParams();
  const patientId = params?.id as string;
  const { logs } = useAgentLogs();
  const { platform } = useAgentHealth();

  // Filter logs for this specific patient if patientId is present
  const filteredLogs = logs
    .filter((log) => !patientId || log.patient_id === patientId || log.consultation_id?.includes(patientId))
    .slice(0, 5);

  const decisions: ActivityItem[] = filteredLogs.map((log, index) => {
    const key = log.agent_name.toLowerCase().replace(/\s/g, "_").replace(/agent_\d+:/, "").trim();
    return {
      id: log.id || `dec_${index}`,
      time: log.created_at
        ? new Date(log.created_at.toDate?.() || log.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
        : "--:--",
      agent: log.agent_name,
      agentColor: agentColorMap[key] || "gray",
      message: log.decision_made,
      status: log.success === false ? "failed" : "completed",
      details: log.model_used ? `${log.model_used} • ${log.latency_ms}ms` : undefined,
    };
  });

  const activeAgentsCount = platform?.active_agents ?? 7;
  const totalAgentsCount = platform?.total_agents ?? 7;
  const totalDecisions = logs.length;
  const avgLatency = platform?.avg_latency_ms || (logs.length > 0
    ? Math.round(logs.reduce((acc, log) => acc + (log.latency_ms || 0), 0) / logs.length)
    : 0);

  return (
    <aside className="space-y-4">
      <Panel padding="md">
        <SectionHeader
          icon={Cpu}
          title="Active Patient AI Workforce"
          action={<AIStatus state="running" label="Active" />}
        />
        <div className="mt-4 grid grid-cols-1 gap-2">
          <div className="panel p-3 bg-background-elevated/50 border border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-teal-400" />
              <span className="text-sm font-medium">ClinicalScribe</span>
            </div>
            <span className="text-xs text-foreground-subtle">SOAP</span>
          </div>
          <div className="panel p-3 bg-background-elevated/50 border border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-sm font-medium">PrescriptionSafe</span>
            </div>
            <span className="text-xs text-foreground-subtle">Safety</span>
          </div>
          <div className="panel p-3 bg-background-elevated/50 border border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-sm font-medium">ReferralCoordinator</span>
            </div>
            <span className="text-xs text-foreground-subtle">Referral</span>
          </div>
          <div className="panel p-3 bg-background-elevated/50 border border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-sm font-medium">RetentionRadar</span>
            </div>
            <span className="text-xs text-foreground-subtle">Follow-up</span>
          </div>
        </div>
      </Panel>

      <Panel padding="md">
        <SectionHeader icon={Bot} title="Patient AI Audit Decisions" subtitle="Live" />
        <ActivityFeed items={decisions} className="mt-4" emptyMessage="No active decisions for this patient." />
      </Panel>

      <Panel padding="md">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-teal-400" />
          <span className="text-sm font-semibold text-foreground">AI Health</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground-muted">Agents Active</span>
            <span className="font-mono text-green-400">{activeAgentsCount}/{totalAgentsCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground-muted">Decisions Today</span>
            <span className="font-mono text-foreground">{totalDecisions}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground-muted">Avg Latency</span>
            <span className="font-mono text-foreground">{avgLatency > 0 ? `${avgLatency}ms` : "No data available"}</span>
          </div>
        </div>
      </Panel>
    </aside>
  );
};
