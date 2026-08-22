"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";
import { usePatientStore } from "@/store/patientStore";
import { PatientBanner, LongitudinalPatientHeader } from "@/components/patient-detail/PatientBanner";
import { PatientOverviewCard, LongitudinalOverview } from "@/components/patient-detail/PatientOverviewCard";
import { AISummaryCard, AISummaryContent } from "@/components/patient-detail/AISummaryCard";
import { SOAPCard, SOAPNoteData } from "@/components/patient-detail/SOAPCard";
import { VitalsCard, VitalsData } from "@/components/patient-detail/VitalsCard";
import { MedicationCard, MedicationItem } from "@/components/patient-detail/MedicationCard";
import { LabCard, LabItem } from "@/components/patient-detail/LabCard";
import { ReferralCard, ReferralItem } from "@/components/patient-detail/ReferralCard";
import { RetentionCard, RetentionOutreachItem } from "@/components/patient-detail/RetentionCard";
import { PatientBillingCard, PatientInvoiceItem } from "@/components/patient-detail/PatientBillingCard";
import { DocumentCard, ClinicalDocument } from "@/components/patient-detail/DocumentCard";
import { ClinicalTimeline } from "@/components/patient-detail/ClinicalTimeline";
import { LongitudinalTimelineItem } from "@/components/patient-detail/TimelineEntry";
import { AuditCard } from "@/components/patient-detail/AuditCard";
import { QuickActionsBar } from "@/components/patient-detail/QuickActionsBar";
import { PatientSidebar } from "@/components/patient-detail/PatientSidebar";
import { useToast } from "@/components/design-system";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { FHIRExportModal } from "@/components/shared/FHIRExportModal";
import { PatientSummaryModal } from "@/components/shared/PatientSummaryModal";

