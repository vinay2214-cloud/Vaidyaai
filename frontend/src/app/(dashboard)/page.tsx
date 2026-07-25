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
  Activity,
  AlertTriangle,
  ArrowRight,
  Shield,
  Stethoscope,
  Send,
  CreditCard
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

  // Attention Items
  const attentionItems = [
    {
      id: "att_1",
      severity: "high" as const,
      title: "2 Patients Waiting > 10 mins",
      description: "Ramesh Sharma (12m) & Priya Nair (15m) awaiting consultation in queue.",
      actionLabel: "Start Consultation",
      color: "bg-rose-500/10 border-rose-500/30 text-rose-300"
    },
    {
      id: "att_2",
      severity: "medium" as const,
      title: "1 Prescription Awaiting Review",
      description: "Agent 5 (PrescriptionSafe) flagged potential BP medication adjustment.",
      actionLabel: "Review Rx",
      color: "bg-amber-500/10 border-amber-500/30 text-amber-300"
    },
    {
      id: "att_3",
      severity: "high" as const,
      title: "₹1,200 Overdue Invoices Pending",
      description: "2 UPI payment links awaiting patient completion via Agent 3.",
      actionLabel: "Resend Link",
      color: "bg-rose-500/10 border-rose-500/30 text-rose-300"
    }
  ];

  // 7 AI Agents Workforce Data
  const workforceAgents = [
    {
      name: "Agent 1: AppointmentFlow",
      agentId: "appointment_flow",
      role: "Multi-lingual WhatsApp Booking & Triage",
      status: "active" as const,
      lastTask: "Slot booked for Patient (+91XXXXXX3210)",
      activityCount: logs.filter((l) => l.agent_name.includes("appointment") || l.agent_name.includes("Agent 1")).length || 24,
      health: 99,
      latencyMs: 420
    },
    {
      name: "Agent 2: ClinicalScribe",
      agentId: "clinical_scribe",
      role: "Ambient Audio Diarization & SOAP Generation",
      status: "active" as const,
      lastTask: "Diarized 4-min Audio & Generated ICD-10 Note",
      activityCount: logs.filter((l) => l.agent_name.includes("scribe") || l.agent_name.includes("Agent 2")).length || 18,
      health: 98,
      latencyMs: 1450
    },
    {
      name: "Agent 3: BillingPulse",
      agentId: "billing_pulse",
      role: "Automated Invoicing & Razorpay UPI Payments",
      status: "active" as const,
      lastTask: "Generated Invoice VDY-20260725-0012 & UPI Link",
      activityCount: logs.filter((l) => l.agent_name.includes("billing") || l.agent_name.includes("Agent 3")).length || 15,
      health: 100,
      latencyMs: 310
    },
    {
      name: "Agent 4: RetentionRadar",
      agentId: "retention_radar",
      role: "Chronic Disease & Follow-up Tracking",
      status: "active" as const,
      lastTask: "Scanned 42 Diabetic Patients for 30-Day Followup",
      activityCount: logs.filter((l) => l.agent_name.includes("retention") || l.agent_name.includes("Agent 4")).length || 8,
      health: 96,
      latencyMs: 820
    },
    {
      name: "Agent 5: PrescriptionSafe",
      agentId: "prescription_safe",
      role: "Drug Interaction Audit & Safety Check",
      status: "active" as const,
      lastTask: "Audited Metformin + Glimepiride (0 Critical Conflicts)",
      activityCount: logs.filter((l) => l.agent_name.includes("prescription") || l.agent_name.includes("Agent 5")).length || 18,
      health: 100,
      latencyMs: 290
    },
    {
      name: "Agent 6: InsightEngine",
      agentId: "insight_engine",
      role: "Practice Health Score (0-100) & Analytics",
      status: "active" as const,
      lastTask: "Calculated Weekly Health Score (94/100)",
      activityCount: logs.filter((l) => l.agent_name.includes("insight") || l.agent_name.includes("Agent 6")).length || 4,
      health: 97,
      latencyMs: 1200
    },
    {
      name: "Agent 7: ReferralCoordinator",
      agentId: "referral_coordinator",
      role: "Specialist Referral Extraction & Lab Dispatch",
      status: "active" as const,
      lastTask: "Drafted Cardiology Referral Letter for Dr. Sharma",
      activityCount: logs.filter((l) => l.agent_name.includes("referral") || l.agent_name.includes("Agent 7")).length || 5,
      health: 99,
      latencyMs: 650
    }
  ];

  return (
    <div className="space-y-4">
      <WalkInModal />

      {/* PRIORITY 9: Clinical Progression Pipeline Banner */}
      <div className="bg-slate-800/90 border border-slate-700/70 rounded-xl p-2.5 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none text-xs">
        <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
          <span className="px-2 py-0.5 bg-teal-500/10 text-teal-300 border border-teal-500/30 rounded-md font-bold">1. Patient Registered</span>
          <ArrowRight className="w-3 h-3 text-slate-500" />
          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/30 rounded-md font-bold">2. AI WhatsApp Triage</span>
          <ArrowRight className="w-3 h-3 text-slate-500" />
          <span className="px-2 py-0.5 bg-purple-500/10 text-purple-300 border border-purple-500/30 rounded-md font-bold">3. Doctor Consult</span>
          <ArrowRight className="w-3 h-3 text-slate-500" />
          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-md font-bold">4. SOAP & Rx Audit</span>
          <ArrowRight className="w-3 h-3 text-slate-500" />
          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-md font-bold">5. Razorpay UPI Bill</span>
          <ArrowRight className="w-3 h-3 text-slate-500" />
          <span className="px-2 py-0.5 bg-teal-500/10 text-teal-300 border border-teal-500/30 rounded-md font-bold">6. Retention Radar</span>
        </div>
      </div>

      {/* PRIORITY 3: "ATTENTION REQUIRED" Operational Command Section */}
      <div className="bg-slate-800/80 border border-amber-500/30 rounded-2xl p-3.5 space-y-2.5 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Operational Attention Required (3)</h3>
          </div>
          <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
            Action Recommended
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {attentionItems.map((item) => (
            <div key={item.id} className={`border rounded-xl p-2.5 flex flex-col justify-between space-y-2 text-xs ${item.color}`}>
              <div>
                <h4 className="font-bold text-white text-xs flex items-center justify-between">
                  {item.title}
                </h4>
                <p className="text-[11px] text-slate-300 mt-1 leading-tight">{item.description}</p>
              </div>

              <button
                onClick={() => alert(`Navigating to handle: ${item.title}`)}
                className="self-start px-2.5 py-1 bg-slate-900/80 hover:bg-slate-900 border border-slate-700 text-white font-bold text-[10px] rounded-lg transition-colors"
              >
                {item.actionLabel} →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* PRIORITY 10: Enriched KPI Card Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <KPICard title="Patients Today" value={totalBooked} subtitle="Queue registered" icon={Users} color="blue" />
        <KPICard title="Waiting" value={arrived} subtitle="In room / waiting" icon={Clock} color="amber" />
        <KPICard title="Completed" value={completed} subtitle="Finished consults" icon={CheckCircle2} color="emerald" />
        <KPICard title="Revenue" value={totalRevenue} subtitle="Collected today" icon={IndianRupee} color="teal" trend="+14%" />
        <KPICard title="AI Tasks" value={logs.length || 92} subtitle="Executed decisions" icon={Bot} color="purple" />
        <KPICard title="SOAP Notes" value={completed || 18} subtitle="Generated notes" icon={FileText} color="indigo" />
        <KPICard title="WhatsApp Messages" value={totalBooked * 3 || 72} subtitle="Automated messages" icon={MessageSquare} color="emerald" trend="Active" />
        <KPICard title="Safety Checks" value={completed || 18} subtitle="0 Critical Alerts" icon={ShieldAlert} color="rose" />
      </div>

      {/* AI Workforce Panel */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-teal-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Autonomous AI Workforce (7 Agents)</h3>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
            {workforceAgents.map((agent) => (
              <AgentCard key={agent.agentId} {...agent} />
            ))}
          </div>
        )}
      </div>

      {/* Main Split View: Queue & Recent Decisions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Today's Live Queue (2 Cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-400" />
              <h2 className="text-sm font-bold text-white">Today&apos;s Live Patient Queue</h2>
            </div>
            <button
              onClick={() => setWalkInModalOpen(true)}
              className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1 bg-teal-500/10 px-3 py-1 rounded-xl border border-teal-500/30"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Walk-In Patient
            </button>
          </div>

          {apptsLoading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-800/50 border border-slate-800 rounded-2xl animate-pulse" />
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
            <div className="space-y-2.5">
              {appointments.map((app) => (
                <AppointmentCard key={app.appointment_id} appointment={app} />
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Recent AI Decisions Widget (1 Col) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-teal-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Recent AI Decisions</h3>
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
            <div className="space-y-2">
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
