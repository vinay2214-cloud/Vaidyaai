import React from "react";
import clsx from "clsx";

export type AgentStatus = "active" | "idle" | "busy" | "processing" | "waiting" | "healthy" | "warning" | "offline" | "error";

interface AgentDotProps {
  status?: AgentStatus;
  ping?: boolean;
  className?: string;
}

export const AgentDot: React.FC<AgentDotProps> = ({
  status = "active",
  ping = true,
  className
}) => {
  const statusColors: Record<AgentStatus, { bg: string; pingBg: string }> = {
    active: { bg: "bg-emerald-400", pingBg: "bg-emerald-400" },
    healthy: { bg: "bg-emerald-400", pingBg: "bg-emerald-400" },
    busy: { bg: "bg-teal-400", pingBg: "bg-teal-400" },
    processing: { bg: "bg-teal-400", pingBg: "bg-teal-400" },
    idle: { bg: "bg-blue-400", pingBg: "bg-blue-400" },
    waiting: { bg: "bg-amber-400", pingBg: "bg-amber-400" },
    warning: { bg: "bg-amber-400", pingBg: "bg-amber-400" },
    error: { bg: "bg-rose-400", pingBg: "bg-rose-400" },
    offline: { bg: "bg-slate-500", pingBg: "bg-slate-500" }
  };

  const { bg, pingBg } = statusColors[status] || statusColors.active;

  return (
    <span className={clsx("relative flex h-2.5 w-2.5", className)}>
      {ping && status !== "offline" && status !== "idle" && (
        <span
          className={clsx(
            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
            pingBg
          )}
        />
      )}
      <span className={clsx("relative inline-flex rounded-full h-2.5 w-2.5", bg)} />
    </span>
  );
};
