"use client";

import React, { useEffect, useState } from "react";
import { useClinicStore } from "@/store/clinicStore";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { useAgentHealth } from "@/hooks/useAgentHealth";
import { useToast, Panel, SectionHeader, Badge, ActivityFeed, ActivityItem, AIStatus, Button } from "@/components/design-system";
import { cn } from "@/lib/cn";
import {
  Settings,
  Cpu,
  Shield,
  Link,
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  Lock,
  Bell,
  FileText,
  Save,
  Sparkles,
  Database,
  Smartphone,
  CreditCard,
} from "lucide-react";

interface Integration {
  id: string;
  name: string;
  provider: string;
  status: "connected" | "disconnected" | "warning";
  lastSync: string;
  icon: React.ElementType;
}

const integrations: Integration[] = [
  { id: "whatsapp", name: "WhatsApp Cloud API", provider: "Meta", status: "connected", lastSync: "Just now", icon: Smartphone },
  { id: "razorpay", name: "Razorpay UPI", provider: "Razorpay", status: "connected", lastSync: "2 mins ago", icon: CreditCard },
  { id: "firebase", name: "Firebase Auth", provider: "Google", status: "connected", lastSync: "Live", icon: Shield },
  { id: "vertex", name: "Vertex AI", provider: "Google Cloud", status: "connected", lastSync: "Just now", icon: Cpu },
  { id: "firestore", name: "Cloud Firestore", provider: "Google Cloud", status: "connected", lastSync: "Live", icon: Database },
];

const auditEvents = [
  { id: "aud_1", event: "Login", actor: "Dr. Vinay Sharma", time: "Today, 08:30 AM", severity: "info" as const },
  { id: "aud_2", event: "Config Change", actor: "System Administrator", time: "Yesterday, 06:15 PM", severity: "info" as const },
  { id: "aud_3", event: "AI Audit", actor: "PrescriptionSafe", time: "Today, 10:22 AM", severity: "info" as const },
  { id: "aud_4", event: "Payment Reconciled", actor: "BillingPulse", time: "Today, 10:40 AM", severity: "success" as const },
];

