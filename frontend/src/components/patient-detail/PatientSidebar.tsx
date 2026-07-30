"use client";

import React from "react";
import { Panel, SectionHeader, ActivityFeed, ActivityItem, AIStatus } from "@/components/design-system";
import { Cpu, Bot, Activity } from "lucide-react";

export const PatientSidebar: React.FC = () => {
  const decisions: ActivityItem[] = [
    {
      id: "dec_1",
      time: "10:20",
      agent: "ClinicalScribe",
      agentColor: "teal",
      message: "Generated SOAP note & ICD-10 diagnoses for Type-2 Diabetes consult.",
      status: "completed",
      details: "gemini-1.5-pro • 1450ms",
    },
    {
      id: "dec_2",
      time: "10:22",
      agent: "PrescriptionSafe",
      agentColor: "red",
      message: "Audited prescription regimen: Metformin 500mg (0 conflicts).",
      status: "completed",
      details: "gemini-1.5-flash • 290ms",
    },
    {
      id: "dec_3",
      time: "10:23",
      agent: "InsightEngine",
      agentColor: "teal",
      message: "Updated longitudinal summary & flagged care gaps.",
      status: "completed",
      details: "gemini-1.5-pro • 1200ms",
    },
    {
      id: "dec_4",
      time: "10:25",
      agent: "RetentionRadar",
      agentColor: "orange",
      message: "Scheduled 30-day follow-up outreach.",
      status: "running",
      details: "WhatsApp Cloud API • English / Hindi",
    },
  ];

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
        <ActivityFeed items={decisions} className="mt-4" />
      </Panel>

      <Panel padding="md">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-teal-400" />
          <span className="text-sm font-semibold text-foreground">AI Health</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground-muted">Agents Active</span>
            <span className="font-mono text-green-400">7/7</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground-muted">Decisions Today</span>
            <span className="font-mono text-foreground">24</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground-muted">Avg Latency</span>
            <span className="font-mono text-foreground">620ms</span>
          </div>
        </div>
      </Panel>
    </aside>
  );
};
