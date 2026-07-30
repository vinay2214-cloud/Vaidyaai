"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";
import { PatientBanner, LongitudinalPatientHeader } from "@/components/patient-detail/PatientBanner";
import { PatientOverviewCard, LongitudinalOverview } from "@/components/patient-detail/PatientOverviewCard";
import { AISummaryCard, AISummaryContent } from "@/components/patient-detail/AISummaryCard";
import { SOAPCard, SOAPNoteData } from "@/components/patient-detail/SOAPCard";
import { VitalsCard, VitalsData } from "@/components/patient-detail/VitalsCard";
import { MedicationCard, MedicationItem } from "@/components/patient-detail/MedicationCard";
import { LabCard, LabItem } from "@/components/patient-detail/LabCard";
import { ReferralCard, ReferralItem } from "@/components/patient-detail/ReferralCard";
import { RetentionCard, RetentionOutreachItem } from "@/components/patient-detail/RetentionCard";
import { DocumentCard, ClinicalDocument } from "@/components/patient-detail/DocumentCard";
import { ClinicalTimeline } from "@/components/patient-detail/ClinicalTimeline";
import { LongitudinalTimelineItem } from "@/components/patient-detail/TimelineEntry";
import { AuditCard } from "@/components/patient-detail/AuditCard";
import { QuickActionsBar } from "@/components/patient-detail/QuickActionsBar";
import { PatientSidebar } from "@/components/patient-detail/PatientSidebar";
import { useToast } from "@/components/design-system";

