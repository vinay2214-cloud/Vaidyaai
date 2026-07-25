import React from "react";
import { ChartContainer } from "./ChartContainer";
import { FileText, ShieldAlert, Share2, Clock, CheckCircle2 } from "lucide-react";

export const ClinicalAnalyticsCard: React.FC = () => {
  const icd10List = [
    { code: "E11.9", name: "Type-2 Diabetes Mellitus", count: 42 },
    { code: "I10", name: "Essential Hypertension", count: 35 },
    { code: "J06.9", name: "Acute Upper Respiratory Infection", count: 18 },
    { code: "E03.9", name: "Hypothyroidism Unspecified", count: 12 }
  ];

  return (
    <ChartContainer title="Clinical Quality & ICD-10 Metrics" subtitle="ClinicalScribe SOAP Efficiency & PrescriptionSafe Interventions">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* ICD-10 Frequency */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Most Common ICD-10 Diagnoses:</span>
          <div className="space-y-2">
            {icd10List.map((icd, i) => (
              <div key={i} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-2.5 flex items-center justify-between font-mono">
                <span className="font-bold text-purple-300">{icd.code} — {icd.name}</span>
                <span className="text-teal-400 font-bold">{icd.count} cases</span>
              </div>
            ))}
          </div>
        </div>

        {/* Clinical Efficiency KPIs */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SOAP Completion</span>
            <p className="text-lg font-bold text-emerald-400 font-mono">98.5%</p>
            <span className="text-[10px] text-slate-500 block">Agent 2 ClinicalScribe</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rx Safety Interventions</span>
            <p className="text-lg font-bold text-amber-400 font-mono">18 Audit Checks</p>
            <span className="text-[10px] text-slate-500 block">Agent 5 PrescriptionSafe</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Referral Rate</span>
            <p className="text-lg font-bold text-purple-400 font-mono">12.4%</p>
            <span className="text-[10px] text-slate-500 block">Agent 7 Coordinator</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Consult Time</span>
            <p className="text-lg font-bold text-teal-400 font-mono">4.2 mins</p>
            <span className="text-[10px] text-slate-500 block">Ambient STT Active</span>
          </div>
        </div>
      </div>
    </ChartContainer>
  );
};
