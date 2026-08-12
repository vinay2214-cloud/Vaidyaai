import React from "react";
import { AgentDot, AgentStatus } from "../shared/AgentDot";
import { StatusBadge } from "../shared/StatusBadge";
import { LatencyBadge } from "../timeline/LatencyBadge";
import { Cpu, CheckCircle2, AlertTriangle, Zap, Activity } from "lucide-react";
import clsx from "clsx";

export interface FullAgentStatus {
  name: string;
  agentId: string;
  role: string;
  status: AgentStatus;
  currentTask: string;
  tasksCompletedToday: number;
  avgLatencyMs: number;
  successRatePct: number;
  recentErrorsCount: number;
  lastActivityTime: string;
  modelUsed: string;
}

interface AgentStatusCardProps {
  agent: FullAgentStatus;
  className?: string;
}

export const AgentStatusCard: React.FC<AgentStatusCardProps> = ({ agent, className }) => {
  const statusStr = String(agent.status || "").toLowerCase();
  const isIdle = statusStr === "idle" || agent.tasksCompletedToday === 0;
  const isFailed = statusStr === "failed" || statusStr === "error" || (agent.recentErrorsCount > 0 && agent.successRatePct < 50);
  const isHealthy = !isFailed && !isIdle;

  const badgeLabel = isIdle ? "Idle" : isFailed ? "Failed" : statusStr === "active" || statusStr === "running" ? "Running" : "Healthy";
  const badgeVariant: "neutral" | "running" | "error" = isIdle ? "neutral" : isFailed ? "error" : "running";

  return (
    <div
      className={clsx(
        "bg-slate-800/80 border rounded-2xl p-4 space-y-3 shadow-sm hover:border-slate-600 transition-colors",
        isFailed ? "border-rose-500/40 bg-rose-950/10" : isIdle ? "border-slate-700/60 bg-slate-800/40" : "border-teal-500/30 bg-slate-800/80",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <AgentDot status={isIdle ? "idle" : isFailed ? "error" : "active"} />
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-white text-sm">{agent.name}</h4>
              <StatusBadge
                label={badgeLabel}
                variant={badgeVariant}
                size="sm"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">{agent.role}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <LatencyBadge latencyMs={agent.avgLatencyMs} />
          <span className={clsx(
            "font-bold px-2 py-0.5 rounded-md border",
            isIdle ? "text-slate-400 bg-slate-700/30 border-slate-600/30" : isFailed ? "text-rose-400 bg-rose-500/10 border-rose-500/30" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
          )}>
            {agent.successRatePct}% Success
          </span>
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-2.5 text-xs text-slate-300 font-mono">
        <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] block mb-0.5">Current Task:</span>
        {agent.currentTask}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-700/40 font-mono">
        <span>Tasks Today: <strong className="text-teal-400">{agent.tasksCompletedToday}</strong></span>
        <span>Errors: <strong className={agent.recentErrorsCount > 0 ? "text-rose-400" : "text-emerald-400"}>{agent.recentErrorsCount}</strong></span>
        <span>Last Active: {agent.lastActivityTime}</span>
        <span>Model: {agent.modelUsed}</span>
      </div>
    </div>
  );
};