export default function LongitudinalPatientRecordPage() {
  const params = useParams();
  const patientId = (params?.id as string) || "pat_demo";
  const clinicId = useClinicStore((state) => state.clinicId);

  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState<any>(null);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    async function loadData() {
      if (!patientId || !clinicId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [patRes, tlRes] = await Promise.allSettled([
          api.get(`/patients/${patientId}?clinic_id=${clinicId}`),
          api.get(`/patients/${patientId}/timeline?clinic_id=${clinicId}`)
        ]);
        if (patRes.status === "fulfilled" && patRes.value.data) {
          setPatientData(patRes.value.data);
        }
        if (tlRes.status === "fulfilled" && Array.isArray(tlRes.value.data)) {
          setTimelineData(tlRes.value.data);
        }
      } catch (e) {
        console.warn("Could not load backend patient details:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [patientId, clinicId]);

  // Enriched patient data from backend API with fallbacks
  const patientHeader: LongitudinalPatientHeader = {
    patient_id: patientId,
    name: patientData?.name || "Ramesh Sharma",
    patient_phone_masked: patientData?.patient_phone_masked || "+91XXXXXX3210",
    age: patientData?.age || 42,
    gender: patientData?.gender || "M",
    blood_group: patientData?.blood_group || "B+",
    city: patientData?.city || "Mumbai, MH",
    dob: patientData?.dob || "14-Aug-1984",
    registration_date: patientData?.registration_date || "21-Jul-2026",
    status_badge: patientData?.status_badge || "HIGH RISK",
    risk_level: patientData?.risk_level || "HIGH",
    consent_status: patientData?.consent_status || "granted",
    whatsapp_verified: true,
    allergies: patientData?.allergies || ["Penicillin"],
    chronic_diseases: patientData?.chronic_diseases || ["Type-2 Diabetes Mellitus", "Essential Hypertension"]
  };

  const overview: LongitudinalOverview = {
    last_visit: "25-Jul-2026 (Today)",
    primary_physician: "Dr. Vinay Sharma, MD",
    visit_count: 6,
    active_problems: ["Type-2 Diabetes (E11.9)", "Essential Hypertension (I10)", "Persistent Dry Cough"],
    current_medications_count: 3,
    upcoming_followup: "10-Aug-2026 (16 days)",
    active_referrals_count: 1,
    outstanding_bills_rupees: 0
  };

  const aiSummary: AISummaryContent = {
    generated_at: "Today, 09:30 AM IST",
    patient_overview: "42-year-old male with 2-year history of Type-2 Diabetes Mellitus and Essential Hypertension presenting for quarterly review.",
    clinical_history: "HbA1c stable at 7.2%. Blood Pressure 134/86 mmHg. Reports mild fatigue and persistent nocturnal dry cough for 4 days.",
    risk_assessment: "Moderate-High Cardiovascular & Nephropathy risk. High compliance with Metformin, but blood pressure elevated above target 130/80.",
    care_gaps: ["Ophthalmology Diabetic Retinopathy annual screening overdue by 60 days.", "Urinary Microalbumin/Creatinine Ratio lab pending."],
    missed_followups: ["Missed 30-day follow-up appointment on June 12."],
    recommended_next_steps: [
      "Add Telmisartan 40mg once daily for BP control.",
      "Order Renal Function Test & Microalbumin lab panel.",
      "Schedule Cardiology & Retinal Specialist Consultation."
    ],
    important_observations: [
      "Known Penicillin allergy — avoid Amoxicillin formulation.",
      "RetentionRadar outreach successfully recovered patient after June 12 missed visit."
    ]
  };

  const soapData: SOAPNoteData = {
    subjective: "Patient reports 4-day history of dry cough and mild fever. No shortness of breath. History of Type-2 Diabetes.",
    objective: "BP: 134/86 mmHg, Pulse: 78 bpm, Temp: 99.1°F, SpO2: 98% on room air. Chest clear bilaterally.",
    assessment: "1. Type-2 Diabetes Mellitus (E11.9) - Fair control. 2. Mild Upper Respiratory Infection. 3. Essential Hypertension (I10).",
    plan: "1. Metformin 500mg BD. 2. Telmisartan 40mg OD. 3. Paracetamol 650mg TDS PRN. 4. Follow-up in 14 days.",
    diagnoses: [
      { code: "E11.9", description: "Type-2 Diabetes Mellitus", confidence: 0.98 },
      { code: "I10", description: "Essential Hypertension", confidence: 0.95 }
    ],
    clinician: "Dr. Vinay Sharma",
    generated_at: "25-Jul-2026"
  };

  const vitals: VitalsData = {
    bp_sys: 134,
    bp_dia: 86,
    pulse: 78,
    temperature: 99.1,
    spo2: 98,
    resp_rate: 16,
    weight_kg: 74.5,
    height_cm: 172,
    bmi: 25.2,
    recorded_at: "Today, 10:15 AM"
  };

  const medications: MedicationItem[] = [
    {
      drug_name: "Metformin Hydrochloride",
      dosage: "500 mg",
      frequency: "Twice daily after meals (1-0-1)",
      duration: "90 days",
      instructions: "Take with meals to prevent GI upset.",
      prescribed_by: "Dr. Vinay Sharma",
      is_active: true
    },
    {
      drug_name: "Telmisartan",
      dosage: "40 mg",
      frequency: "Once daily morning (1-0-0)",
      duration: "30 days",
      instructions: "Monitor blood pressure weekly.",
      prescribed_by: "Dr. Vinay Sharma",
      is_active: true
    },
    {
      drug_name: "Paracetamol",
      dosage: "650 mg",
      frequency: "As needed for fever (PRN)",
      duration: "5 days",
      instructions: "Do not exceed 3 grams daily.",
      prescribed_by: "Dr. Vinay Sharma",
      is_active: true
    }
  ];

  const labs: LabItem[] = [
    {
      test_name: "HbA1c Glycated Hemoglobin",
      category: "Endocrinology",
      ordered_date: "20-Jul-2026",
      status: "completed",
      result_value: "7.2%",
      normal_range: "< 6.5%"
    },
    {
      test_name: "Renal Function Test (RFT)",
      category: "Nephrology",
      ordered_date: "25-Jul-2026",
      status: "pending"
    }
  ];

  const referrals: ReferralItem[] = [
    {
      id: "ref_1",
      speciality: "Cardiology",
      target_doctor: "Dr. Mehta, MD (Cardiology)",
      reason: "Hypertension evaluation & ECG screening",
      urgency: "Routine",
      status: "pending",
      created_at: "25-Jul-2026"
    }
  ];

  const retentionHistory: RetentionOutreachItem[] = [
    {
      id: "ret_1",
      campaign_name: "30-Day Diabetes Follow-up Recovery",
      sent_date: "24-Jul-2026",
      channel: "WhatsApp Agent 4",
      response_status: "Booked Appointment",
      next_scheduled_outreach: "10-Aug-2026"
    }
  ];

  const documents: ClinicalDocument[] = [
    {
      id: "doc_1",
      name: "SOAP_Consultation_20260725.pdf",
      type: "SOAP PDF",
      date: "25-Jul-2026",
      size: "245 KB"
    },
    {
      id: "doc_2",
      name: "Prescription_Rx_VDY-9021.pdf",
      type: "Prescription Rx",
      date: "25-Jul-2026",
      size: "180 KB"
    },
    {
      id: "doc_3",
      name: "Cardiology_Referral_Letter.pdf",
      type: "Referral Letter",
      date: "25-Jul-2026",
      size: "195 KB"
    },
    {
      id: "doc_4",
      name: "Invoice_VDY-20260725-0012.pdf",
      type: "Invoice PDF",
      date: "25-Jul-2026",
      size: "120 KB"
    }
  ];

  const timelineItems: LongitudinalTimelineItem[] = [
    {
      id: "tl_1",
      type: "consultation",
      date: "25-Jul-2026",
      title: "Quarterly Diabetes & Hypertension Consultation",
      summary: "Evaluated BP (134/86) and dry cough. Adjusted BP therapy with Telmisartan 40mg.",
      clinician: "Dr. Vinay Sharma",
      agents_involved: ["ClinicalScribe", "PrescriptionSafe", "BillingPulse"],
      status_variant: "completed",
      status_label: "Completed",
      details: {
        vitals: "134/86 mmHg, 78 bpm, 99.1°F",
        diagnoses: "E11.9 (Type-2 Diabetes), I10 (Hypertension)",
        fee_paid: "₹500 (UPI Paid via Razorpay)"
      }
    },
    {
      id: "tl_2",
      type: "prescription",
      date: "25-Jul-2026",
      title: "Prescription Rx Generated & Safety Audited",
      summary: "Prescribed Metformin 500mg BD + Telmisartan 40mg OD. 0 Critical drug conflicts detected.",
      clinician: "Dr. Vinay Sharma",
      agents_involved: ["PrescriptionSafe"],
      status_variant: "success",
      status_label: "Rx Audited",
      details: {
        safety_score: "100% (No Penicillin conflict in Rx)",
        interaction_warnings: "None"
      }
    },
    {
      id: "tl_3",
      type: "retention",
      date: "24-Jul-2026",
      title: "RetentionRadar WhatsApp Outreach",
      summary: "Automated WhatsApp outreach sent for missed follow-up. Patient replied and booked July 25 slot.",
      clinician: "Agent 4 (RetentionRadar)",
      agents_involved: ["RetentionRadar", "AppointmentFlow"],
      status_variant: "info",
      status_label: "Recovered Patient",
      details: {
        channel: "WhatsApp Cloud API",
        language: "English / Hindi",
        outcome: "Appointment Booked"
      }
    }
  ];

  const auditLogs = [
    {
      id: "aud_1",
      agent_name: "ClinicalScribe",
      decision_type: "soap_generated",
      decision_made: "Diarized 4-minute consultation audio into structured SOAP note & ICD-10 codes.",
      clinic_id: clinicId || "clinic_1",
      model_used: "gemini-1.5-pro",
      latency_ms: 1450,
      patient_phone_masked: "+91XXXXXX3210",
      success: true,
      created_at: "Today, 10:20 AM"
    },
    {
      id: "aud_2",
      agent_name: "PrescriptionSafe",
      decision_type: "rx_safety_audited",
      decision_made: "Audited Metformin 500mg + Telmisartan 40mg. Confirmed 0 drug-drug & allergy conflicts.",
      clinic_id: clinicId || "clinic_1",
      model_used: "gemini-1.5-flash",
      latency_ms: 290,
      patient_phone_masked: "+91XXXXXX3210",
      success: true,
      created_at: "Today, 10:22 AM"
    }
  ];

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <div className="space-y-6">
      {/* Navigation & Back Link */}
      <div className="flex items-center gap-3">
        <Link href="/patients" className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="text-xs text-foreground-subtle font-medium">Back to Patient Intelligence Center</span>
      </div>

      {/* SECTION 1: Patient Header Banner */}
      <PatientBanner patient={patientHeader} />

      {/* SECTION 13: Sticky Quick Actions Bar */}
      <QuickActionsBar
        patientId={patientId}
        onGenerateSummary={() => toast("AI Summary re-generated by Agent 6 (InsightEngine)", "info")}
        onSendFollowup={() => toast("Follow-up outreach triggered via Agent 4 (RetentionRadar)", "info")}
      />

      {/* Main Grid Layout: Left Content (2 Cols), Right Sidebar (1 Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Primary Clinical Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* SECTION 2: Patient Summary Overview */}
          <PatientOverviewCard overview={overview} />

          {/* SECTION 3: AI Clinical Summary */}
          <AISummaryCard summary={aiSummary} />

          {/* SECTION 5: SOAP Workspace */}
          <SOAPCard soap={soapData} />

          {/* SECTION 6: Vitals & History */}
          <VitalsCard vitals={vitals} />

          {/* SECTION 7: Medications & Safety */}
          <MedicationCard medications={medications} />

          {/* SECTION 8: Labs & Investigations */}
          <LabCard labs={labs} />

          {/* SECTION 9: Referrals */}
          <ReferralCard referrals={referrals} />

          {/* SECTION 10: Retention History */}
          <RetentionCard history={retentionHistory} />

          {/* SECTION 11: Document Center */}
          <DocumentCard
            documents={documents}
            onDownload={(doc) => alert(`Downloading ${doc.name}...`)}
          />

          {/* SECTION 4: Longitudinal Timeline */}
          <ClinicalTimeline items={timelineItems} />

          {/* SECTION 12: Compliance Audit Trail */}
          <AuditCard logs={auditLogs} />
        </div>

        {/* Right Sidebar (SECTION 14: AI Workforce & Decisions) */}
        <div className="space-y-6">
          <PatientSidebar />
        </div>
      </div>
    </div>
  );
}
