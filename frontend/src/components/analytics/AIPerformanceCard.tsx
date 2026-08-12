"use client";

import React from "react";
import { ChartContainer } from "./ChartContainer";
import { AgentCard } from "../shared/AgentCard";
import { useAgentHealth } from "@/hooks/useAgentLogs";
import { Activity } from "lucide-react";

export const AIPerformanceCard: React.FC = () => {
  const { healthData, loading } = useAgentHealth();

  const agents = healthData?.agents || [];

  return (
    <ChartContainer title="Autonomous 7-Agent AI Workforce Performance" subtitle="Real-Time Task Execution, Latency & Health Matrix">
      {loading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-slate-400 text-xs font-mono">
          <Activity className="w-4 h-4 animate-spin text-teal-400" />
          Fetching live backend agent telemetry...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {agents.map((a) => {
            const isIdle = a.status === "Idle" || a.tasks_today === 0;
            const isFailed = a.status === "Failed" || a.failures_today > 0;
            const agentStatus = isIdle ? "idle" : isFailed ? "error" : "active";

            return (
              <AgentCard
                key={a.id}
                name={a.name}
                agentId={a.id}
                role={a.role}
                status={agentStatus}
                lastTask={a.last_decision || "Awaiting task execution"}
                activityCount={a.tasks_today}
                health={Math.round(a.success_rate_pct)}
                latencyMs={a.avg_latency_ms}
              />
            );
          })}
        </div>
      )}
    </ChartContainer>
  );
};
