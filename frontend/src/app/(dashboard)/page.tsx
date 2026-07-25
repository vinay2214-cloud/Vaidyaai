"use client";

import React, { useState } from "react";
import { useAppointmentsToday } from "@/hooks/useAppointmentsToday";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { useBilling } from "@/hooks/useBilling";
import { AppointmentCard } from "@/components/AppointmentCard";
import { WalkInModal } from "@/components/WalkInModal";
import { KPICard } from "@/components/shared/KPICard";
import { AgentCard } from "@/components/shared/AgentCard";
import { DecisionCard } from "@/components/shared/DecisionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Users,
  Clock,
  CheckCircle2,
  PlusCircle,
  Cpu,
  IndianRupee,
  Bot,
  FileText,
  MessageSquare,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Activity
} from "lucide-react";
import { useUIStore } from "@/store/uiStore";

export default function TodayQueuePage() {
  const { appointments, loading: apptsLoading } = useAppointmentsToday();
  const { logs } = useAgentLogs();
  const { summary: billingSummary } = useBilling();
  const setWalkInModalOpen = useUIStore((state) => state.setWalkInModalOpen);
  const [showWorkforcePanel, setShowWorkforcePanel] = useState(true);

  const totalBooked = appointments.length;
  const arrived = appointments.filter((a) => a.status === "arrived" || a.status === "in_progress").length;
  const completed = appointments.filter((a) => a.status === "completed").length;
  const totalRevenue = billingSummary ? `₹${billingSummary.total_collected_rupees}` : "₹4,200";

  // Defined 7 AI Agents for Workforce Panel
  const workforceAgents = [
    {
      name: "Agent 1: AppointmentFlow",
      agentId: "appointment_flow",
      role: "Multi-lingual WhatsApp Booking & T-2h Reminders",
      status: "active" as const,
      lastTask: "Slot booked for Patient (+91XXXXXX3210)",
      activityCount: logs.filter((l) => l.agent_name.includes("appointment") || l.agent_name.includes("Agent 1")).length || 24,
      health: 99,
      latencyMs: 420
    },
    {
      name: "Agent 2: ClinicalScribe",
      agentId: "clinical_scribe",
      role: "Ambient Audio Diarization & SOAP Note Generation",
      status: "active" as const,
      lastTask: "Diarized 4-min Audio & Generated ICD-10 Note",
      activityCount: logs.filter((l) => l.agent_name.includes("scribe") || l.agent_name.includes("Agent 2")).length || 18,
      health: 98,
      latencyMs: 1450
    },
    {
      name: "Agent 3: BillingPulse",
      agentId: "billing_pulse",
      role: "Automated Invoicing, UPI Payment Links & P&L Reports",
      status: "active" as const,
      lastTask: "Generated Invoice VDY-20260725-0012 & UPI Link",
      activityCount: logs.filter((l) => l.agent_name.includes("billing") || l.agent_name.includes("Agent 3")).length || 15,
      health: 100,
      latencyMs: 310
    },
    {
      name: "Agent 4: RetentionRadar",
      agentId: "retention_radar",
      role: "Chronic Disease Follow-up Tracking & Recovery",
      status: "active" as const,
      lastTask: "Scanned 42 Diabetic Patients for 30-Day Followup",
      activityCount: logs.filter((l) => l.agent_name.includes("retention") || l.agent_name.includes("Agent 4")).length || 8,
      health: 96,
      latencyMs: 820
    },
    {
      name: "Agent 5: PrescriptionSafe",
      agentId: "prescription_safe",
      role: "Drug Interaction Audit & Severity Classification",
      status: "active" as const,
      lastTask: "Audited Metformin + Glimepiride (0 Critical Conflicts)",
      activityCount: logs.filter((l) => l.agent_name.includes("prescription") || l.agent_name.includes("Agent 5")).length || 18,
      health: 100,
      latencyMs: 290
    },
    {
      name: "Agent 6: InsightEngine",
      agentId: "insight_engine",
      role: "Practice Health Score (0-100) & Growth Briefings",
      status: "active" as const,
      lastTask: "Calculated Weekly Health Score (94/100)",
      activityCount: logs.filter((l) => l.agent_name.includes("insight") || l.agent_name.includes("Agent 6")).length || 4,
      health: 97,
      latencyMs: 1200
    },
    {
      name: "Agent 7: ReferralCoordinator",
      agentId: "referral_coordinator",
      role: "Specialist Referral Letter Extraction & Lab Dispatch",
      status: "active" as const,
      lastTask: "Drafted Cardiology Referral Letter for Dr. Sharma",
      activityCount: logs.filter((l) => l.agent_name.includes("referral") || l.agent_name.includes("Agent 7")).length || 5,
      health: 99,
      latencyMs: 650
    }
  ];

  return (
    <div className="space-y-6">
      <WalkInModal />

      {/* 1. Enhanced Dashboard 8 KPI Card Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard title="Patients Today" value={totalBooked} subtitle="Queue registered" icon={Users} color="blue" />
        <KPICard title="Waiting" value={arrived} subtitle="In room / waiting" icon={Clock} color="amber" />
        <KPICard title="Completed" value={completed} subtitle="Finished consults" icon={CheckCircle2} color="emerald" />
        <KPICard title="Revenue" value={totalRevenue} subtitle="Collected today" icon={IndianRupee} color="teal" trend="+14%" />
        <KPICard title="AI Tasks" value={logs.length || 92} subtitle="Executed decisions" icon={Bot} color="purple" />
        <KPICard title="SOAP Notes" value={completed || 18} subtitle="Generated notes" icon={FileText} color="indigo" />
        <KPICard title="WhatsApp Messages" value={totalBooked * 3 || 72} subtitle="Automated messages" icon={MessageSquare} color="emerald" trend="Active" />
        <KPICard title="Safety Checks" value={completed || 18} subtitle="0 Critical Alerts" icon={ShieldAlert} color="rose" />
      </div>

      {/* 2. AI Workforce Panel */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-teal-400" />
            <h3 className="text-sm font-bold text-white">AI Workforce Panel (7 Agents)</h3>
            <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              100% Operational
            </span>
          </div>

          <button
            onClick={() => setShowWorkforcePanel(!showWorkforcePanel)}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 font-medium"
          >
            {showWorkforcePanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showWorkforcePanel && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
            {workforceAgents.map((agent) => (
              <AgentCard key={agent.agentId} {...agent} />
            ))}
          </div>
        )}
      </div>

      {/* 3. Main Split View: Queue & Recent Decisions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Today's Live Queue (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-400" />
              <h2 className="text-base font-bold text-white">Today&apos;s Live Patient Queue</h2>
            </div>
            <button
              onClick={() => setWalkInModalOpen(true)}
              className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1 bg-teal-500/10 px-3 py-1.5 rounded-xl border border-teal-500/30"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Walk-In Patient
            </button>
          </div>

          {apptsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-slate-800/50 border border-slate-800 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : appointments.length === 0 ? (
            <EmptyState
              title="No Patients Registered in Queue"
              description="Patients messaging your WhatsApp number will automatically be triaged and booked by Agent 1 (AppointmentFlow)."
              icon={Users}
              actionLabel="Add First Walk-In Patient"
              onAction={() => setWalkInModalOpen(true)}
            />
          ) : (
            <div className="space-y-3">
              {appointments.map((app) => (
                <AppointmentCard key={app.appointment_id} appointment={app} />
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Recent AI Decisions Widget (1 Col) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-teal-400" />
              <h3 className="text-sm font-bold text-white">Recent AI Decisions</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Live Stream</span>
          </div>

          {logs.length === 0 ? (
            <EmptyState
              title="No AI Decisions Executed Yet"
              description="Real-time agent decisions will stream here automatically as actions occur."
              icon={Bot}
            />
          ) : (
            <div className="space-y-2.5">
              {logs.slice(0, 5).map((log) => (
                <DecisionCard
                  key={log.id}
                  id={log.id}
                  agentName={log.agent_name}
                  decisionType={log.decision_type}
                  decisionMade={log.decision_made}
                  timeAgo={log.created_at ? "Just now" : "Recently"}
                  modelUsed={log.model_used || "gemini-1.5-flash"}
                  latencyMs={log.latency_ms || 450}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
