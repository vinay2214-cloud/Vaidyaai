"use client";

import React from "react";
import { useAppointmentsToday } from "@/hooks/useAppointmentsToday";
import { useBilling } from "@/hooks/useBilling";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { useAgentHealth } from "@/hooks/useAgentHealth";
import { QueueHeader } from "@/components/queue/QueueHeader";
import { QueueSection } from "@/components/queue/QueueSection";
import {
  EmptyState,
  ActivityFeed,
  ActivityItem,
  SectionHeader,
  Panel,
  Badge,
  AIStatus,
  SkeletonQueueSection,
  SkeletonStatTile,
  SkeletonFeed,
} from "@/components/design-system";
import { ErrorState } from "@/components/shared/ErrorState";
import { Calendar, Clock, CheckCircle2, IndianRupee, Bot, Activity, Users, ChevronRight, AlertTriangle } from "lucide-react";
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
  const { appointments, loading, error, refresh: refreshQueue } = useAppointmentsToday();
  const { summary, loading: billingLoading, refresh: refreshBilling } = useBilling();
  const { logs, loading: logsLoading, streamStatus } = useAgentLogs();
  const { platform, loading: healthLoading, error: healthError, refresh: refreshHealth } = useAgentHealth();

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
  // "Long waits", not "high queue numbers". This previously derived a synthetic
  // ETA from queue position (queue_number * 12 min), so patient #3 was flagged
  // as late on a quiet morning while someone genuinely waiting an hour was not.
  const lateArrivals = appointments.filter((a) => {
    if (a.status !== "arrived" && a.status !== "booked") return false;
    if (!a.arrived_at) return false;
    const arrived = new Date(a.arrived_at).getTime();
    if (Number.isNaN(arrived)) return false;
    return (Date.now() - arrived) / 60000 >= 30;
  });
  const completedPatients = appointments.filter((a) => a.status === "completed");

  const morningPatients = appointments.filter((a) => getSectionForTime(a.slot_time_str, a.status) === "morning" && a.status !== "completed" && a.status !== "in_progress");
  const afternoonPatients = appointments.filter((a) => getSectionForTime(a.slot_time_str, a.status) === "afternoon" && a.status !== "completed");
  const eveningPatients = appointments.filter((a) => getSectionForTime(a.slot_time_str, a.status) === "evening" && a.status !== "completed");

  const activities = logs.slice(0, 8).map(logToActivity);
  const totalRevenue = summary ? `₹${summary.total_collected_rupees.toLocaleString("en-IN")}` : "₹0";

  // Task 4 — one source of truth for "how many decisions today".
  //
  // This counter used to read `logs.length`, which is a *client-side buffer*
  // (SSE events merged with a Firestore page, hard-capped at MAX_LOGS=50). The
  // Operations Center meanwhile reads `platform.total_tasks_today` from
  // /agents/health. The two disagreed constantly: the buffer caps at 50, and
  // whenever the Firestore listener was blocked the feed sat empty while the
  // REST-backed counter showed real activity — "N decisions" next to "no
  // activity yet". Bind the counter to the authoritative server figure and let
  // the feed be an explicit recent-slice of it.
  const decisionsToday = platform?.total_tasks_today ?? (logs.length || 0);

  // The feed showing nothing while the counter is non-zero is a real condition
  // (stream down, or the clinic_id claim missing so agent_logs reads are
  // denied), not "no activity". Say which it is instead of contradicting the
  // number sitting directly above it.
  const feedContradictsCounter = activities.length === 0 && decisionsToday > 0;
  const activityEmptyMessage = feedContradictsCounter
    ? streamStatus === "connected"
      ? `${decisionsToday} decisions recorded today, but this clinic's log stream returned none. Reload to resync.`
      : "Reconnecting to the live decision stream..."
    : "No AI decisions yet. Agent activity appears here the moment a patient is booked or seen.";

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
          {/* Loading, error and empty are mutually exclusive with the queue
              itself. Previously the skeleton rendered *below* whatever had
              already loaded, so a slow queue showed content and placeholders
              at the same time. */}
          {loading ? (
            <div className="space-y-4">
              <SkeletonQueueSection rows={1} />
              <SkeletonQueueSection rows={3} />
            </div>
          ) : error && appointments.length === 0 ? (
            <ErrorState
              title="Unable to Load Today's Queue"
              description={error}
              onRetry={refreshQueue}
            />
          ) : appointments.length === 0 ? (
            <EmptyState
              title="No Patients in Queue"
              description="Patients booking via WhatsApp or walking in to reception will appear here automatically, in arrival order."
              icon={Users}
            />
          ) : (
            <>
              {/* Degraded-but-usable: the queue is on screen from an earlier
                  fetch while live updates are down. Warn without hiding data. */}
              {error && (
                <div
                  role="status"
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="text-xs flex-1">{error}</span>
                  <button
                    onClick={refreshQueue}
                    className="text-xs font-bold underline underline-offset-2 hover:text-amber-100 focus-ring rounded"
                  >
                    Refresh
                  </button>
                </div>
              )}

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
            </>
          )}
        </div>

        <div className="space-y-6">
          <Panel padding="md">
            <SectionHeader icon={Calendar} title="Queue Summary" subtitle="Today's live snapshot" />
            {loading || billingLoading ? (
              <div className="grid grid-cols-2 gap-3 mt-4">
                {[0, 1, 2, 3].map((i) => (
                  <SkeletonStatTile key={i} />
                ))}
              </div>
            ) : (
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
            )}
          </Panel>

          <Panel padding="md">
            <SectionHeader icon={Bot} title="AI Activity" subtitle="Real-time decisions" />
            <div className="flex items-center gap-2 mt-3">
              <span
                className={
                  "w-1.5 h-1.5 rounded-full " +
                  (streamStatus === "connected"
                    ? "bg-teal-400 animate-pulse"
                    : streamStatus === "disconnected"
                    ? "bg-red-400"
                    : "bg-amber-400 animate-pulse")
                }
                aria-hidden="true"
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-subtle">
                {streamStatus === "connected"
                  ? "Live stream connected"
                  : streamStatus === "disconnected"
                  ? "Stream disconnected"
                  : "Connecting to stream"}
              </span>
            </div>
            {logsLoading ? (
              <SkeletonFeed className="mt-4" />
            ) : (
              <ActivityFeed items={activities} className="mt-4" emptyMessage={activityEmptyMessage} />
            )}
          </Panel>

          <Panel padding="md">
            <SectionHeader icon={Activity} title="AI Health" subtitle="Workforce telemetry" />
            {healthLoading && !platform ? (
              <div className="mt-4 space-y-2.5 animate-pulse" role="status" aria-label="Loading agent telemetry">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="h-3.5 w-24 bg-background-input/60 rounded" />
                    <div className="h-4 w-14 bg-background-input rounded" />
                  </div>
                ))}
              </div>
            ) : healthError && !platform ? (
              <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 space-y-2">
                <p className="text-xs text-amber-200 leading-relaxed">{healthError}</p>
                <button
                  onClick={refreshHealth}
                  className="text-xs font-bold text-amber-200 underline underline-offset-2 hover:text-amber-100 focus-ring rounded"
                >
                  Retry
                </button>
              </div>
            ) : (
            <div className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Agents Active</span>
                <Badge variant={agentsActiveVariant} dot>{agentsActiveLabel}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-border/50 pt-2.5">
                <span className="text-foreground-muted">Decisions Today</span>
                <span className="font-mono font-medium text-foreground tnum">{decisionsToday}</span>
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
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
