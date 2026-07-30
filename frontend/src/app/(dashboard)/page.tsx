"use client";

import React from "react";
import { useAppointmentsToday } from "@/hooks/useAppointmentsToday";
import { useBilling } from "@/hooks/useBilling";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { QueueHeader } from "@/components/queue/QueueHeader";
import { QueueSection } from "@/components/queue/QueueSection";
import { EmptyState, ActivityFeed, ActivityItem, SectionHeader, Panel, Badge, AIStatus } from "@/components/design-system";
import { Calendar, Clock, CheckCircle2, IndianRupee, Bot, Activity, Users } from "lucide-react";
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
  const { summary } = useBilling();
  const { logs } = useAgentLogs();

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

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <QueueHeader total={totalBooked} waiting={waiting} completed={completed} />

      {/* Status Pipeline */}
      <div className="panel p-4 flex items-center gap-3 overflow-x-auto scrollbar-none">
        <AIStatus state="completed" label="Patient Registered" />
        <span className="text-foreground-subtle">→</span>
        <AIStatus state="completed" label="AI Triage" />
        <span className="text-foreground-subtle">→</span>
        <AIStatus state={inProgress > 0 ? "running" : "pending"} label="Doctor Consult" />
        <span className="text-foreground-subtle">→</span>
        <AIStatus state="pending" label="SOAP & Rx" />
        <span className="text-foreground-subtle">→</span>
        <AIStatus state="pending" label="Bill & UPI" />
        <span className="text-foreground-subtle">→</span>
        <AIStatus state="pending" label="Follow-up" />
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
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-background-elevated/50 rounded-xl animate-pulse" />
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
            <SectionHeader icon={Calendar} title="Queue Summary" />
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="panel p-3 border border-border">
                <div className="text-2xl font-bold text-foreground">{totalBooked}</div>
                <div className="text-xs text-foreground-muted flex items-center gap-1"><Users className="w-3 h-3" /> Booked</div>
              </div>
              <div className="panel p-3 border border-border">
                <div className="text-2xl font-bold text-foreground">{waiting}</div>
                <div className="text-xs text-foreground-muted flex items-center gap-1"><Clock className="w-3 h-3" /> Waiting</div>
              </div>
              <div className="panel p-3 border border-border">
                <div className="text-2xl font-bold text-teal-400">{completed}</div>
                <div className="text-xs text-foreground-muted flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Completed</div>
              </div>
              <div className="panel p-3 border border-border">
                <div className="text-2xl font-bold text-green-400">{totalRevenue}</div>
                <div className="text-xs text-foreground-muted flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Collected</div>
              </div>
            </div>
          </Panel>

          <Panel padding="md">
            <SectionHeader icon={Bot} title="AI Activity" subtitle="Real-time decisions" />
            <ActivityFeed items={activities} className="mt-4" emptyMessage="No AI decisions yet." />
          </Panel>

          <Panel padding="md">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-teal-400" />
              <span className="text-sm font-semibold text-foreground">AI Health</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Agents Active</span>
                <Badge variant="green" dot>7/7</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Decisions Today</span>
                <span className="font-mono text-foreground">{logs.length || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Avg Latency</span>
                <span className="font-mono text-foreground">620ms</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
