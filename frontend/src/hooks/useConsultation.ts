import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { useClinicStore } from "../store/clinicStore";

export interface SafetyEvaluation {
  is_safe: boolean;
  confidence_score: number;
  warnings_count: number;
  warnings: Array<{ severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; type: string; drugs_involved: string[]; message: string; recommendation: string }>;
  safety_summary: string;
  risk_level?: string;
  flags?: Array<{ type: string; severity: string; description: string }>;
  evaluated_at?: string;
  provider?: string;
  execution_status?: string;
  stale?: boolean;
  overridden?: boolean;
  override_reason?: string;
  error?: string | null;
}

export interface ConsultationData {
  consultation_id: string;
  clinic_id: string;
  appointment_id: string;
  patient_id: string;
  transcript_raw: string;
  transcript_anonymised: string;
  soap_note: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  diagnoses: Array<{ code: string; description: string; confidence: number; is_provisional?: boolean }>;
  medications: Array<{ drug_name: string; dosage: string; frequency: string; duration: string; instructions: string }>;
  investigations: string[];
  referrals: Array<{ speciality: string; reason: string; urgency: string }>;
  followup_days: number;
  status: "draft" | "approved";
  vitals?: any;
  clinical_facts?: any;
  patient_allergies?: string[];
  allergy_review_status?: string;
  allergy_alert?: string | null;
  scribe_metadata?: any;
  // Enriched fields returned by GET /consultations/{id} (api/consultations.py)
  patient_name?: string;
  patient_phone_masked?: string;
  patient_age?: string | number;
  patient_gender?: string;
  patient_blood_group?: string;
  patient_chronic_diseases?: string[];
  patient_current_medications?: Array<string | Record<string, any>>;
  complaint_summary?: string;
  chief_complaint?: string;
  consultation_type?: string;
  visit_count?: number;
  total_visits?: number;
  safety_evaluation?: SafetyEvaluation | null;
}

export function useConsultation(consultationId: string) {
  const clinicId = useClinicStore((state) => state.clinicId);
  const [consultation, setConsultation] = useState<ConsultationData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConsultation = useCallback(async () => {
    if (!clinicId || !consultationId || consultationId === "demo") {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get(`/consultations/${consultationId}?clinic_id=${clinicId}`);
      setConsultation(res.data);
    } catch (e) {
      console.warn("Could not fetch consultation:", e);
    } finally {
      setLoading(false);
    }
  }, [clinicId, consultationId]);

  useEffect(() => {
    setConsultation(null);
    setLoading(true);
    fetchConsultation();
  }, [consultationId, fetchConsultation]);

  return { consultation, loading, refresh: fetchConsultation, setConsultation };
}
