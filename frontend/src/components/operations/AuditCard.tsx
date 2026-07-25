import React from "react";
import { ShieldCheck, UserCheck, Key, Lock, AlertTriangle } from "lucide-react";
import clsx from "clsx";

export interface AuditSecurityEvent {
  id: string;
  event_type: "Login" | "Config Change" | "AI Audit" | "Security Alert";
  actor: string;
  description: string;
  timestamp: string;
  severity: "info" | "warning" | "critical";
}

interface OperationsAuditCardProps {
  events: AuditSecurityEvent[];
  className?: string;
}

export const AuditCard: React.FC<OperationsAuditCardProps> = ({ events, className }) => {
  return (
    <div className={clsx("bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4.5 space-y-3.5 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-teal-400" />
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            DPDP Act 2023 Security & System Audit Trail
            <span className="text-[10px] font-mono font-normal bg-teal-500/10 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full">
              Audited
            </span>
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">Total Events: {events.length}</span>
      </div>

      <div className="space-y-2">
        {events.map((evt) => (
          <div key={evt.id} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white font-mono text-xs">{evt.event_type}</span>
                <span className="text-slate-300 font-semibold">• {evt.actor}</span>
              </div>
              <p className="text-slate-300 text-xs">{evt.description}</p>
            </div>

            <span className="text-[10px] font-mono text-slate-400 shrink-0">{evt.timestamp}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
