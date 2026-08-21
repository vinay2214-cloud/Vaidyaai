"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { apiErrorMessage } from "@/lib/errors";
import { useClinicStore } from "@/store/clinicStore";
import {
  useToast,
  Panel,
  SectionHeader,
  Badge,
  ActivityFeed,
  ActivityItem,
  AIStatus,
  Button,
  SkeletonStatTile,
  SkeletonChart,
} from "@/components/design-system";
import { ErrorState } from "@/components/shared/ErrorState";
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

function formatCurrency(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(n) || !isFinite(n)) return "₹0.00";
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function AnalyticsManagerPage() {
  const clinicId = useClinicStore((state) => state.clinicId);
  const { agents: liveAgentHealth, platform } = useAgentHealth();
  const { logs: agentLogs } = useAgentLogs();
  const { summary: billingSummary } = useBilling();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [backendMetrics, setBackendMetrics] = useState<any>(null);

  const fetchAnalytics = React.useCallback(async () => {
    if (!clinicId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/analytics/dashboard?clinic_id=${clinicId}`);
      if (res.data) setBackendMetrics(res.data);
    } catch (e: any) {
      console.warn("Could not load backend analytics:", e);
      setError(apiErrorMessage(e, "load practice analytics"));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const mData = backendMetrics?.metrics;
  const activity: ActivityItem[] = (agentLogs || []).slice(0, 5).map((log, idx) => ({
    id: log.id || `an_${idx}`,
    time: log.created_at ? new Date(log.created_at.toDate?.() || log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Now",
    agent: log.agent_name,
    agentColor: log.success === false ? "red" : "teal",
    message: log.decision_made,
    status: log.success === false ? "failed" : "completed"
  }));

  const noShowRatePct = React.useMemo(() => {
    if (!mData?.total_appointments || mData.total_appointments === 0) return "0.0%";
    const val = ((mData.no_show_count || 0) / mData.total_appointments) * 100;
    return isNaN(val) || !isFinite(val) ? "0.0%" : `${val.toFixed(1)}%`;
  }, [mData]);

  const metrics: Metric[] = [
    { label: "Patients Today", value: mData?.total_appointments !== undefined ? String(mData.total_appointments) : "0", change: "Live queue", trend: "neutral", icon: Users, color: "teal" },
    { label: "Consultations", value: mData?.completed_consultations !== undefined ? String(mData.completed_consultations) : "0", change: `${mData?.no_show_count ?? 0} no-shows`, trend: "neutral", icon: Stethoscope, color: "blue" },
    { label: "Revenue Today", value: billingSummary ? formatCurrency(billingSummary.total_collected_rupees) : "₹0.00", change: "Live collections", trend: "neutral", icon: Coins, color: "orange" },
    { label: "Completion Rate", value: mData?.completion_rate_pct !== undefined ? `${mData.completion_rate_pct}%` : "0%", change: "Live SLA", trend: "neutral", icon: CheckCircle2, color: "green" },
    { label: "Avg AI Latency", value: mData?.avg_ai_latency_ms !== undefined && mData.avg_ai_latency_ms > 0 ? `${mData.avg_ai_latency_ms}ms` : platform?.avg_latency_ms ? `${platform.avg_latency_ms}ms` : "No Data Available", change: "Vertex AI", trend: "neutral", icon: Clock, color: "teal" },
    { label: "AI Decisions", value: String(mData?.agent_decisions_count ?? platform?.total_tasks_today ?? agentLogs?.length ?? 0), change: "7 agents live", trend: "neutral", icon: BrainCircuit, color: "blue" },
  ];

  const displayAgentMetrics: AgentMetric[] = liveAgentHealth.map(a => ({
    agent: a.name,
    decisions: a.tasks_today,
    // Unrecorded latency must read as unknown, not as an implausible 0s.
    avgLatency: a.avg_latency_ms ? `${(a.avg_latency_ms / 1000).toFixed(1)}s` : "—",
    successRate: a.success_rate_pct,
    status: a.status === "running" ? "running" : a.failures_today > 0 ? "failed" : "completed"
  }));

  const revenueData = React.useMemo(() => {
    const upi = billingSummary?.upi_collected_rupees || 0;
    const cash = billingSummary?.cash_collected_rupees || 0;
    const total = billingSummary?.total_collected_rupees || 0;
    const maxVal = Math.max(total, 1000);
    return [
      { day: "Cash", value: cash, height: Math.max(10, Math.round((cash / maxVal) * 100)) },
      { day: "UPI", value: upi, height: Math.max(10, Math.round((upi / maxVal) * 100)) },
      { day: "Total", value: total, height: Math.max(10, Math.round((total / maxVal) * 100)) },
    ];
  }, [billingSummary]);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const res = await api.post(`/analytics/generate-report?clinic_id=${clinicId}`);
      toast("InsightEngine executive report generated successfully.", "success");
      if (res.data) setBackendMetrics(res.data);
    } catch (e) {
      toast(apiErrorMessage(e, "generate the practice report"), "error", "ai");
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

  if (loading && !backendMetrics) {
    return (
      <div className="space-y-5" role="status" aria-label="Loading practice intelligence">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse">
          <div className="space-y-2">
            <div className="h-6 w-64 bg-background-input rounded" />
            <div className="h-4 w-48 bg-background-input/50 rounded" />
          </div>
          <div className="h-9 w-40 bg-background-input/60 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonStatTile key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      </div>
    );
  }

  // The error was previously tracked in state but never rendered, so a failed
  // analytics sync showed an empty dashboard indistinguishable from a quiet day.
  if (error && !backendMetrics) {
    return (
      <div className="py-10">
        <ErrorState
          title="Unable to Load Practice Analytics"
          description={error}
          onRetry={fetchAnalytics}
        />
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
          <p className="text-sm text-foreground-subtle">Manager view • {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
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
                  {billingSummary?.total_collected_rupees ? `₹${billingSummary.total_collected_rupees.toLocaleString('en-IN')} revenue collected today via BillingPulse.` : "No revenue collected yet today."}
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  {mData?.completed_consultations ? `${mData.completed_consultations} consultations signed and processed by ClinicalScribe.` : "0 consultations completed today."}
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  {platform?.total_tasks_today ? `${platform.total_tasks_today} autonomous agent decisions logged with ${platform.health_pct}% platform health.` : "No agent decisions logged today."}
                </li>
              </ul>
            </Panel>
            <Panel padding="md">
              <SectionHeader icon={AlertTriangle} title="Risks & Bottlenecks" />
              <ul className="mt-3 space-y-2">
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                  {mData?.no_show_count ? `${mData.no_show_count} patient no-shows detected today requiring RetentionRadar outreach.` : "Zero patient no-shows recorded today."}
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                  {billingSummary?.pending_rupees ? `₹${billingSummary.pending_rupees.toLocaleString('en-IN')} pending uncollected invoice balance.` : "Zero uncollected invoice balance today."}
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                  {platform?.total_failures_today ? `${platform.total_failures_today} agent execution failures today.` : "Zero agent failures detected across workforce."}
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
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${backendMetrics?.health_score ?? platform?.health_pct ?? 0}%` }} />
                  </div>
                  <span className="text-sm font-bold text-teal-400">{backendMetrics?.health_score ?? platform?.health_pct ?? 0}%</span>
                </div>
              </div>
              <div className="panel p-3 bg-background-elevated/50 border border-border">
                <p className="text-sm font-semibold text-foreground">Top Recommendation</p>
                <p className="text-xs text-foreground-subtle mt-1">
                  {backendMetrics?.metrics?.completion_rate_pct ? `Maintain SLA level (${backendMetrics.metrics.completion_rate_pct}% completion rate).` : "Awaiting clinical activity data."}
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
                <span className="text-foreground-subtle">Total Today</span>
                <span className="font-medium text-foreground">{mData?.total_appointments ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-subtle">Completed</span>
                <span className="font-medium text-foreground">{mData?.completed_consultations ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-subtle">No-show rate</span>
                <span className="font-medium text-foreground">{noShowRatePct}</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
