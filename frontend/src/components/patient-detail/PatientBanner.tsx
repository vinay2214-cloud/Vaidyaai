import React from "react";
import { PatientBadge, PatientStatusType } from "../patients/PatientBadge";
import { RiskBadge } from "../patients/RiskBadge";
import { ConsentBadge } from "../patients/ConsentBadge";
import { ClinicalIndicator } from "../patients/ClinicalIndicator";
import { MapPin, Calendar, CheckCircle2, Phone, User, ShieldAlert } from "lucide-react";
import clsx from "clsx";

export interface LongitudinalPatientHeader {
  patient_id: string;
  name: string;
  patient_phone_masked: string;
  age: number | string;
  gender: string;
  blood_group?: string;
  city?: string;
  dob?: string;
  registration_date?: string;
  status_badge?: PatientStatusType;
  risk_level?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  consent_status?: "granted" | "pending" | "revoked";
  whatsapp_verified?: boolean;
  allergies?: string[];
  chronic_diseases?: string[];
}

interface PatientBannerProps {
  patient: LongitudinalPatientHeader;
  className?: string;
}

export const PatientBanner: React.FC<PatientBannerProps> = ({ patient, className }) => {
  const isHighRisk = patient.risk_level === "CRITICAL" || patient.risk_level === "HIGH";

  return (
    <div
      className={clsx(
        "bg-slate-800/90 border rounded-2xl p-5 space-y-4 shadow-md",
        isHighRisk ? "border-rose-500/40 bg-rose-950/20" : "border-slate-700/70",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div
            className={clsx(
              "w-14 h-14 border rounded-2xl flex items-center justify-center font-bold text-xl shrink-0 shadow-inner",
              isHighRisk
                ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                : "bg-teal-500/20 border-teal-500/40 text-teal-400"
            )}
          >
            {patient.name ? patient.name.charAt(0).toUpperCase() : "P"}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-white tracking-tight">{patient.name || "Patient"}</h1>
              {patient.status_badge && <PatientBadge status={patient.status_badge} />}
              <RiskBadge level={patient.risk_level || "LOW"} />
              <ConsentBadge status={patient.consent_status || "granted"} />
              {patient.whatsapp_verified !== false && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md font-mono">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> WhatsApp Verified
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 flex items-center gap-3 flex-wrap">
              <span className="font-mono text-teal-400 font-semibold">{patient.patient_phone_masked}</span>
              <span>•</span>
              <span>Age: <strong className="text-white">{patient.age}</strong> ({patient.gender})</span>
              <span>•</span>
              <span>Blood Group: <strong className="text-rose-400">{patient.blood_group || "O+"}</strong></span>
              <span>•</span>
              <span className="font-mono text-slate-400">ID: {patient.patient_id}</span>
            </p>
          </div>
        </div>

        {/* Secondary Metadata */}
        <div className="text-right text-xs text-slate-400 font-mono space-y-1 shrink-0">
          <p className="flex items-center justify-end gap-1 text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-teal-400" /> {patient.city || "Mumbai, MH"}
          </p>
          <p>DOB: <span className="text-slate-200">{patient.dob || "14-Aug-1992"}</span></p>
          <p>Registered: <span className="text-slate-200">{patient.registration_date || "21-Jul-2026"}</span></p>
        </div>
      </div>

      {/* Clinical Indicators Bar */}
      <div className="pt-3 border-t border-slate-700/50">
        <ClinicalIndicator
          allergies={patient.allergies}
          chronicDiseases={patient.chronic_diseases}
          hasAiSummary={true}
          hasScribeNote={true}
          hasRetentionRadar={true}
        />
      </div>
    </div>
  );
};
