import React from "react";
import { Pill, ShieldCheck, AlertTriangle, ShieldAlert, User, CheckCircle2 } from "lucide-react";
import clsx from "clsx";

export interface MedicationItem {
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  prescribed_by?: string;
  is_active: boolean;
  interaction_warning?: string;
}

interface MedicationCardProps {
  medications: MedicationItem[];
  className?: string;
}

export const MedicationCard: React.FC<MedicationCardProps> = ({ medications, className }) => {
  const activeMeds = medications.filter((m) => m.is_active);
  const pastMeds = medications.filter((m) => !m.is_active);
  const hasWarnings = medications.some((m) => m.interaction_warning);

  return (
    <div className={clsx("bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4.5 space-y-3.5 shadow-sm", className)}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            Medications & Safety Audit
            <span className="text-[10px] font-mono font-normal bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              Agent 5 (PrescriptionSafe)
            </span>
          </h3>
        </div>

        {hasWarnings ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2.5 py-0.5 rounded-full font-mono">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> Interaction Warning
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> 0 Critical Conflicts
          </span>
        )}
      </div>

      {/* Active Medications List */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Regimen ({activeMeds.length})</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {activeMeds.map((med, idx) => (
            <div key={idx} className="bg-slate-900/70 border border-slate-700/60 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm">{med.drug_name}</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-semibold">
                  {med.dosage}
                </span>
              </div>
              <p className="text-slate-300 font-mono text-[11px]">
                {med.frequency} • Duration: {med.duration}
              </p>
              <p className="text-slate-400 italic text-[11px]">&quot;{med.instructions}&quot;</p>

              {med.interaction_warning && (
                <div className="mt-1 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] p-2 rounded-lg flex items-start gap-1 font-mono">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <span>{med.interaction_warning}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