export default function SettingsOperationsPage() {
  const clinicId = useClinicStore((state) => state.clinicId);
  const { logs, loading: logsLoading } = useAgentLogs();
  const { agents, platform, loading: healthLoading, refresh: refreshHealth } = useAgentHealth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"agents" | "integrations" | "audit" | "general">("agents");
  const [autoReminder, setAutoReminder] = useState(true);
  const [twoFactor, setTwoFactor] = useState(true);
  const [eodReport, setEodReport] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const activity: ActivityItem[] = logs.slice(0, 5).map((log) => ({
    id: log.id,
    time: log.created_at?.toDate?.().toLocaleTimeString?.([], { hour: "2-digit", minute: "2-digit" }) || "Now",
    agent: log.agent_name,
    agentColor: log.success === false ? "red" : "teal",
    message: log.decision_made,
    status: log.success === false ? "failed" : "completed",
    details: log.model_used ? `${log.model_used} • ${log.latency_ms}ms` : undefined,
  }));

  const handleSave = () => {
    toast("Operations settings saved successfully.", "success");
  };

  const handleRefresh = () => {
    refreshHealth();
    toast("Refreshing system status...", "info");
  };

  if (loading || logsLoading || healthLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Settings className="w-10 h-10 text-teal-400 animate-pulse" />
          <p className="text-foreground-muted text-sm font-medium">Loading Operations Center...</p>
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
            <Settings className="w-6 h-6 text-teal-400" /> Operations Center
          </h1>
          <p className="text-sm text-foreground-subtle">Clinic configuration, agent workforce, and security audit</p>
        </div>
        <div className="flex items-center gap-3">
          <AIStatus state="completed" label="Platform Healthy" />
          <Button variant="secondary" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* Health summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Panel padding="sm" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <Activity className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-xs text-foreground-subtle">Platform Health</p>
            <p className="text-lg font-bold text-foreground">{platform ? `${platform.health_pct}%` : "--"}</p>
          </div>
        </Panel>
        <Panel padding="sm" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <Clock className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-foreground-subtle">Avg Latency</p>
            <p className="text-lg font-bold text-foreground">{platform ? `${platform.avg_latency_ms}ms` : "--"}</p>
          </div>
        </Panel>
        <Panel padding="sm" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <p className="text-xs text-foreground-subtle">Active Agents</p>
            <p className="text-lg font-bold text-foreground">{platform ? `${platform.active_agents}/${platform.total_agents}` : "--/--"}</p>
          </div>
        </Panel>
        <Panel padding="sm" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <p className="text-xs text-foreground-subtle">Failures Today</p>
            <p className="text-lg font-bold text-foreground">{platform ? platform.total_failures_today : 0}</p>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Tabs + content */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
            {([
              { id: "agents", label: "AI Agents", icon: Cpu },
              { id: "integrations", label: "Integrations", icon: Link },
              { id: "audit", label: "Audit Trail", icon: FileText },
              { id: "general", label: "General", icon: Settings },
            ] as const).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all focus-ring",
                    isActive ? "bg-teal-500 text-background" : "text-foreground-subtle hover:text-foreground hover:bg-background-elevated"
                  )}
                >
                  <Icon className="w-4 h-4" /> {tab.label}
                </button>
              );
            })}
          </div>

          <Panel padding="md">
            {activeTab === "agents" && (
              <div className="space-y-4">
                <SectionHeader icon={Cpu} title="Autonomous Agent Workforce" subtitle="7 agents • All systems operational" />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-xs text-foreground-subtle font-semibold">Agent</th>
                        <th className="text-left py-2 text-xs text-foreground-subtle font-semibold">Model</th>
                        <th className="text-right py-2 text-xs text-foreground-subtle font-semibold">Tasks</th>
                        <th className="text-right py-2 text-xs text-foreground-subtle font-semibold">Latency</th>
                        <th className="text-right py-2 text-xs text-foreground-subtle font-semibold">Success</th>
                        <th className="text-right py-2 text-xs text-foreground-subtle font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {agents.map((agent) => (
                        <tr key={agent.id} className="hover:bg-background-hover transition-colors">
                          <td className="py-3">
                            <p className="font-medium text-foreground">{agent.name}</p>
                            <p className="text-xs text-foreground-subtle">{agent.role}</p>
                          </td>
                          <td className="py-3 text-foreground-muted font-mono text-xs">{agent.model}</td>
                          <td className="py-3 text-right text-foreground">{agent.tasks_today}</td>
                          <td className="py-3 text-right text-foreground-muted">{agent.avg_latency_ms}ms</td>
                          <td className="py-3 text-right">
                            <span className={cn("font-medium", agent.success_rate_pct >= 98 ? "text-green-400" : "text-orange-400")}>
                              {agent.success_rate_pct}%
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <Badge variant={agent.status === "active" ? "green" : agent.status === "paused" ? "orange" : "red"} dot>
                              {agent.status === "active" ? "Active" : agent.status === "paused" ? "Paused" : "Error"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "integrations" && (
              <div className="space-y-4">
                <SectionHeader icon={Link} title="Connected Integrations" subtitle="Live third-party services" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {integrations.map((integration) => {
                    const Icon = integration.icon;
                    return (
                      <div key={integration.id} className="panel p-4 bg-background-elevated/50 border border-border flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-background-input border border-border flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-teal-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-foreground truncate">{integration.name}</p>
                            <Badge variant={integration.status === "connected" ? "green" : integration.status === "warning" ? "orange" : "red"} dot>
                              {integration.status === "connected" ? "Connected" : integration.status === "warning" ? "Warning" : "Disconnected"}
                            </Badge>
                          </div>
                          <p className="text-xs text-foreground-subtle mt-1">{integration.provider}</p>
                          <p className="text-xs text-foreground-subtle">Last sync: {integration.lastSync}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "audit" && (
              <div className="space-y-4">
                <SectionHeader icon={FileText} title="Security & Audit Trail" />
                <div className="space-y-2">
                  {logs.slice(0, 10).map((log) => (
                    <div
                      key={log.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border",
                        log.success !== false ? "bg-green-500/5 border-green-500/20" : "bg-background-elevated/50 border-border"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {log.success !== false ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : (
                          <Shield className="w-4 h-4 text-orange-400" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-foreground">{log.decision_made}</p>
                          <p className="text-xs text-foreground-subtle">{log.agent_name} • {log.created_at?.toDate?.().toLocaleString() || "Today"}</p>
                        </div>
                      </div>
                      <Badge variant={log.success !== false ? "green" : "blue"}>{log.success !== false ? "success" : "failed"}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "general" && (
              <div className="space-y-4">
                <SectionHeader icon={Settings} title="General Operations" subtitle="Clinic preferences" />
                <div className="space-y-3">
                  <ToggleRow
                    icon={Bell}
                    label="Automated WhatsApp follow-up reminders"
                    description="Send RetentionRadar reminders for missed follow-ups"
                    checked={autoReminder}
                    onChange={setAutoReminder}
                  />
                  <ToggleRow
                    icon={Lock}
                    label="Require multi-factor authentication"
                    description="Enforce MFA for all clinic staff logins"
                    checked={twoFactor}
                    onChange={setTwoFactor}
                  />
                  <ToggleRow
                    icon={FileText}
                    label="Daily 9 PM EOD report"
                    description="Email executive summary to clinic manager"
                    checked={eodReport}
                    onChange={setEodReport}
                  />
                </div>
                <div className="pt-4 border-t border-border flex justify-end">
                  <Button variant="primary" onClick={handleSave}>
                    <Save className="w-4 h-4" /> Save Settings
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        </div>

        {/* Right sidebar */}
        <div className="lg:col-span-4 space-y-5">
          <Panel padding="md">
            <SectionHeader
              icon={Sparkles}
              title="System Intelligence"
              subtitle="InsightEngine"
              action={<AIStatus state="completed" label="Nominal" />}
            />
            <div className="mt-4 space-y-3">
              <div className="panel p-3 bg-background-elevated/50 border border-border">
                <p className="text-sm font-semibold text-foreground">Capacity</p>
                <p className="text-xs text-foreground-subtle mt-1">Vertex AI quota at 14%. Cloud SQL CPU at 8%. Can handle 10x spike.</p>
              </div>
              <div className="panel p-3 bg-background-elevated/50 border border-border">
                <p className="text-sm font-semibold text-foreground">Recommendation</p>
                <p className="text-xs text-foreground-subtle mt-1">Keep gemini-1.5-flash for triage; gemini-1.5-pro for scribe tasks.</p>
              </div>
              <div className="panel p-3 bg-background-elevated/50 border border-border">
                <p className="text-sm font-semibold text-foreground">Risk</p>
                <p className="text-xs text-foreground-subtle mt-1">Monitor WhatsApp API rate limits during 10 AM surge.</p>
              </div>
            </div>
          </Panel>

          <Panel padding="md">
            <SectionHeader icon={Users} title="Clinic Staff" />
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-subtle">Doctors</span>
                <span className="font-medium text-foreground">2</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-subtle">Managers</span>
                <span className="font-medium text-foreground">1</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-subtle">Reception</span>
                <span className="font-medium text-foreground">2</span>
              </div>
            </div>
          </Panel>

          <Panel padding="md">
            <SectionHeader icon={Activity} title="Live Agent Decisions" />
            <ActivityFeed items={activity} className="mt-3" emptyMessage="No agent decisions today" />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-background-elevated/50 border border-border">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-background-input border border-border flex items-center justify-center">
          <Icon className="w-4 h-4 text-teal-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-foreground-subtle">{description}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-11 h-6 rounded-full transition-colors focus-ring",
          checked ? "bg-teal-500" : "bg-background-input border border-border"
        )}
        aria-checked={checked}
        role="switch"
      >
        <span
          className={cn(
            "absolute top-1 left-1 w-4 h-4 rounded-full bg-background transition-transform",
            checked && "translate-x-5"
          )}
        />
      </button>
    </div>
  );
}
