import React from "react";
import { Clock, CheckCircle2, AlertTriangle, FileCheck } from "lucide-react";
import clsx from "clsx";

export interface LabItem {
  test_name: string;
  category: string;
  ordered_date: string;
  status: "completed" | "pending" | "critical";
  result_value?: string;
  normal_range?: string;
}

interface LabCardProps {
  labs: LabItem[];
  className?: string;
}

export const LabCard: React.FC<LabCardProps> = ({ labs, className }) => {
  return (
    <div className={clsx("bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4.5 space-y-3 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-bold text-white">Labs & Diagnostic Investigations</h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">Total Tests: {labs.length}</span>
      </div>

      <div className="space-y-2">
        {labs.map((lab, i) => (
          <div key={i} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
            <div>
              <h4 className="font-bold text-white text-xs">{lab.test_name}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {lab.category} • Ordered: {lab.ordered_date}
              </p>
            </div>

            <div className="text-right">
              {lab.status === "completed" ? (
                <div>
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-bold font-mono text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {lab.result_value}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Normal ({lab.normal_range})</span>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-400 font-bold font-mono text-xs bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                  <Clock className="w-3.5 h-3.5" /> Pending Lab Report
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
