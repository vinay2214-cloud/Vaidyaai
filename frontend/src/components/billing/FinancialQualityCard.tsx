import React from "react";
import { ChartContainer } from "../analytics/ChartContainer";
import { Activity, CheckCircle2, ShieldCheck, Zap } from "lucide-react";

export const FinancialQualityCard: React.FC = () => {
  const qualityMetrics = [
    { label: "Average Billing Time", value: "30 secs", target: "< 1 min", status: "Instant", color: "text-emerald-400" },
    { label: "Invoice Accuracy", value: "100%", target: "> 99%", status: "Perfect", color: "text-teal-400" },
    { label: "Payment Turnaround", value: "1.4 mins", target: "< 3 mins", status: "Fast", color: "text-purple-400" },
    { label: "Collection Success", value: "98.5%", target: "> 95%", status: "Optimal", color: "text-emerald-400" },
    { label: "Refund Rate", value: "0.0%", target: "< 1%", status: "Zero", color: "text-blue-400" }
  ];

  return (
    <ChartContainer title="Financial Quality & Turnaround Metrics" subtitle="BillingPulse Billing Precision & SLA Metrics">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
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
