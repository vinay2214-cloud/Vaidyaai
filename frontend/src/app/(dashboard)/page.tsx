"use client";

import React from "react";
import { useAppointmentsToday } from "@/hooks/useAppointmentsToday";
import { useBilling } from "@/hooks/useBilling";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { useAgentHealth } from "@/hooks/useAgentHealth";
import { QueueHeader } from "@/components/queue/QueueHeader";
import { QueueSection } from "@/components/queue/QueueSection";
import { EmptyState, ActivityFeed, ActivityItem, SectionHeader, Panel, Badge, AIStatus } from "@/components/design-system";
import { Calendar, Clock, CheckCircle2, IndianRupee, Bot, Activity, Users, ChevronRight } from "lucide-react";
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
  const agentName = log.agent_name.includes(":")
    ? log.agent_name.split(":").slice(1).join("").trim()
    : log.agent_name;

  const key = log.agent_name.toLowerCase().replace(/\s/g, "_").replace(/agent_\d+:/, "").trim();

  return {
    id: log.id || `log_${index}`,
    time: log.created_at
      ? new Date(log.created_at.toDate?.() || log.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
      : "--:--",
    agent: agentName,
    agentColor: agentColorMap[key] || "gray",
    message: log.decision_made,
    status: log.success === false ? "failed" : "completed",
    details: `${log.model_used || "gemini"} • ${log.latency_ms || 0}ms`,
  };
}

function getSectionForTime(slotTime: string, status: string): "morning" | "afternoon" | "evening" {
  if (status === "in_progress") return "morning"; // Current patient goes first
  const hour = parseInt(slotTime.split(":")[0], 10);
  const ampm = slotTime.toLowerCase().includes("pm") && hour !== 12;
  const h24 = ampm ? hour + 12 : hour;
  if (h24 < 12) return "morning";
  if (h24 < 17) return "afternoon";
  return "evening";
}

