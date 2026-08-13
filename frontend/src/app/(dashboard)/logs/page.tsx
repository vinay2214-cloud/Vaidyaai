"use client";

import React, { useMemo, useState } from "react";
import { useAgentLogs, useAgentHealth } from "@/hooks/useAgentLogs";
import { useClinicStore } from "@/store/clinicStore";
import { useUIStore } from "@/store/uiStore";
import { Panel, SectionHeader, ActivityFeed, ActivityItem, AIStatus, Button, Badge } from "@/components/design-system";
import { cn } from "@/lib/cn";
import { Cpu, Download, Activity, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, Terminal } from "lucide-react";
import api from "@/lib/api";

const AGENTS = [
  { id: "appointment_flow", label: "Appointment Assistant", color: "teal" as const, decisions: "slot_offers" },
  { id: "clinical_scribe", label: "Clinical Scribe", color: "blue" as const, decisions: "soap_drafts" },
  { id: "prescription_safe", label: "Medication Safety", color: "red" as const, decisions: "safety_checks" },
  { id: "billing_pulse", label: "Billing Assistant", color: "orange" as const, decisions: "invoice_runs" },
  { id: "retention_radar", label: "Follow-up Assistant", color: "green" as const, decisions: "followups" },
  { id: "referral_coordinator", label: "Referral Assistant", color: "green" as const, decisions: "referral_links" },
  { id: "insight_engine", label: "Clinical Insights", color: "blue" as const, decisions: "practice_alerts" },
];

const AGENT_COLOR_MAP: Record<string, ActivityItem["agentColor"]> = {
  appointment_flow: "teal",
  clinical_scribe: "blue",
  billing_pulse: "orange",
  retention_radar: "green",
  prescription_safe: "red",
  insight_engine: "blue",
  referral_coordinator: "green",
};

