import React from "react";
import { PatientAvatar, RiskBadge, Badge } from "@/components/design-system";
import { MapPin, Phone, Calendar, Droplet } from "lucide-react";

export interface LongitudinalPatientHeader {
  patient_id: string;
  name: string;
  patient_phone_masked: string;
  age: number;
  gender: string;
  blood_group?: string;
  city?: string;
  dob?: string;
  registration_date?: string;
  status_badge?: string;
  risk_level?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  consent_status?: "granted" | "pending" | "revoked";
  whatsapp_verified?: boolean;
  allergies?: string[];
  chronic_diseases?: string[];
}

interface PatientBannerProps {
  patient: LongitudinalPatientHeader;
}

export const PatientBanner: React.FC<PatientBannerProps> = ({ patient }) => {
  const risk = patient.risk_level === "CRITICAL" || patient.risk_level === "HIGH" ? "high" : patient.risk_level === "MEDIUM" ? "medium" : "low";

  return (
    <div className="panel p-5">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <PatientAvatar name={patient.name} size="xl" status="online" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">{patient.name}</h1>
            {patient.status_badge && (
              <Badge variant="outline">{patient.status_badge}</Badge>
            )}
            <RiskBadge level={risk} />
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-foreground-muted">
            <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {patient.patient_phone_masked}</span>
            <span>{patient.age} yrs • {patient.gender}</span>
            {patient.blood_group && <span className="flex items-center gap-1"><Droplet className="w-3.5 h-3.5 text-red-400" /> {patient.blood_group}</span>}
            {patient.city && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {patient.city}</span>}
            {patient.dob && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> DOB: {patient.dob}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