export default function TodayQueuePage() {
  const { appointments, loading } = useAppointmentsToday();
  const { summary, refresh: refreshBilling } = useBilling();
  const { logs } = useAgentLogs();
  const { platform } = useAgentHealth();

  const agentsActiveLabel = platform
    ? `${platform.active_agents ?? 0}/${platform.total_agents ?? 0}`
    : "—";
  const agentsActiveVariant: "green" | "orange" = platform
    ? (platform.total_failures_today ?? 0) === 0 && (platform.total_agents ?? 0) > 0 ? "green" : "orange"
    : "orange";

  React.useEffect(() => {
    refreshBilling();
    const interval = setInterval(() => {
      refreshBilling();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshBilling]);

  const totalBooked = appointments.length;
  const arrived = appointments.filter((a) => a.status === "arrived").length;
  const inProgress = appointments.filter((a) => a.status === "in_progress").length;
  const completed = appointments.filter((a) => a.status === "completed").length;
  const waiting = appointments.filter((a) => a.status === "booked" || a.status === "arrived").length;

  const currentPatient = appointments.find((a) => a.status === "in_progress");
  const waitingPatients = appointments.filter((a) => a.status === "arrived" || a.status === "booked");
  const lateArrivals = appointments.filter((a) => {
    const eta = (a.queue_number - 1) * 12;
    return (a.status === "arrived" || a.status === "booked") && eta > 20;
  });
  const completedPatients = appointments.filter((a) => a.status === "completed");

  const morningPatients = appointments.filter((a) => getSectionForTime(a.slot_time_str, a.status) === "morning" && a.status !== "completed" && a.status !== "in_progress");
  const afternoonPatients = appointments.filter((a) => getSectionForTime(a.slot_time_str, a.status) === "afternoon" && a.status !== "completed");
  const eveningPatients = appointments.filter((a) => getSectionForTime(a.slot_time_str, a.status) === "evening" && a.status !== "completed");

  const activities = logs.slice(0, 8).map(logToActivity);
  const totalRevenue = summary ? `₹${summary.total_collected_rupees.toLocaleString("en-IN")}` : "₹0";

  const activeEncounter = currentPatient || waitingPatients[0] || completedPatients[0] || null;

  const pipelineStates = React.useMemo(() => {
    if (!activeEncounter || appointments.length === 0) {
      return {
        registration: "pending" as const,
        triage: "pending" as const,
        consult: "pending" as const,
        soap: "pending" as const,
        billing: "pending" as const,
        followup: "pending" as const,
      };
    }

    const isArrived = activeEncounter.status === "arrived" || activeEncounter.status === "booked";
    const isInProgress = activeEncounter.status === "in_progress";
    const isCompleted = activeEncounter.status === "completed";

    return {
      registration: "completed" as const,
      triage: isCompleted || isInProgress || (activeEncounter as any).triage_note ? ("completed" as const) : isArrived ? ("running" as const) : ("pending" as const),
      consult: isCompleted ? ("completed" as const) : isInProgress ? ("running" as const) : ("pending" as const),
      soap: isCompleted || (activeEncounter as any).soap_approved ? ("completed" as const) : isInProgress && (activeEncounter as any).soap_note ? ("running" as const) : ("pending" as const),
      billing: isCompleted || (activeEncounter as any).billing_status === "paid" ? ("completed" as const) : (activeEncounter as any).billing_status === "pending" ? ("running" as const) : ("pending" as const),
      followup: isCompleted ? ("completed" as const) : ("pending" as const),
    };
  }, [activeEncounter, appointments.length]);

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <QueueHeader total={totalBooked} waiting={waiting} completed={completed} />

      {/* Status Pipeline */}
      <div className="panel px-4 py-3.5 flex items-center gap-3 overflow-x-auto scrollbar-none" aria-label="Patient journey pipeline">
        <AIStatus state={pipelineStates.registration} label="Patient Registered" className="shrink-0" />
        <ChevronRight className="w-4 h-4 text-foreground-subtle shrink-0" aria-hidden="true" />
        <AIStatus state={pipelineStates.triage} label="AI Triage" className="shrink-0" />
        <ChevronRight className="w-4 h-4 text-foreground-subtle shrink-0" aria-hidden="true" />
        <AIStatus state={pipelineStates.consult} label="Doctor Consult" className="shrink-0" />
        <ChevronRight className="w-4 h-4 text-foreground-subtle shrink-0" aria-hidden="true" />
        <AIStatus state={pipelineStates.soap} label="SOAP & Rx" className="shrink-0" />
        <ChevronRight className="w-4 h-4 text-foreground-subtle shrink-0" aria-hidden="true" />
        <AIStatus state={pipelineStates.billing} label="Bill & UPI" className="shrink-0" />
        <ChevronRight className="w-4 h-4 text-foreground-subtle shrink-0" aria-hidden="true" />
        <AIStatus state={pipelineStates.followup} label="Follow-up" className="shrink-0" />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {currentPatient && (
            <QueueSection title="Current Patient" appointments={[currentPatient]} priority="orange" />
          )}

          {waitingPatients.length > 0 && (
            <div className="space-y-4">
              {morningPatients.length > 0 && <QueueSection title="Morning" appointments={morningPatients} priority="green" />}
              {afternoonPatients.length > 0 && <QueueSection title="Afternoon" appointments={afternoonPatients} priority="yellow" />}
              {eveningPatients.length > 0 && <QueueSection title="Evening" appointments={eveningPatients} priority="orange" />}
            </div>
          )}

          {lateArrivals.length > 0 && (
            <QueueSection title="Late Arrivals" appointments={lateArrivals} priority="red" />
          )}

          {completedPatients.length > 0 && (
            <QueueSection title="Completed" appointments={completedPatients} priority="green" />
          )}

          {loading ? (
            <div className="space-y-3" role="status" aria-label="Loading today's queue">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-background-elevated/50 border border-border rounded-xl animate-pulse" />
              ))}
            </div>
          ) : appointments.length === 0 ? (
            <EmptyState
              title="No Patients in Queue"
              description="Patients booking via WhatsApp or walk-in will appear here automatically."
              icon={Users}
            />
          ) : null}
        </div>

        <div className="space-y-6">
          <Panel padding="md">
            <SectionHeader icon={Calendar} title="Queue Summary" subtitle="Today's live snapshot" />
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="rounded-xl bg-background-elevated/50 border border-border p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-foreground tnum">{totalBooked}</span>
                  <span className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center"><Users className="w-3.5 h-3.5 text-blue-400" /></span>
                </div>
                <div className="text-xs font-medium text-foreground-muted">Booked</div>
              </div>
              <div className="rounded-xl bg-background-elevated/50 border border-border p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-foreground tnum">{waiting}</span>
                  <span className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center"><Clock className="w-3.5 h-3.5 text-orange-400" /></span>
                </div>
                <div className="text-xs font-medium text-foreground-muted">Waiting</div>
              </div>
              <div className="rounded-xl bg-background-elevated/50 border border-border p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-teal-400 tnum">{completed}</span>
                  <span className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-teal-400" /></span>
                </div>
                <div className="text-xs font-medium text-foreground-muted">Completed</div>
              </div>
              <div className="rounded-xl bg-background-elevated/50 border border-border p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-green-400 tnum">{totalRevenue}</span>
                  <span className="w-7 h-7 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-center"><IndianRupee className="w-3.5 h-3.5 text-green-400" /></span>
                </div>
                <div className="text-xs font-medium text-foreground-muted">Collected</div>
              </div>
            </div>
          </Panel>

          <Panel padding="md">
            <SectionHeader icon={Bot} title="AI Activity" subtitle="Real-time decisions" />
            <ActivityFeed items={activities} className="mt-4" emptyMessage="No AI decisions yet." />
          </Panel>

          <Panel padding="md">
            <SectionHeader icon={Activity} title="AI Health" subtitle="Workforce telemetry" />
            <div className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Agents Active</span>
                <Badge variant={agentsActiveVariant} dot>{agentsActiveLabel}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-border/50 pt-2.5">
                <span className="text-foreground-muted">Decisions Today</span>
                <span className="font-mono font-medium text-foreground tnum">{logs.length || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-border/50 pt-2.5">
                <span className="text-foreground-muted">Avg Latency</span>
                <span className="font-mono font-medium text-foreground tnum">
                  {logs.length > 0 
                    ? `${Math.round(logs.reduce((acc, log) => acc + (log.latency_ms || 0), 0) / logs.length)}ms`
                    : "0ms"}
                </span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
