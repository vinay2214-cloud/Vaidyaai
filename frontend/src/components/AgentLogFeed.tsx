"use client";

import React from "react";
import { AgentLog } from "@/hooks/useAgentLogs";
import { DecisionTimeline } from "./timeline/DecisionTimeline";

export function AgentLogFeed({ logs, loading }: { logs: AgentLog[]; loading: boolean }) {
  // Convert AgentLog to DecisionEntry LogData structure
  const formattedLogs = logs.map((l) => ({
    id: l.id,
    agent_name: l.agent_name,
    decision_type: l.decision_type,
    decision_made: l.decision_made,
    clinic_id: l.clinic_id,
    input_summary: l.input_summary,
    output_summary: l.output_summary,
    model_used: l.model_used || "—",
    latency_ms: l.latency_ms || 0,
    patient_phone_masked: l.patient_phone_masked,
    success: l.success !== false,
    created_at: l.created_at
  }));

  return <DecisionTimeline logs={formattedLogs} loading={loading} />;
}
