import React from "react";
import { AgentCard } from "../shared/AgentCard";
import { DecisionCard } from "../shared/DecisionCard";
import { Cpu, ShieldCheck, Activity, Bell, Calendar, ExternalLink } from "lucide-react";
import Link from "next/link";

export const OperationsSidebar: React.FC = () => {
  return (
    <aside className="space-y-4">
      {/* System Health Score & Status */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">AI Operations Status</h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
            100% Operational
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-2 text-xs font-mono">
          <div className="flex justify-between text-slate-300">
            <span>Overall Platform Health:</span>
            <strong className="text-teal-400 font-bold">99/100</strong>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Active AI Agents:</span>
            <strong className="text-emerald-400">7/7 Running</strong>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Pending Cloud Tasks:</span>
            <strong className="text-blue-400">0 Queued</strong>
          </div>
        </div>
      </div>

      {/* Upcoming Maintenance & Quick Links */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-3 shadow-sm text-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-teal-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Maintenance & Links</h3>
        </div>

        <div className="space-y-2 font-mono">
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-2.5 space-y-0.5">
            <span className="text-[10px] font-bold text-amber-400 uppercase">Upcoming Maintenance</span>
            <p className="text-slate-300 text-[11px]">PostgreSQL 15 Minor Patch: Sun 2:00 AM IST (Zero Downtime)</p>
          </div>

          <div className="space-y-1 pt-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Quick Operations Links:</span>
            <Link href="/logs" className="text-teal-400 hover:underline flex items-center justify-between py-1 border-b border-slate-800">
              <span>View AI Operations Timeline</span> <ExternalLink className="w-3 h-3" />
            </Link>
            <Link href="/analytics" className="text-teal-400 hover:underline flex items-center justify-between py-1 border-b border-slate-800">
              <span>View Practice Intelligence</span> <ExternalLink className="w-3 h-3" />
            </Link>
            <Link href="/patients" className="text-teal-400 hover:underline flex items-center justify-between py-1">
              <span>View Patient Intelligence</span> <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
};
