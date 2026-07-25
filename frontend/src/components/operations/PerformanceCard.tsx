import React from "react";
import { ChartContainer } from "../analytics/ChartContainer";
import { Activity, Clock, Zap, Cpu, Server, AlertCircle } from "lucide-react";

export const PerformanceCard: React.FC = () => {
  const performanceMetrics = [
    { label: "Average AI Latency", value: "650 ms", target: "< 1500 ms", color: "text-emerald-400" },
    { label: "API Response Time", value: "110 ms", target: "< 300 ms", color: "text-teal-400" },
    { label: "Queue Processing", value: "15 ms", target: "< 50 ms", color: "text-purple-400" },
    { label: "Daily AI Decisions", value: "184", target: "Uncapped", color: "text-blue-400" },
    { label: "System Availability", value: "99.99%", target: "99.9%", color: "text-emerald-400" },
    { label: "AI Error Rate", value: "0.02%", target: "< 0.1%", color: "text-indigo-400" }
  ];

  return (
    <ChartContainer title="Platform Operations Performance Metrics" subtitle="Vertex AI Latency & FastAPI Execution Metrics">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
        {performanceMetrics.map((m, i) => (
          <div key={i} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-1 text-xs">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block truncate">{m.label}</span>
            <p className={`text-base font-bold font-mono ${m.color}`}>{m.value}</p>
            <span className="text-[10px] text-slate-500 block font-mono">SLA: {m.target}</span>
          </div>
        ))}
      </div>
    </ChartContainer>
  );
};
