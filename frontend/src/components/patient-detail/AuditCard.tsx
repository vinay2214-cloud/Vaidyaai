import React from "react";
import { DecisionEntry, LogData } from "../timeline/DecisionEntry";
import { ShieldCheck, Cpu } from "lucide-react";
import clsx from "clsx";

interface AuditCardProps {
  logs: LogData[];
  className?: string;
}

export const AuditCard: React.FC<AuditCardProps> = ({ logs, className }) => {
  return (
    <div className={clsx("bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4.5 space-y-3 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-teal-400" />
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            Compliance & AI Agent Audit Trail
            <span className="text-[10px] font-mono font-normal bg-teal-500/10 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full">
              DPDP Act 2023 Audited
            </span>
          </h3>
        </div>
      </div>

      <div className="mt-2 space-y-3">
        {logs.slice(0, 5).map((log) => (
          <DecisionEntry key={log.id} log={log} />
        ))}
      </div>
    </div>
  );
};
