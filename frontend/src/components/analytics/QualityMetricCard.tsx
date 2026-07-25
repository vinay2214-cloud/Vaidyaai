import React from "react";
import { ChartContainer } from "./ChartContainer";
import { Clock, CheckCircle2, ShieldCheck, HeartPulse, Zap } from "lucide-react";

export const QualityMetricCard: React.FC = () => {
  const qualityMetrics = [
    { label: "Average Waiting Time", value: "8.4 mins", target: "< 15 mins", status: "Optimal", color: "text-emerald-400" },
    { label: "Average Queue Time", value: "12.1 mins", target: "< 20 mins", status: "Optimal", color: "text-teal-400" },
    { label: "Consultation Completion Rate", value: "98.2%", target: "> 95%", status: "High", color: "text-emerald-400" },
    { label: "Prescription Turnaround", value: "45 secs", target: "< 2 mins", status: "Instant", color: "text-purple-400" },
    { label: "Referral Dispatch Time", value: "1.2 mins", target: "< 5 mins", status: "Fast", color: "text-indigo-400" },
    { label: "Retention Recovery Rate", value: "84.5%", target: "> 75%", status: "Strong", color: "text-amber-400" }
  ];

  return (
    <ChartContainer title="Operational Quality & Turnaround Metrics" subtitle="SLA Target Tracking Across Clinic Workflows">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
        {qualityMetrics.map((m, i) => (
          <div key={i} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-1 text-xs">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block truncate">{m.label}</span>
            <p className={`text-base font-bold font-mono ${m.color}`}>{m.value}</p>
            <span className="text-[10px] text-slate-500 block font-mono">Target: {m.target}</span>
          </div>
        ))}
      </div>
    </ChartContainer>
  );
};
