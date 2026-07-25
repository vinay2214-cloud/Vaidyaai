import React from "react";
import { ChartContainer } from "./ChartContainer";
import { Users, PieChart, HeartPulse } from "lucide-react";

export const PatientAnalyticsCard: React.FC = () => {
  const diseaseBreakdown = [
    { disease: "Type-2 Diabetes Mellitus", count: 42, pct: 45 },
    { disease: "Essential Hypertension", count: 35, pct: 38 },
    { disease: "Upper Respiratory Infection", count: 18, pct: 20 },
    { disease: "Thyroid Disorders", count: 12, pct: 13 }
  ];

  return (
    <ChartContainer title="Patient Demographics & Retention" subtitle="Patient Triage, Retention & Disease Prevalence">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Patient Mix & Retention */}
        <div className="space-y-3">
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3.5 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Patient Mix</span>
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-300">New Patients: <strong className="text-teal-400">32%</strong></span>
              <span className="text-slate-300">Returning Patients: <strong className="text-blue-400">68%</strong></span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
              <div className="w-[32%] bg-teal-400 h-full" />
              <div className="w-[68%] bg-blue-500 h-full" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3.5 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gender Distribution</span>
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-300">Male: <strong className="text-purple-400">54%</strong></span>
              <span className="text-slate-300">Female: <strong className="text-pink-400">46%</strong></span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
              <div className="w-[54%] bg-purple-500 h-full" />
              <div className="w-[46%] bg-pink-400 h-full" />
            </div>
          </div>
        </div>

        {/* Disease Prevalence */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Disease Distribution:</span>
          <div className="space-y-2">
            {diseaseBreakdown.map((d, i) => (
              <div key={i} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-2.5 space-y-1">
                <div className="flex justify-between font-bold text-white text-xs">
                  <span>{d.disease}</span>
                  <span className="font-mono text-teal-400">{d.count} patients</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div style={{ width: `${d.pct}%` }} className="bg-teal-400 h-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ChartContainer>
  );
};
