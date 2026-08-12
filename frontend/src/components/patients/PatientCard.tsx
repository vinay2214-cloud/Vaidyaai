import React from "react";
import { PatientBadge, PatientStatusType } from "./PatientBadge";
import { RiskBadge } from "./RiskBadge";
import { ConsentBadge } from "./ConsentBadge";
import { ClinicalIndicator } from "./ClinicalIndicator";
import { PatientQuickActions } from "./PatientQuickActions";
import { MapPin, Calendar, Activity, Clock } from "lucide-react";
import clsx from "clsx";

export interface PatientData {
  patient_id: string;
  name: string;
  patient_phone_masked: string;
  age?: number | string;
  gender?: string;
  city?: string;
  last_visit_str?: string;
  chief_complaint?: string;
  visit_type?: string;
  status_badge?: PatientStatusType;
  risk_level?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  consent_status?: "granted" | "pending" | "revoked";
  allergies?: string[];
  chronic_diseases?: string[];
  has_ai_summary?: boolean;
  has_scribe_note?: boolean;
  has_retention_radar?: boolean;
}

interface PatientCardProps {
  patient: PatientData;
  onGenerateSummary?: (id: string) => void;
  onSendFollowup?: (id: string) => void;
  className?: string;
}

export const PatientCard: React.FC<PatientCardProps> = ({
  patient,
  onGenerateSummary,
  onSendFollowup,
  className
}) => {
  const isHighRisk = patient.risk_level === "CRITICAL" || patient.risk_level === "HIGH";

  return (
    <div
      className={clsx(
        "bg-slate-800/80 border rounded-2xl p-5 space-y-3.5 shadow-sm hover:border-slate-600 hover:shadow-panel-lg transition-all",
        isHighRisk ? "border-rose-500/40 bg-rose-950/10" : "border-slate-700/60",
        className
      )}
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={clsx(
              "w-11 h-11 border rounded-2xl flex items-center justify-center font-bold text-base shrink-0",
              isHighRisk
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                : "bg-teal-500/10 border-teal-500/30 text-teal-400"
            )}
            aria-hidden="true"
          >
            {patient.name ? patient.name.charAt(0).toUpperCase() : "P"}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-white text-base leading-tight">{patient.name || "Patient"}</h3>
              {patient.status_badge && <PatientBadge status={patient.status_badge} />}
              {patient.risk_level && <RiskBadge level={patient.risk_level} />}
              {patient.consent_status && patient.consent_status !== "granted" && <ConsentBadge status={patient.consent_status} />}
            </div>

            <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="font-mono text-slate-300 tnum">{patient.patient_phone_masked}</span>
              {(patient.age || patient.gender) && <span aria-hidden="true">•</span>}
              {patient.age && <span>{patient.age} yrs</span>}
              {patient.age && patient.gender && <span aria-hidden="true">•</span>}
              {patient.gender && <span>{patient.gender === "F" ? "Female" : patient.gender === "M" ? "Male" : patient.gender}</span>}
              {patient.city && (
                <>
                  <span aria-hidden="true">•</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-500" /> {patient.city}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="text-right text-xs text-slate-400 shrink-0">
          <span className="flex items-center justify-end gap-1.5 text-slate-300 font-medium">
            <Calendar className="w-3.5 h-3.5 text-teal-400" /> Last Visit: {patient.last_visit_str || "Today"}
          </span>
          <span className="text-[11px] text-slate-400 capitalize block mt-1">
            {patient.visit_type || "General Consultation"}
          </span>
        </div>
      </div>

      {/* Chief Complaint Callout */}
      {patient.chief_complaint && (
        <div className="bg-slate-900/70 border border-slate-800 border-l-2 border-l-teal-500/50 rounded-xl px-3.5 py-2.5 text-xs text-slate-300">
          <span className="text-teal-400 font-bold uppercase tracking-wider text-[10px] block mb-1">Chief Complaint</span>
          <span className="leading-relaxed">&quot;{patient.chief_complaint}&quot;</span>
        </div>
      )}

      {/* Clinical Indicators */}
      <ClinicalIndicator
        allergies={patient.allergies}
        chronicDiseases={patient.chronic_diseases}
        hasAiSummary={patient.has_ai_summary}
        hasScribeNote={patient.has_scribe_note}
        hasRetentionRadar={patient.has_retention_radar}
      />

      {/* Quick Actions Footer */}
      <div className="pt-2 border-t border-slate-700/40 flex items-center justify-between gap-3 flex-wrap">
        <PatientQuickActions
          patientId={patient.patient_id}
          patientName={patient.name}
          patientPhoneMasked={patient.patient_phone_masked}
          onGenerateSummary={onGenerateSummary}
          onSendFollowup={onSendFollowup}
        />
      </div>
    </div>
  );
};
