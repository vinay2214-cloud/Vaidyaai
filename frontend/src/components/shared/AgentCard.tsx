import React from "react";
import { AgentDot, AgentStatus } from "./AgentDot";
import { StatusBadge } from "./StatusBadge";
import { LucideIcon } from "lucide-react";
import clsx from "clsx";

export interface AgentCardProps {
  name: string;
  agentId: string;
  role: string;
  status: AgentStatus;
  lastTask: string;
  activityCount: number;
  health: number; // 0 - 100%
  latencyMs?: number;
  icon?: LucideIcon;
  color?: string;
  className?: string;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  name,
  role,
  status = "active",
  lastTask,
  activityCount,
  health,
  latencyMs = 850,
  icon: Icon,
  className
}) => {
  return (
    <div
      className={clsx(
        "bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-slate-600 transition-colors",
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <AgentDot status={status} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="text-xs font-bold text-white truncate">{name}</h4>
            <StatusBadge
              label={status === "active" ? "Healthy" : status === "idle" ? "Idle" : status === "error" ? "Failed" : "Healthy"}
              variant={status === "active" ? "success" : status === "idle" ? "neutral" : status === "error" ? "error" : "neutral"}
              size="sm"
            />
          </div>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">{role}</p>
        </div>
      </div>

      <div className="hidden md:flex flex-col items-end text-right shrink-0">
        <span className="text-[11px] font-medium text-slate-300 truncate max-w-[180px]">
          {lastTask}
        </span>
        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
          <span>{activityCount} tasks today</span>
          <span>•</span>
          <span className="text-emerald-400 font-medium">{health}% health</span>
          <span>•</span>
          <span className="text-slate-400 font-mono">{latencyMs}ms</span>
        </div>
      </div>
    </div>
  );
};
