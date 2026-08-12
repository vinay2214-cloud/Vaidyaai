import React from "react";
import { StatusBadge } from "./StatusBadge";
import { Bot, Clock, ArrowUpRight } from "lucide-react";
import clsx from "clsx";

export interface DecisionCardProps {
  id: string;
  agentName: string;
  decisionType: string;
  decisionMade: string;
  timeAgo: string;
  modelUsed?: string;
  latencyMs?: number;
  className?: string;
}

export const DecisionCard: React.FC<DecisionCardProps> = ({
  agentName,
  decisionType,
  decisionMade,
  timeAgo,
  modelUsed = "—",
  latencyMs = 0,
  className
}) => {
  return (
    <div
      className={clsx(
        "bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 flex flex-col gap-1.5 hover:border-slate-600/80 transition-colors text-xs",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Bot className="w-3.5 h-3.5 text-teal-400 shrink-0" />
          <span className="font-bold text-white truncate">{agentName}</span>
          <StatusBadge label={decisionType} variant="info" size="sm" />
        </div>
        <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0 font-mono">
          <Clock className="w-3 h-3 text-slate-500" />
          {timeAgo}
        </span>
      </div>

      <p className="text-slate-300 font-medium line-clamp-2 leading-snug pl-5">
        {decisionMade}
      </p>

      <div className="flex items-center justify-between pt-1 border-t border-slate-700/40 text-[10px] text-slate-400 pl-5">
        <span className="font-mono text-slate-400">{modelUsed}</span>
        <span className="font-mono text-teal-400">{latencyMs}ms</span>
      </div>
    </div>
  );
};