function formatLogTime(createdAt?: any): string {
  if (!createdAt) return "Just now";
  let date: Date | null = null;
  if (typeof createdAt === "string") {
    date = new Date(createdAt);
  } else if (createdAt?.seconds) {
    date = new Date(createdAt.seconds * 1000);
  } else if (createdAt?.toDate) {
    date = createdAt.toDate();
  }
  if (!date || isNaN(date.getTime())) return "Just now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function AgentLogsPage() {
  const selectedAgentFilter = useUIStore((state) => state.selectedAgentFilter);
  const setSelectedAgentFilter = useUIStore((state) => state.setSelectedAgentFilter);
  const clinicId = useClinicStore((state) => state.clinicId);
  const { logs, loading } = useAgentLogs(selectedAgentFilter);
  const { healthData } = useAgentHealth();
  const [expanded, setExpanded] = useState<string | null>(null);

  const items: ActivityItem[] = useMemo(
    () =>
      logs.map((log) => ({
        id: log.id,
        time: formatLogTime(log.created_at),
        agent: log.agent_name,
        agentColor: AGENT_COLOR_MAP[log.agent_name] || "gray",
        message: log.decision_made,
        status: log.success === false ? "failed" : "completed",
        details: [log.input_summary, log.output_summary].filter(Boolean).join(" → ") || undefined,
      })),
    [logs]
  );

  const stats = useMemo(() => {
    const platform = healthData?.platform;
    if (platform) {
      return {
        total: platform.total_tasks_today,
        errors: platform.total_failures_today,
        avgLatency: platform.avg_latency_ms,
        activeAgents: platform.active_agents,
        totalAgents: platform.total_agents,
      };
    }
    const total = logs.length;
    const errors = logs.filter((l) => l.success === false).length;
    const latencies = logs.map((l) => l.latency_ms).filter((l): l is number => l !== undefined);
    const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    const distinctAgents = new Set(logs.map((l) => l.agent_name)).size;
    return { total, errors, avgLatency, activeAgents: distinctAgents, totalAgents: 7 };
  }, [healthData, logs]);

  const handleExportEvidence = async () => {
    if (!clinicId) return;
    try {
      const res = await api.get(`/analytics/export-evidence?clinic_id=${clinicId}`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VaidyaAI_Agent_Decision_Logs_${clinicId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn("Export evidence API warning, executing client export:", e);
      const blob = new Blob([JSON.stringify({ clinic_id: clinicId, agent_logs: logs }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VaidyaAI_Agent_Decision_Logs_${clinicId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleExportCSV = () => {
    const csvHeaders = "timestamp,agent,decision_type,decision_made,outcome,latency_ms\n";
    const csvRows = logs
      .map(
        (l) =>
          `${l.created_at || new Date().toISOString()},${l.agent_name},${l.decision_type},"${l.decision_made.replace(/"/g, '""')}",${l.success !== false ? "success" : "failure"},${l.latency_ms || 0}`
      )
      .join("\n");
    const blob = new Blob([csvHeaders + csvRows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vaidyaai_agent_logs_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <SectionHeader
        icon={Terminal}
        title="AI Operations Timeline"
        subtitle="Live decision audit log across all autonomous AI agents"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleExportCSV}>
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button variant="primary" size="sm" onClick={handleExportEvidence}>
              <Download className="w-3.5 h-3.5" /> Evidence
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="neutral" dot dotClassName={stats.errors === 0 ? "bg-green-400" : "bg-red-400"}>
          {stats.errors === 0 ? `${stats.activeAgents}/${stats.totalAgents} agents healthy` : `${stats.errors} recent failures`}
        </Badge>
        <Badge variant="neutral" className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-foreground-subtle" /> {stats.total} decisions today
        </Badge>
        {stats.avgLatency > 0 && (
          <Badge variant="neutral" className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-foreground-subtle" /> {stats.avgLatency}ms avg latency
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedAgentFilter(null)}
          className={cn(
            "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all duration-250 focus-ring",
            selectedAgentFilter === null
              ? "bg-teal-500/10 text-teal-400 border-teal-500/30"
              : "bg-background-elevated text-foreground-subtle border-border hover:text-foreground"
          )}
        >
          All 7 Agents
        </button>
        {AGENTS.map((agent) => {
          const isSelected = selectedAgentFilter === agent.id;
          return (
            <button
              key={agent.id}
              onClick={() => setSelectedAgentFilter(isSelected ? null : agent.id)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all duration-250 focus-ring",
                isSelected
                  ? "bg-teal-500/10 text-teal-400 border-teal-500/30"
                  : "bg-background-elevated text-foreground-subtle border-border hover:text-foreground"
              )}
            >
              {agent.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        <Panel className="lg:col-span-2 flex flex-col min-h-0" padding="md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Live Decision Feed</h3>
            <AIStatus state="running" label="Streaming" />
          </div>
          <div className="flex-1 overflow-y-auto pr-1 -mr-1">
            <ActivityFeed
              items={items}
              loading={loading}
              emptyMessage="No agent decisions streaming. Activity will appear as incoming messages, voice scribes, and billing events occur."
            />
          </div>
        </Panel>

        <Panel className="flex flex-col gap-4" padding="md">
          <SectionHeader icon={Cpu} title="AI Workforce" subtitle="Agent status & throughput" />

          <div className="space-y-2">
            {AGENTS.map((agent) => {
              const agentHealth = healthData?.agents.find((a) => a.id === agent.id);
              const agentLogs = logs.filter((l) => l.agent_name === agent.id);
              const tasksToday = agentHealth?.tasks_today ?? agentLogs.length;
              const statusText = agentHealth?.status || (tasksToday > 0 ? "Healthy" : "Idle");
              const lastDecisionText = agentHealth?.last_decision || agentLogs[0]?.decision_made;

              const statusState =
                statusText === "Running"
                  ? "running"
                  : statusText === "Healthy" || statusText === "Completed"
                  ? "completed"
                  : statusText === "Failed"
                  ? "warning"
                  : "pending";

              return (
                <div
                  key={agent.id}
                  className={cn(
                    "group rounded-xl border border-border bg-background-elevated p-3 transition-all duration-250 hover:border-border-strong hover:bg-background-hover",
                    selectedAgentFilter === agent.id && "border-teal-500/30 bg-teal-500/5"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          statusText === "Running" && "bg-green-400 animate-pulse",
                          statusText === "Healthy" && "bg-teal-400",
                          statusText === "Failed" && "bg-red-400 animate-pulse",
                          statusText === "Idle" && "bg-slate-400"
                        )}
                      />
                      <span className="text-sm font-medium text-foreground">{agent.label}</span>
                    </div>
                    <AIStatus
                      state={statusState}
                      label={statusText}
                      pulse={statusText === "Running"}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-foreground-subtle">
                    <span className="capitalize">{agent.decisions.replace(/_/g, " ")}</span>
                    <span>{tasksToday} today</span>
                  </div>
                  {lastDecisionText && (
                    <p className="mt-1.5 text-xs text-foreground-subtle truncate">
                      Last: {lastDecisionText}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-auto pt-4 border-t border-border">
            <button
              onClick={() => setExpanded(expanded === "health" ? null : "health")}
              className="flex items-center justify-between w-full text-xs font-medium text-foreground-subtle hover:text-foreground transition-colors focus-ring rounded-lg py-1"
              aria-expanded={expanded === "health"}
            >
              System Health Summary
              {expanded === "health" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expanded === "health" && (
              <div className="mt-2 space-y-2 text-xs text-foreground-subtle">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span>All agents responding within SLA</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span>Real-time Firestore listener active</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span>{stats.errors} failed decisions today</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span>Avg latency: {stats.avgLatency ? `${stats.avgLatency}ms` : "No data available"}</span>
                </div>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
