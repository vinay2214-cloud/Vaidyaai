import React from "react";
import { Users, HeartPulse, ShieldAlert, Lock, PlusCircle } from "lucide-react";
import { KPICard } from "../shared/KPICard";

interface PatientHeaderProps {
  totalPatients: number;
  highRiskCount: number;
  chronicCount: number;
  consentCount: number;
  onAddWalkIn: () => void;
  className?: string;
}

export const PatientHeader: React.FC<PatientHeaderProps> = ({
  totalPatients,
  highRiskCount,
  chronicCount,
  consentCount,
  onAddWalkIn,
  className
}) => {
  return (
    <div className={`space-y-4 ${className || ""}`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-400" />
            <h2 className="text-lg font-bold text-white">Patient Intelligence Center</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            DPDP Act 2023 Compliant • Real-time Triage, Risk Flags & Longitudinal Clinical Records
          </p>
        </div>

        <button
          onClick={onAddWalkIn}
          className="px-3.5 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-lg shadow-teal-500/10"
        >
          <PlusCircle className="w-4 h-4" /> Add Walk-In Patient
        </button>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard title="Total Patients" value={totalPatients} subtitle="Registered records" icon={Users} color="teal" />
        <KPICard title="High Risk" value={highRiskCount} subtitle="Requires doctor review" icon={ShieldAlert} color="rose" />
        <KPICard title="Chronic Diseases" value={chronicCount} subtitle="RetentionRadar active" icon={HeartPulse} color="purple" />
        <KPICard title="DPDP Consent" value={`${totalPatients > 0 ? Math.round((consentCount / totalPatients) * 100) : 100}%`} subtitle="Encrypted PHI audit" icon={Lock} color="emerald" />
      </div>
    </div>
  );
};