export default function LongitudinalPatientRecordPage() {
  const params = useParams();
  const patientId = (params?.id as string) || "pat_demo";
  const clinicId = useClinicStore((state) => state.clinicId);
  const setCurrentPatient = usePatientStore((state) => state.setCurrentPatient);
  const clearCurrentPatientIf = usePatientStore((state) => state.clearCurrentPatientIf);
  const { logs } = useAgentLogs();

  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState<any>(null);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [billingData, setBillingData] = useState<any>(null);
  const [showFHIRModal, setShowFHIRModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function loadData() {
      if (!patientId || !clinicId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [patRes, tlRes, billRes] = await Promise.allSettled([
          api.get(`/patients/${patientId}?clinic_id=${clinicId}`),
          api.get(`/patients/${patientId}/timeline?clinic_id=${clinicId}`),
          api.get(`/billing/patient/${patientId}?clinic_id=${clinicId}`)
        ]);
        if (patRes.status === "fulfilled" && patRes.value.data) {
          setPatientData(patRes.value.data);
          setCurrentPatient({
            patient_id: patRes.value.data.patient_id || patientId,
            name: patRes.value.data.name,
            allergies: patRes.value.data.allergies || [],
            chronic_conditions: patRes.value.data.chronic_conditions || [],
            risk_level: patRes.value.data.risk_level,
          });
        }
        if (billRes.status === "fulfilled" && billRes.value.data) {
          setBillingData(billRes.value.data);
        }
        if (tlRes.status === "fulfilled" && tlRes.value.data) {
          // The timeline endpoint returns an object {appointments, consultations,
          // referrals, total_visits}, not a bare array.
          setTimelineData(tlRes.value.data);
        }
      } catch (e) {
        console.warn("Could not load backend patient details:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [patientId, clinicId, setCurrentPatient]);

  // Clear the current patient from the global store when leaving this patient's
  // page (or switching to a different patient). The RightSidebar is globally
  // mounted, so without this cleanup Patient A's allergies/safety alerts would
  // remain visible while viewing Patient B or a non-patient page.
  // Identity-aware: only clears if the store still holds THIS patient, so a slow
  // Patient A unmount can never wipe out a Patient B that was already loaded.
  useEffect(() => {
    return () => {
      clearCurrentPatientIf(patientId);
    };
  }, [patientId, clearCurrentPatientIf]);

  // Enriched patient data from backend API with honest clinical states (no fabricated data)
  const patientHeader: LongitudinalPatientHeader = {
    patient_id: patientId,
    name: patientData?.name || "Patient Record",
    patient_phone_masked: patientData?.patient_phone_masked || patientData?.phone || "XXXX",
    age: patientData?.age ?? (patientData?.age === 0 ? 0 : "Not Recorded"),
    gender: patientData?.gender || "Not Recorded",
    blood_group: patientData?.blood_group || "Not Recorded",
    city: patientData?.city || "Registered Clinic Patient",
    dob: patientData?.dob || "Not Documented",
    registration_date: patientData?.created_at ? new Date(patientData.created_at).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' }) : "Recent",
    status_badge: patientData?.allergies?.length
      ? "ALLERGY ALERT"
      : (patientData?.visit_count > 1 || (Array.isArray(timelineData) && timelineData.length > 1)
      ? "RETURNING PATIENT"
      : "NEEDS ASSESSMENT"),
    risk_level: patientData?.allergies?.length
      ? "HIGH"
      : (patientData?.chronic_conditions?.length
      ? "MEDIUM"
      : "LOW"),
    consent_status: patientData?.consent_given ? "granted" : "pending",
    whatsapp_verified: Boolean(patientData?.phone),
    allergies: Array.isArray(patientData?.allergies) ? patientData.allergies : [],
    chronic_diseases: Array.isArray(patientData?.chronic_conditions) ? patientData.chronic_conditions : []
  };

  const rawConsultations = Array.isArray(timelineData) ? timelineData : (timelineData as any)?.consultations || [];
  // Pick the newest encounter by date rather than by array position: the
  // timeline is assembled per-appointment, so positional access can surface the
  // OLDEST consultation as if it were the most recent one.
  const latestCons = rawConsultations.length > 0
    ? rawConsultations.reduce((newest: any, c: any) => {
        const t = c?.created_at ? new Date(c.created_at).getTime() : NaN;
        const best = newest?.created_at ? new Date(newest.created_at).getTime() : NaN;
        if (Number.isNaN(t)) return newest;
        if (Number.isNaN(best)) return c;
        return t > best ? c : newest;
      }, rawConsultations[0])
    : null;
  const rawAppts = (timelineData as any)?.appointments || [];
  const rawReferrals = (timelineData as any)?.referrals || [];

  const overview: LongitudinalOverview = {
    // Prefer the real latest encounter date; never imply a visit we cannot date.
    last_visit: latestCons?.created_at
      ? new Date(latestCons.created_at).toLocaleDateString("en-IN")
      : patientData?.last_visit_str || "Not recorded",
    primary_physician: "Attending Medical Officer",
    visit_count: (timelineData as any)?.total_visits || rawAppts.length || patientData?.visit_count || 1,
    active_problems: Array.isArray(patientData?.chronic_conditions) && patientData.chronic_conditions.length > 0
      ? patientData.chronic_conditions
      : ["No chronic medical conditions documented"],
    current_medications_count: latestCons?.medications?.length || 0,
    upcoming_followup: latestCons?.followup_days ? `Follow-up in ${latestCons.followup_days} days` : "Routine review",
    active_referrals_count: rawReferrals.length,
    // Not computed on this screen — the Billing tab is the source of truth.
    outstanding_bills_rupees: null
  };

  const aiSummary: AISummaryContent = {
    generated_at: latestCons?.created_at ? new Date(latestCons.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Active Record",
    patient_overview: patientData?.name ? `${patientData.name} — Registered Outpatient Record (${patientHeader.age}Y, ${patientHeader.gender}).` : "Outpatient clinical record under active care.",
    clinical_history: patientData?.chronic_conditions?.length ? `Documented history: ${patientData.chronic_conditions.join(', ')}.` : "No chronic medical history documented.",
    risk_assessment: patientData?.allergies?.length ? `Documented drug/food allergies: ${patientData.allergies.join(', ')}.` : "No critical allergy alerts recorded.",
    care_gaps: patientData?.allergies?.length === 0 ? ["Allergy assessment not yet finalized."] : [],
    missed_followups: [],
    recommended_next_steps: [
      "Review longitudinal consultation notes",
      "Verify latest structured vitals",
      "Confirm ongoing medications and allergies"
    ],
    important_observations: patientData?.allergies?.length ? [`Known allergy alert: ${patientData.allergies.join(', ')}.`] : ["No critical clinical alerts."],
    provenance: {
      source: "patient_record",
      generated_by: "system",
      model: null,
      execution_id: null,
      created_at: latestCons?.created_at ? new Date(latestCons.created_at).toLocaleString() : undefined,
      evidence: "Compiled from patient registration, consultation and allergy fields.",
      status: "deterministic"
    }
  };

  const latestVitals = latestCons?.vitals || {};
  const soapData: SOAPNoteData = {
    subjective: latestCons?.soap_note?.subjective || latestCons?.complaint_summary || "No active consultation notes recorded yet.",
    objective: latestCons?.soap_note?.objective || (latestVitals.bp ? `BP: ${latestVitals.bp} mmHg, Pulse: ${latestVitals.pulse || '--'} bpm, Temp: ${latestVitals.temp || '--'}°F` : "Physical examination and vitals pending."),
    assessment: latestCons?.soap_note?.assessment || "Clinical assessment pending.",
    plan: latestCons?.soap_note?.plan || "Treatment plan pending consultation review.",
    diagnoses: latestCons?.diagnoses || [],
    clinician: "Attending Clinician",
    generated_at: latestCons?.created_at ? new Date(latestCons.created_at).toLocaleDateString() : "Recent"
  };

  const vitals: VitalsData = {
    bp_sys: parseInt(latestVitals.bp?.split("/")[0]) || 0,
    bp_dia: parseInt(latestVitals.bp?.split("/")[1]) || 0,
    pulse: parseInt(latestVitals.pulse) || 0,
    temperature: parseFloat(latestVitals.temp) || 0,
    spo2: parseInt(latestVitals.spo2) || 0,
    resp_rate: parseInt(latestVitals.resp_rate) || 0,
    weight_kg: parseFloat(latestVitals.weight) || 0,
    height_cm: 0,
    bmi: 0,
    recorded_at: latestCons?.created_at ? new Date(latestCons.created_at).toLocaleTimeString() : "Pending Entry"
  };

  const medications: MedicationItem[] = (latestCons?.medications || []).map((m: any) => ({
    drug_name: m.drug_name || "Medication",
    dosage: m.dosage || "--",
    frequency: m.frequency || "--",
    duration: m.duration || "--",
    instructions: m.instructions || "--",
    prescribed_by: "Attending Clinician",
    is_active: true
  }));

  const labs: LabItem[] = (latestCons?.investigations || []).map((inv: string) => ({
    test_name: inv,
    category: "Diagnostics",
    ordered_date: latestCons?.created_at ? new Date(latestCons.created_at).toLocaleDateString() : "Today",
    status: "pending" as const
  }));

  const referrals: ReferralItem[] = rawReferrals.map((r: any, idx: number) => ({
    id: r.referral_id || `ref_${idx}`,
    speciality: r.speciality || "Specialist",
    target_doctor: r.speciality ? `${r.speciality} Specialist` : "Consultant",
    reason: r.reason_for_referral || r.clinical_summary || "Specialist evaluation",
    urgency: r.urgency || "Routine",
    status: r.status || "pending",
    created_at: r.created_at ? new Date(r.created_at).toLocaleDateString() : "Recent"
  }));

  // Previously hardcoded to []: the panel could never show anything, however
  // much outreach RetentionRadar had actually performed. Now fed from the
  // timeline endpoint's retention_outreach records.
  const rawOutreach = (timelineData as any)?.retention_outreach || [];
  const retentionHistory: RetentionOutreachItem[] = rawOutreach.map((o: any, idx: number) => ({
    id: o.outreach_id || `out_${idx}`,
    campaign_name: o.campaign_name || o.outreach_type || "Follow-up outreach",
    sent_date: o.sent_at ? new Date(o.sent_at).toLocaleDateString() : "—",
    channel: (o.channel || "whatsapp").toUpperCase(),
    response_status: o.response_status || o.status || "sent",
    next_scheduled_outreach: o.next_scheduled_outreach
      ? new Date(o.next_scheduled_outreach).toLocaleDateString()
      : "Not scheduled",
  }));

  const patientInvoices: PatientInvoiceItem[] = (billingData?.invoices || []).map((i: any) => ({
    invoice_id: i.invoice_id,
    invoice_number: i.invoice_number,
    amount_rupees: i.amount_rupees,
    consultation_type: i.consultation_type,
    status: i.status,
    payment_method: i.payment_method,
    created_at: i.created_at,
    paid_at: i.paid_at,
  }));

  const documents: ClinicalDocument[] = latestCons?.consultation_id ? [
    {
      id: `doc_${latestCons.consultation_id}`,
      name: `Prescription_${latestCons.consultation_id}.pdf`,
      type: "Prescription Rx",
      date: latestCons.created_at ? new Date(latestCons.created_at).toLocaleDateString() : "Recent",
      size: "PDF"
    }
  ] : [];

  // Timeline is built from BOTH appointments and consultations so a patient with
  // visits but no completed consultation still shows a longitudinal record.
  // Each item carries a canonical ISO `timestamp` used for chronological sorting
  // and a localized `date` used only for display (locale strings are not
  // lexicographically sortable, so sorting must never rely on `date`).
  // A visit and its clinical note are the same event. Both were rendered as
  // separate rows, so a patient with three visits showed six timeline entries
  // and contradicted the "Total Visits: 3" figure elsewhere on the page. The
  // consultation is the richer record, so an appointment only earns its own row
  // when no consultation was ever written against it (booked-but-not-seen,
  // cancelled, or a no-show) — cases where the appointment IS the whole story.
  const appointmentIdsWithConsultation = new Set(
    rawConsultations
      .map((c: any) => c.appointment_id)
      .filter(Boolean)
  );

  const appointmentItems: LongitudinalTimelineItem[] = rawAppts
    .filter((a: any) => !appointmentIdsWithConsultation.has(a.appointment_id || a.id))
    .map((a: any, idx: number) => {
    const ts = a.slot_date ? new Date(a.slot_date).toISOString() : undefined;
    return {
      id: a.appointment_id || a.id || `tl_appt_${idx}`,
      type: "consultation" as const,
      date: a.slot_date ? new Date(a.slot_date).toLocaleDateString() : "Recent",
      timestamp: ts,
      title: a.reason || "Clinic Visit",
      summary: a.status === "completed" ? "Visit completed." : a.status === "no_show" ? "Patient did not attend." : "Visit scheduled.",
      clinician: "Attending Clinician",
      agents_involved: ["AppointmentFlow"],
      status_variant: a.status === "completed" ? ("completed" as const) : a.status === "no_show" ? ("warning" as const) : ("info" as const),
      status_label: a.status === "completed" ? "Completed" : a.status === "no_show" ? "No-show" : "Scheduled",
      details: {
        vitals: "Not recorded",
        diagnoses: "None recorded",
        fee_paid: "Standard Consultation"
      }
    };
  });

  const consultationItems: LongitudinalTimelineItem[] = rawConsultations.map((c: any, idx: number) => {
    const ts = c.created_at ? new Date(c.created_at).toISOString() : undefined;
    return {
      id: c.consultation_id || `tl_${idx}`,
      type: "consultation" as const,
      date: c.created_at ? new Date(c.created_at).toLocaleDateString() : "Recent",
      timestamp: ts,
      title: c.complaint_summary || "Clinical Consultation",
      summary: c.soap_note?.assessment || "Outpatient encounter documented.",
      clinician: "Attending Clinician",
      agents_involved: ["ClinicalScribe", "PrescriptionSafe", "BillingPulse"],
      // A consultation is "draft" from the moment it starts until sign-off, so
      // anything not approved is an unfinalized record — previously labelled
      // "Documented", which read as complete while every detail below said
      // "Not recorded".
      status_variant: c.status === "approved" ? ("completed" as const) : ("warning" as const),
      status_label: c.status === "approved" ? "Approved" : "Incomplete — not finalized",
      is_draft: c.status !== "approved",
      details: {
        vitals: c.vitals?.bp ? `BP: ${c.vitals.bp}, HR: ${c.vitals.pulse}` : "Not recorded",
        diagnoses: c.diagnoses?.map((d: any) => d.description || d.code).join(", ") || "None recorded",
        fee_paid: "Standard Consultation"
      }
    };
  });

  // Sort by canonical ISO timestamp (newest first). Items without a timestamp
  // sort to the end so they never disrupt the chronological order.
  const timelineItems: LongitudinalTimelineItem[] = [...appointmentItems, ...consultationItems]
    .sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0;
      }
      if (a.timestamp) return -1;
      if (b.timestamp) return 1;
      return 0;
    });

  const auditLogs = logs
    .filter((log) => !patientId || log.patient_id === patientId || log.consultation_id?.includes(patientId))
    .map((log, index) => ({
      id: log.id || `aud_live_${index}`,
      agent_name: log.agent_name,
      decision_type: log.decision_type,
      decision_made: log.decision_made,
      clinic_id: log.clinic_id,
      model_used: log.model_used || "—",
      latency_ms: log.latency_ms || 0,
      patient_phone_masked: log.patient_phone_masked || patientHeader.patient_phone_masked,
      success: log.success !== false,
      created_at: log.created_at
    }));

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
        onGenerateSummary={() => setShowSummaryModal(true)}
        onExportFHIR={() => setShowFHIRModal(true)}
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

          {/* Billing history for this patient, not just today's clinic-wide list */}
          <PatientBillingCard
            invoices={patientInvoices}
            totalPaid={billingData?.total_paid_rupees || 0}
            outstanding={billingData?.outstanding_rupees || 0}
          />

          {/* SECTION 10: Retention History */}
          <RetentionCard history={retentionHistory} />

          {/* SECTION 11: Document Center */}
          <DocumentCard
            documents={documents}
            onDownload={(doc) => {
              const consId = latestCons?.consultation_id;
              // Fail safe: never build a request without both the consultation
              // and the authenticated clinic scope.
              if (!consId || !clinicId) {
                toast("Prescription PDF is unavailable for this record.", "info");
                return;
              }
              // URL-encode dynamic identifiers and build the query with
              // URLSearchParams so no raw interpolation can break the URL.
              const params = new URLSearchParams({ clinic_id: clinicId });
              const url = `/api/v1/consultations/${encodeURIComponent(consId)}/pdf?${params.toString()}`;
              window.open(url, "_blank");
            }}
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

      {/* FHIR R4 Export Modal */}
      <FHIRExportModal
        isOpen={showFHIRModal}
        onClose={() => setShowFHIRModal(false)}
        patientId={patientId}
        patientName={patientHeader.name}
      />

      {/* Longitudinal Patient Summary Modal */}
      <PatientSummaryModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        patientId={patientId}
        patientName={patientHeader.name}
      />
    </div>
  );
}
