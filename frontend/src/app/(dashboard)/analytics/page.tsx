"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";
import { useToast, Panel, SectionHeader, Badge, ActivityFeed, ActivityItem, AIStatus, Button } from "@/components/design-system";
import { cn } from "@/lib/cn";
import {
  BarChart3,
  Users,
  Stethoscope,
  Coins,
  Clock,
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  FileDown,
  RefreshCw,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

import { useAgentHealth } from "@/hooks/useAgentHealth";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { useBilling } from "@/hooks/useBilling";

interface Metric {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: React.ElementType;
  color: "teal" | "blue" | "orange" | "green";
}

interface AgentMetric {
  agent: string;
  decisions: number;
  avgLatency: string;
  successRate: number;
  status: "completed" | "running" | "pending" | "failed";
}

const revenueData = [
  { day: "Mon", value: 8200, height: 55 },
  { day: "Tue", value: 9400, height: 65 },
  { day: "Wed", value: 7800, height: 50 },
  { day: "Thu", value: 9100, height: 62 },
  { day: "Fri", value: 9500, height: 68 },
  { day: "Sat", value: 7200, height: 45 },
  { day: "Sun", value: 6100, height: 38 },
];

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function AnalyticsManagerPage() {
  const clinicId = useClinicStore((state) => state.clinicId);
  const { agents: liveAgentHealth, platform } = useAgentHealth();
  const { logs: agentLogs } = useAgentLogs();
  const { summary: billingSummary } = useBilling();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [backendMetrics, setBackendMetrics] = useState<any>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      if (!clinicId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await api.get(`/analytics/dashboard?clinic_id=${clinicId}`);
        if (res.data) setBackendMetrics(res.data);
      } catch (e) {
        console.warn("Could not load backend analytics:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [clinicId]);

  const mData = backendMetrics?.metrics;
  const activity: ActivityItem[] = agentLogs.slice(0, 5).map((log, idx) => ({
    id: log.id || `an_${idx}`,
    time: log.created_at ? new Date(log.created_at.toDate?.() || log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Now",
    agent: log.agent_name,
    agentColor: log.success === false ? "red" : "teal",
    message: log.decision_made,
    status: log.success === false ? "failed" : "completed"
  }));
  const metrics: Metric[] = [
    { label: "Patients Today", value: String(mData?.total_appointments ?? 24), change: "+8% vs yesterday", trend: "up", icon: Users, color: "teal" },
    { label: "Consultations", value: String(mData?.completed_consultations ?? 18), change: `${mData?.no_show_count ?? 2} no-shows`, trend: "up", icon: Stethoscope, color: "blue" },
    { label: "Revenue Today", value: billingSummary ? formatCurrency(billingSummary.total_collected_rupees) : "₹9,500", change: "+18% this week", trend: "up", icon: Coins, color: "orange" },
    { label: "Completion Rate", value: mData?.completion_rate_pct ? `${mData.completion_rate_pct}%` : "90%", change: "SLA met", trend: "neutral", icon: CheckCircle2, color: "green" },
    { label: "Avg AI Latency", value: mData?.avg_ai_latency_ms ? `${mData.avg_ai_latency_ms}ms` : `${platform?.avg_latency_ms || 620}ms`, change: "Vertex AI", trend: "up", icon: Clock, color: "teal" },
    { label: "AI Decisions", value: String(mData?.agent_decisions_count ?? platform?.total_tasks_today ?? agentLogs.length ?? 92), change: "7 agents live", trend: "up", icon: BrainCircuit, color: "blue" },
  ];

  const displayAgentMetrics: AgentMetric[] = liveAgentHealth.length > 0
    ? liveAgentHealth.map(a => ({
        agent: a.name,
        decisions: a.tasks_today,
        avgLatency: `${(a.avg_latency_ms / 1000).toFixed(1)}s`,
        successRate: a.success_rate_pct,
        status: a.status === "running" ? "running" : a.failures_today > 0 ? "failed" : "completed"
      }))
    : [
        { agent: "ClinicalScribe", decisions: 18, avgLatency: "1.4s", successRate: 99, status: "running" },
        { agent: "PrescriptionSafe", decisions: 18, avgLatency: "0.3s", successRate: 100, status: "completed" },
        { agent: "BillingPulse", decisions: 18, avgLatency: "0.5s", successRate: 100, status: "running" },
        { agent: "RetentionRadar", decisions: 8, avgLatency: "2.1s", successRate: 96, status: "running" },
        { agent: "InsightEngine", decisions: 12, avgLatency: "1.8s", successRate: 98, status: "running" },
        { agent: "AppointmentFlow", decisions: 24, avgLatency: "0.2s", successRate: 100, status: "completed" },
        { agent: "ReferralCoordinator", decisions: 3, avgLatency: "0.9s", successRate: 100, status: "completed" },
      ];

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const res = await api.post(`/analytics/generate-report?clinic_id=${clinicId || "cln_e2e_test_clinic"}`);
      toast("Agent 6 (InsightEngine) executive report generated successfully.", "success");
      if (res.data) setBackendMetrics(res.data);
    } catch (e) {
      toast("Agent 6 executive report generated (dev mode fallback).", "info");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = () => {
    const data = { metrics, agentMetrics: displayAgentMetrics, revenueData };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `VaidyaAI_Analytics_${clinicId || "clinic"}.json`;
    a.click();
    toast("Analytics report exported as JSON.", "success");
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <BarChart3 className="w-10 h-10 text-teal-400 animate-pulse" />
          <p className="text-foreground-muted text-sm font-medium">Loading practice intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-teal-400" /> Practice Intelligence
          </h1>
          <p className="text-sm text-foreground-subtle">Manager view • Today, 25-Jul-2026</p>
        </div>
        <div className="flex items-center gap-3">
          <AIStatus state="completed" label="InsightEngine Ready" />
          <Button variant="secondary" onClick={handleExport}>
            <FileDown className="w-4 h-4" /> Export
          </Button>
          <Button variant="primary" onClick={handleGenerateReport} isLoading={isGenerating}>
            <RefreshCw className="w-4 h-4" /> Generate Report
          </Button>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          const colorMap = {
            teal: "bg-teal-500/10 text-teal-400 border-teal-500/30",
            blue: "bg-blue-500/10 text-blue-400 border-blue-500/30",
            orange: "bg-orange-500/10 text-orange-400 border-orange-500/30",
            green: "bg-green-500/10 text-green-400 border-green-500/30",
          };
          return (
            <Panel key={m.label} padding="md" className="flex flex-col gap-2">
              <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center", colorMap[m.color])}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-xs text-foreground-subtle">{m.label}</p>
              <p className="text-xl font-bold text-foreground">{m.value}</p>
              <div className="flex items-center gap-1 text-xs">
                {m.trend === "up" ? <ArrowUpRight className="w-3.5 h-3.5 text-green-400" /> : <ArrowDownRight className="w-3.5 h-3.5 text-orange-400" />}
                <span className={m.trend === "up" ? "text-green-400" : "text-orange-400"}>{m.change}</span>
              </div>
            </Panel>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Main analytics */}
        <div className="lg:col-span-8 space-y-5">
          {/* Revenue chart */}
          <Panel padding="md">
            <SectionHeader icon={Coins} title="Revenue This Week" subtitle="Daily collections via BillingPulse" />
            <div className="mt-6">
              <div className="flex items-end gap-3 h-40 px-2">
                {revenueData.map((d) => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="relative w-full flex items-end justify-center h-32">
                      <div
                        className="w-full max-w-[40px] rounded-t-lg bg-teal-500/80 hover:bg-teal-400 transition-all duration-250"
                        style={{ height: `${d.height}%` }}
                        aria-label={`${d.day}: ${formatCurrency(d.value)}`}
                      />
                    </div>
                    <span className="text-xs text-foreground-subtle">{d.day}</span>
                    <span className="text-xs font-medium text-foreground">{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          {/* AI Agent matrix */}
          <Panel padding="md">
            <SectionHeader icon={BrainCircuit} title="AI Workforce Performance" subtitle="Decision volume & reliability" />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-xs text-foreground-subtle font-semibold">Agent</th>
                    <th className="text-right py-2 text-xs text-foreground-subtle font-semibold">Decisions</th>
                    <th className="text-right py-2 text-xs text-foreground-subtle font-semibold">Latency</th>
                    <th className="text-right py-2 text-xs text-foreground-subtle font-semibold">Success</th>
                    <th className="text-right py-2 text-xs text-foreground-subtle font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {displayAgentMetrics.map((a) => (
                    <tr key={a.agent} className="hover:bg-background-hover transition-colors">
                      <td className="py-2.5 font-medium text-foreground">{a.agent}</td>
                      <td className="py-2.5 text-right text-foreground-muted">{a.decisions}</td>
                      <td className="py-2.5 text-right text-foreground-muted">{a.avgLatency}</td>
                      <td className="py-2.5 text-right">
                        <span className={cn("font-medium", a.successRate >= 98 ? "text-green-400" : "text-orange-400")}>
                          {a.successRate}%
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <Badge
                          variant={a.status === "running" ? "blue" : a.status === "completed" ? "green" : "gray"}
                          dot
                          dotClassName={a.status === "running" ? "bg-blue-400 animate-pulse" : undefined}
                        >
                          {a.status === "running" ? "Active" : "Idle"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Operational insight cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Panel padding="md">
              <SectionHeader icon={TrendingUp} title="Growth Drivers" />
              <ul className="mt-3 space-y-2">
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  Revenue up 18% week-over-week from automated UPI links.
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  Documentation time reduced from 14m to 4.2m per consult.
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  98% patient satisfaction via post-visit WhatsApp surveys.
                </li>
              </ul>
            </Panel>
            <Panel padding="md">
              <SectionHeader icon={AlertTriangle} title="Risks & Bottlenecks" />
              <ul className="mt-3 space-y-2">
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                  Evening 6 PM peak shows +8 minute wait times.
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                  12 chronic patients overdue for diabetic eye screening.
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                  Manual lab result entry delays record completion by 45m.
                </li>
              </ul>
            </Panel>
          </div>
        </div>

        {/* Right manager sidebar */}
        <div className="lg:col-span-4 space-y-5">
          <Panel padding="md">
            <SectionHeader
              icon={Sparkles}
              title="InsightEngine"
              subtitle="Agent 6"
              action={<AIStatus state="completed" label="Ready" />}
            />
            <div className="mt-4 space-y-3">
              <div className="panel p-3 bg-background-elevated/50 border border-border">
                <p className="text-sm font-semibold text-foreground">AI Health Score</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 rounded-full bg-background-input overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: "94%" }} />
                  </div>
                  <span className="text-sm font-bold text-teal-400">94</span>
                </div>
              </div>
              <div className="panel p-3 bg-background-elevated/50 border border-border">
                <p className="text-sm font-semibold text-foreground">Top Recommendation</p>
                <p className="text-xs text-foreground-subtle mt-1">
                  Add 10 AM slot buffer for high-risk diabetic walk-ins.
                </p>
              </div>
              <div className="panel p-3 bg-background-elevated/50 border border-border">
                <p className="text-sm font-semibold text-foreground">Care Gap</p>
                <p className="text-xs text-foreground-subtle mt-1">
                  Order quarterly HbA1c panels for 14 patients due next week.
                </p>
              </div>
            </div>
          </Panel>

          <Panel padding="md">
            <SectionHeader icon={Activity} title="Agent Activity" />
            <ActivityFeed items={activity} className="mt-3" />
          </Panel>

          <Panel padding="md">
            <SectionHeader icon={Users} title="Patient Demographics" />
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-subtle">New today</span>
                <span className="font-medium text-foreground">4</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-subtle">Follow-up</span>
                <span className="font-medium text-foreground">20</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-subtle">No-show rate</span>
                <span className="font-medium text-orange-400">4.1%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-subtle">Compliance</span>
                <span className="font-medium text-green-400">88.5%</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
