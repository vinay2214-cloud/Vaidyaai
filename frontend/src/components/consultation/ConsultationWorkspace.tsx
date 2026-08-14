import React, { useState, useEffect } from "react";
import { cn } from "@/lib/cn";
import { Panel, SectionHeader, Badge, ActivityFeed, ActivityItem, AIStatus, Button, PatientAvatar } from "@/components/design-system";
import { ConsultationRecorder } from "@/components/ConsultationRecorder";
import { SOAPNoteEditor } from "@/components/SOAPNoteEditor";
import { SafetyFlagsPanel } from "@/components/SafetyFlagsPanel";
import { ConsultationData } from "@/hooks/useConsultation";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";
import {
  Stethoscope,
  FileText,
  Pill,
  FlaskConical,
  UserRound,
  Receipt,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Coins,
  CalendarDays,
  Activity,
  ArrowLeft,
  FileCode,
  Mic,
  MessageSquare,
  ChevronRight,
  Plus,
  X,
  Check,
} from "lucide-react";
import Link from "next/link";
import { FHIRExportModal } from "@/components/shared/FHIRExportModal";
import { PatientSummaryModal } from "@/components/shared/PatientSummaryModal";

const tabs = [
  { id: "soap", label: "SOAP", icon: FileText },
  { id: "prescription", label: "Prescription", icon: Pill },
  { id: "orders", label: "Orders & Labs", icon: FlaskConical },
  { id: "referral", label: "Referral", icon: UserRound },
  { id: "billing", label: "Billing", icon: Receipt },
] as const;

type TabId = (typeof tabs)[number]["id"];

interface ConsultationWorkspaceProps {
  consultation: ConsultationData;
  consultationId: string;
  appointmentId: string;
  onDataChange: (data: ConsultationData) => void;
  onClear: () => void;
  onApproved: () => void;
}

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function computeEstimate(
  consultation: ConsultationData,
  clinicFees?: { new_patient_paise?: number; followup_paise?: number; procedure_paise?: number } | null
) {
  const type = consultation.consultation_type || "new";
  let basePaise: number;
  if (type === "followup") {
    basePaise = clinicFees?.followup_paise ?? 15000;
  } else if (type === "procedure") {
    basePaise = clinicFees?.procedure_paise ?? 50000;
  } else {
    basePaise = clinicFees?.new_patient_paise ?? 30000;
  }
  const base = basePaise / 100;
  const perMed = 25;
  const perInvestigation = 150;
  const medCount = consultation.medications?.length || 0;
  const invCount = consultation.investigations?.length || 0;
  const subtotal = base + medCount * perMed + invCount * perInvestigation;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;
  return { base, medCount, invCount, subtotal, tax, total };
}

const COMMON_ALLERGIES = [
  "Penicillin",
  "Sulfa Drugs",
  "NSAIDs / Aspirin",
  "Cephalosporins",
  "Peanuts",
  "Latex",
  "Contrast Dye",
  "Codeine"
];

const COMMON_CHRONIC_CONDITIONS = [
  "Type-2 Diabetes",
  "Essential Hypertension",
  "Asthma / COPD",
  "Hypothyroidism",
  "Coronary Artery Disease",
  "Chronic Kidney Disease",
  "Dyslipidemia"
];

export function ConsultationWorkspace({
  consultation,
  consultationId,
  appointmentId,
  onDataChange,
  onClear,
  onApproved,
}: ConsultationWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabId>("soap");
  const clinicId = useClinicStore((state) => state.clinicId);

  // Allergy & Chronic Disease & Medication Assessment Dialog States
  const [showAllergyModal, setShowAllergyModal] = useState(false);
  const [showChronicModal, setShowChronicModal] = useState(false);
  const [showMedModal, setShowMedModal] = useState(false);
  const [showFHIRModal, setShowFHIRModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const [allergiesList, setAllergiesList] = useState<string[]>(() => {
    return Array.isArray(consultation.patient_allergies) ? consultation.patient_allergies : [];
  });
  const [chronicList, setChronicList] = useState<string[]>(() => {
    return Array.isArray(consultation.patient_chronic_diseases) ? consultation.patient_chronic_diseases : [];
  });
  const [medicationList, setMedicationList] = useState<Array<{ drug_name: string; dosage: string; frequency: string; route?: string; duration?: string; status?: string }>>(() => {
    const meds = consultation.patient_current_medications;
    if (!Array.isArray(meds)) return [];
    return meds.map((m) => (typeof m === "string" ? { drug_name: m, dosage: "", frequency: "" } : Object.assign({ dosage: "", frequency: "" }, m) as { drug_name: string; dosage: string; frequency: string }));
  });

  // Detailed Allergy Entry Form State
  const [allergySubstance, setAllergySubstance] = useState("");
  const [allergyReaction, setAllergyReaction] = useState("Urticaria / Rash");
  const [allergySeverity, setAllergySeverity] = useState<"Mild" | "Moderate" | "Severe">("Moderate");
  const [allergyStatus, setAllergyStatus] = useState<"Active" | "Historical">("Active");

  // Detailed Medication Entry Form State
  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("");
  const [medFreq, setMedFreq] = useState("1-0-1");
  const [medRoute, setMedRoute] = useState("Oral");
  const [medDuration, setMedDuration] = useState("30 days");

  const [customCondition, setCustomCondition] = useState("");
  const [savingAssessment, setSavingAssessment] = useState(false);

  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [clinicFees, setClinicFees] = useState<{ new_patient_paise?: number; followup_paise?: number; procedure_paise?: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadFees() {
      if (!clinicId) return;
      try {
        const res = await api.get("/clinics/settings");
        if (!cancelled) setClinicFees(res.data?.consultation_fees || null);
      } catch (e) {
        if (!cancelled) setClinicFees(null);
      }
    }
    loadFees();
    return () => { cancelled = true; };
  }, [clinicId]);

  useEffect(() => {
    let cancelled = false;
    async function loadActivity() {
      if (!consultationId || !clinicId) return;
      try {
        setActivityLoading(true);
        const res = await api.get(`/consultations/${consultationId}/activity?clinic_id=${clinicId}`);
        if (cancelled) return;
        const items = (res.data?.items || []).map((l: any, idx: number): ActivityItem => {
          const time = l.created_at
            ? new Date(l.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "--:--";
          const agentColorMap: Record<string, ActivityItem["agentColor"]> = {
            appointment_flow: "blue",
            clinical_scribe: "teal",
            prescription_safe: "red",
            billing_pulse: "orange",
            referral_coordinator: "blue",
            retention_radar: "orange",
            insight_engine: "teal",
          };
          return {
            id: l.id || `act_real_${idx}`,
            time,
            agent: l.agent || "system",
            agentColor: agentColorMap[l.agent] || "teal",
            message: l.message || `${l.decision_type || "event"}`,
            status: (l.status === "failed" ? "pending" : "completed") as ActivityItem["status"],
          };
        });
        if (!cancelled) setActivityItems(items);
      } catch (e) {
        // Activity feed is non-fatal; show empty state.
        if (!cancelled) setActivityItems([]);
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    }
    loadActivity();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId, clinicId, consultation.status]);

  // Synchronize state when consultation object changes (e.g. from Speech-to-Text extraction)
  useEffect(() => {
    if (Array.isArray(consultation.patient_allergies) && consultation.patient_allergies.length > 0) {
      setAllergiesList(consultation.patient_allergies);
    }
    if (Array.isArray(consultation.patient_chronic_diseases) && consultation.patient_chronic_diseases.length > 0) {
      setChronicList(consultation.patient_chronic_diseases);
    }
    if (consultation.vitals) {
      const v = consultation.vitals;
      setVitals({
        bp: v.bp || "",
        pulse: v.pulse || "",
        temp: v.temp || "",
        spo2: v.spo2 || "",
        weight: v.weight || "",
        resp_rate: v.resp_rate || "",
      });
    }
  }, [consultation]);

  // Structured Vitals State
  const [vitals, setVitals] = useState(() => {
    const v = consultation.vitals || {};
    return {
      bp: v.bp || "",
      pulse: v.pulse || "",
      temp: v.temp || "",
      spo2: v.spo2 || "",
      weight: v.weight || "",
      resp_rate: v.resp_rate || "",
    };
  });
  const [savingVitals, setSavingVitals] = useState(false);
  const [vitalsSaved, setVitalsSaved] = useState(false);
  const [vitalsSavedAt, setVitalsSavedAt] = useState<string | null>(null);

  const isVitalsModified = Boolean(
    vitals.bp || vitals.pulse || vitals.temp || vitals.spo2 || vitals.weight || vitals.resp_rate
  );
  const isVitalsRecorded = Boolean(vitalsSaved || vitals.bp || vitals.pulse || vitals.temp);

  const handleSaveVitals = async () => {
    if (!consultationId) return;
    try {
      setSavingVitals(true);
      const clinicId = useClinicStore.getState().clinicId;
      await api.post(`/consultations/${consultationId}/vitals`, {
        clinic_id: clinicId,
        vitals: vitals
      });
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setVitalsSavedAt(nowStr);
      setVitalsSaved(true);
      setTimeout(() => setVitalsSaved(false), 2500);
      onDataChange({
        ...consultation,
        vitals: vitals as any
      });
    } catch (e) {
      console.error("Vitals save error:", e);
    } finally {
      setSavingVitals(false);
    }
  };

  const handleSaveAllergies = async (newList: string[]) => {
    if (!consultationId) return;
    try {
      setSavingAssessment(true);
      const clinicId = useClinicStore.getState().clinicId;
      await api.post(`/consultations/${consultationId}/clinical-history`, {
        clinic_id: clinicId,
        allergies: newList,
      });
      setAllergiesList(newList);
      setShowAllergyModal(false);
      onDataChange({
        ...consultation,
        patient_allergies: newList as any
      } as any);
    } catch (e) {
      console.error("Allergies save error:", e);
    } finally {
      setSavingAssessment(false);
    }
  };

  const handleSaveChronic = async (newList: string[]) => {
    if (!consultationId) return;
    try {
      setSavingAssessment(true);
      const clinicId = useClinicStore.getState().clinicId;
      await api.post(`/consultations/${consultationId}/clinical-history`, {
        clinic_id: clinicId,
        chronic_conditions: newList,
      });
      setChronicList(newList);
      setShowChronicModal(false);
      onDataChange({
        ...consultation,
        patient_chronic_diseases: newList as any
      } as any);
    } catch (e) {
      console.error("Chronic conditions save error:", e);
    } finally {
      setSavingAssessment(false);
    }
  };

  const handleSaveMedications = async (newList: any[]) => {
    if (!consultationId) return;
    try {
      setSavingAssessment(true);
      const clinicId = useClinicStore.getState().clinicId;
      await api.post(`/consultations/${consultationId}/clinical-history`, {
        clinic_id: clinicId,
        current_medications: newList,
      });
      setMedicationList(newList);
      setShowMedModal(false);
      onDataChange({
        ...consultation,
        patient_current_medications: newList as any
      } as any);
    } catch (e) {
      console.error("Medications save error:", e);
    } finally {
      setSavingAssessment(false);
    }
  };

  const estimate = computeEstimate(consultation, clinicFees);
  const isReturningPatient = Boolean((consultation.visit_count ?? 0) > 1 || (consultation.total_visits ?? 0) > 1);
  const hasSafetyEvaluation = consultation.safety_evaluation;

  // Dynamic Consultation Readiness Checklist
  const isAllergyReviewed = allergiesList.length > 0;
  const isChronicReviewed = chronicList.length > 0;
  const isMedicationReviewed = medicationList.length > 0;
  const isChiefComplaintReviewed = Boolean(consultation.complaint_summary || consultation.chief_complaint);
  const isAssessmentDocumented = Boolean(
    (consultation.diagnoses && consultation.diagnoses.length > 0) ||
    (consultation.soap_note?.assessment && consultation.soap_note.assessment.trim().length > 0)
  );
  const isRxSafetyCompleted = Boolean(hasSafetyEvaluation?.is_safe || hasSafetyEvaluation?.overridden);
  const isFollowupDocumented = Boolean(consultation.followup_days);

  const checklistItems = [
    { label: "Patient Identity", status: true, detail: "Demographics Loaded" },
    { label: "Chief Complaint", status: isChiefComplaintReviewed, detail: "Documented at Check-in" },
    { label: "Allergy Review / NKDA", status: isAllergyReviewed, detail: isAllergyReviewed ? (allergiesList.includes("No Known Drug Allergies (NKDA)") ? "NKDA Confirmed" : `${allergiesList.length} Allergy Documented`) : "Action Required", onAction: () => setShowAllergyModal(true) },
    { label: "Chronic Conditions", status: isChronicReviewed, detail: isChronicReviewed ? (chronicList.includes("No Chronic Medical History") ? "None Confirmed" : `${chronicList.length} Condition(s)`) : "Action Required", onAction: () => setShowChronicModal(true) },
    { label: "Current Medications", status: isMedicationReviewed, detail: isMedicationReviewed ? `${medicationList.length} Meds Documented` : "Review Pending", onAction: () => setShowMedModal(true) },
    { label: "Structured Vitals", status: isVitalsRecorded, detail: isVitalsRecorded ? (vitalsSavedAt ? `Saved ${vitalsSavedAt}` : "Recorded") : "Optional / Pending" },
    { label: "Assessment & ICD-10", status: isAssessmentDocumented, detail: isAssessmentDocumented ? `${consultation.diagnoses?.length || 1} Diagnoses` : "Pending Scribe" },
    { label: "Rx Safety Audit", status: isRxSafetyCompleted, detail: isRxSafetyCompleted ? "Safety Verified" : "Pending Rx" },
  ];

  const checklistScore = checklistItems.filter(item => item.status).length;

  return (
    <div className="space-y-5 relative">
      {/* Top navigation & status bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-teal-400" />
              Active Consultation Workspace
            </h1>
            <p className="text-xs text-foreground-subtle font-mono">
              {consultationId} • {appointmentId}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowSummaryModal(true)}
            className="px-2.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Patient Summary
          </button>

          <button
            type="button"
            onClick={() => setShowFHIRModal(true)}
            className="px-2.5 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <FileCode className="w-3.5 h-3.5 text-teal-400" /> Export FHIR R4
          </button>

          <AIStatus
            state={consultation.status === "approved" ? "completed" : "running"}
            label={consultation.status === "approved" ? "Consultation Approved" : "AI Scribing Active"}
          />
          <Badge variant={consultation.status === "approved" ? "green" : "blue"} dot>
            {consultation.status === "approved" ? "Approved" : "Draft"}
          </Badge>
        </div>
      </div>

      {/* PRIORITY 1: Dynamic Consultation Readiness Checklist */}
      <Panel padding="md" className="border-teal-500/30 bg-teal-500/5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
            <h3 className="text-xs font-bold text-foreground">Consultation Readiness Checklist</h3>
            <span className="text-2xs text-foreground-subtle font-mono">Health Informatics Pre-Flight</span>
          </div>
          <Badge variant={checklistScore >= 6 ? "green" : "blue"} dot>
            {checklistScore} / {checklistItems.length} Verified
          </Badge>
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-2xs">
          {checklistItems.map((item, idx) => (
            <div
              key={idx}
              className={cn(
                "p-2 rounded-xl border flex items-center justify-between gap-1.5 transition-all",
                item.status
                  ? "bg-background-elevated/80 border-emerald-500/30 text-foreground"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-200"
              )}
            >
              <div className="min-w-0">
                <p className="font-semibold truncate flex items-center gap-1">
                  {item.status ? (
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                  )}
                  <span className="truncate">{item.label}</span>
                </p>
                <p className="text-[10px] text-foreground-subtle truncate">{item.detail}</p>
              </div>
              {item.onAction && !item.status && (
                <button
                  type="button"
                  onClick={item.onAction}
                  className="px-1.5 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold rounded shrink-0"
                >
                  Review
                </button>
              )}
            </div>
          ))}
        </div>
      </Panel>

      {/* Clinical workflow stepper */}
      <div className="panel px-4 py-3 flex items-center gap-2.5 overflow-x-auto scrollbar-none" aria-label="Consultation workflow progress">
        <AIStatus state="completed" label="1. Record" className="shrink-0" />
        <ChevronRight className="w-4 h-4 text-foreground-subtle shrink-0" aria-hidden="true" />
        <AIStatus
          state={consultation.transcript_raw || consultation.soap_note ? "completed" : "running"}
          label="2. Transcribe"
          className="shrink-0"
        />
        <ChevronRight className="w-4 h-4 text-foreground-subtle shrink-0" aria-hidden="true" />
        <AIStatus
          state={consultation.soap_note ? "completed" : "pending"}
          label="3. SOAP Review"
          className="shrink-0"
        />
        <ChevronRight className="w-4 h-4 text-foreground-subtle shrink-0" aria-hidden="true" />
        <AIStatus
          state={hasSafetyEvaluation ? (hasSafetyEvaluation.is_safe || hasSafetyEvaluation.overridden ? "completed" : "warning") : "pending"}
          label="4. Safety Audit"
          className="shrink-0"
        />
        <ChevronRight className="w-4 h-4 text-foreground-subtle shrink-0" aria-hidden="true" />
        <AIStatus
          state={consultation.status === "approved" ? "completed" : "pending"}
          label="5. Approve & Invoice"
          className="shrink-0"
        />
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Patient Context & Clinical Assessments */}
        <div className="lg:col-span-3 space-y-5">
          {/* PRIORITY 8: Comprehensive Patient Banner */}
          <Panel padding="md">
            <div className="flex items-center gap-3">
              <PatientAvatar name={consultation.patient_name || "Patient"} size="lg" status="in-consultation" />
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground truncate">{consultation.patient_name || "Patient"}</h2>
                <p className="text-xs text-foreground-subtle">
                  {consultation.patient_age && consultation.patient_age !== "Not Recorded" ? `${consultation.patient_age}Y` : "Age: Not Recorded"} • {consultation.patient_gender && consultation.patient_gender !== "Not Recorded" ? consultation.patient_gender : "Gender: Not Recorded"} • {consultation.patient_blood_group && consultation.patient_blood_group !== "Not Recorded" ? consultation.patient_blood_group : "Blood: Not Recorded"}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="panel p-2.5 bg-background-elevated/50 border border-border">
                <p className="text-xs text-foreground-subtle">Phone</p>
                <p className="font-medium text-foreground truncate">{consultation.patient_phone_masked || "XXXX"}</p>
              </div>
              <div className="panel p-2.5 bg-background-elevated/50 border border-border">
                <p className="text-xs text-foreground-subtle">Visit Type</p>
                <p className="font-medium text-foreground capitalize">{consultation.consultation_type || "Outpatient"}</p>
              </div>
            </div>

            {/* Actionable Clinical Assessments */}
            <div className="mt-4 space-y-2.5">
              {/* PRIORITY 2: Allergy Assessment Card */}
              {allergiesList.length === 0 ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Allergy Status
                    </span>
                    <span className="text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                      ⚪ Not Yet Reviewed
                    </span>
                  </div>
                  <button
                    onClick={() => setShowAllergyModal(true)}
                    className="w-full py-1.5 px-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" /> Review Allergies
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-background-elevated/50 border border-border rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      {allergiesList.includes("No Known Drug Allergies (NKDA)") ? "✓ NKDA Confirmed" : "✓ Allergy Status Reviewed"}
                    </span>
                    <button
                      onClick={() => setShowAllergyModal(true)}
                      className="text-[11px] text-teal-400 hover:text-teal-300 font-medium"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {allergiesList.map((alg, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          "px-2 py-0.5 rounded text-2xs font-medium border",
                          alg === "No Known Drug Allergies (NKDA)"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            : "bg-red-500/10 border-red-500/20 text-red-300"
                        )}
                      >
                        {alg}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* PRIORITY 3: Chronic Disease Assessment Card */}
              {chronicList.length === 0 ? (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-300 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-blue-400" /> Chronic Conditions
                    </span>
                    <span className="text-[10px] font-mono font-bold uppercase bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">
                      ⚪ Not Yet Reviewed
                    </span>
                  </div>
                  <button
                    onClick={() => setShowChronicModal(true)}
                    className="w-full py-1.5 px-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-200 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5"
                  >
                    <Activity className="w-3.5 h-3.5" /> Review Chronic Conditions
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-background-elevated/50 border border-border rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-blue-400" />
                      {chronicList.includes("No Chronic Medical History") ? "✓ No Chronic History" : "✓ Chronic Reviewed"}
                    </span>
                    <button
                      onClick={() => setShowChronicModal(true)}
                      className="text-[11px] text-teal-400 hover:text-teal-300 font-medium"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {chronicList.map((c, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded text-2xs font-medium">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* PRIORITY 4: Current Medication History Card */}
              {medicationList.length === 0 ? (
                <div className="p-3 bg-teal-500/10 border border-teal-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-teal-300 flex items-center gap-1.5">
                      <Pill className="w-3.5 h-3.5 text-teal-400" /> Medication History
                    </span>
                    <span className="text-[10px] font-mono font-bold uppercase bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded">
                      ⚪ Not Yet Reviewed
                    </span>
                  </div>
                  <button
                    onClick={() => setShowMedModal(true)}
                    className="w-full py-1.5 px-3 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-200 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5"
                  >
                    <Pill className="w-3.5 h-3.5" /> Review Current Medications
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-background-elevated/50 border border-border rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Pill className="w-3.5 h-3.5 text-teal-400" />
                      {medicationList.some(m => m.drug_name === "No Active Current Medications") ? "✓ No Active Meds" : "✓ Meds Documented"}
                    </span>
                    <button
                      onClick={() => setShowMedModal(true)}
                      className="text-[11px] text-teal-400 hover:text-teal-300 font-medium"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="space-y-1">
                    {medicationList.map((m, idx) => (
                      <div key={idx} className="text-2xs font-mono text-foreground-subtle flex items-center justify-between">
                        <span>{m.drug_name} {m.dosage ? `(${m.dosage})` : ''}</span>
                        <span className="text-teal-400">{m.frequency}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Panel>

          {/* Structured Vitals Entry & Verification Card */}
          <Panel padding="md">
            <SectionHeader
              icon={Activity}
              title="Structured Vitals Entry"
              subtitle="Verify prior to SOAP sign-off"
              action={
                <div className="flex items-center gap-2">
                  {vitalsSavedAt && (
                    <span className="text-2xs font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                      ✓ Vitals saved at {vitalsSavedAt}
                    </span>
                  )}
                  <button
                    onClick={handleSaveVitals}
                    disabled={savingVitals || !isVitalsModified}
                    className="px-2.5 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {savingVitals ? "Saving..." : vitalsSaved ? "Saved ✓" : "Save Vitals"}
                  </button>
                </div>
              }
            />
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] uppercase font-semibold text-foreground-subtle block mb-0.5">BP (mmHg)</label>
                <input
                  type="text"
                  placeholder="--"
                  value={vitals.bp}
                  onChange={(e) => setVitals((prev) => ({ ...prev, bp: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-background-elevated border border-border rounded-lg text-foreground font-mono focus:border-teal-500"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-foreground-subtle block mb-0.5">Pulse (bpm)</label>
                <input
                  type="text"
                  placeholder="--"
                  value={vitals.pulse}
                  onChange={(e) => setVitals((prev) => ({ ...prev, pulse: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-background-elevated border border-border rounded-lg text-foreground font-mono focus:border-teal-500"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-foreground-subtle block mb-0.5">Temp (°F)</label>
                <input
                  type="text"
                  placeholder="--"
                  value={vitals.temp}
                  onChange={(e) => setVitals((prev) => ({ ...prev, temp: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-background-elevated border border-border rounded-lg text-foreground font-mono focus:border-teal-500"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-foreground-subtle block mb-0.5">SpO2 (%)</label>
                <input
                  type="text"
                  placeholder="--"
                  value={vitals.spo2}
                  onChange={(e) => setVitals((prev) => ({ ...prev, spo2: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-background-elevated border border-border rounded-lg text-foreground font-mono focus:border-teal-500"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-foreground-subtle block mb-0.5">Weight (kg)</label>
                <input
                  type="text"
                  placeholder="--"
                  value={vitals.weight}
                  onChange={(e) => setVitals((prev) => ({ ...prev, weight: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-background-elevated border border-border rounded-lg text-foreground font-mono focus:border-teal-500"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-foreground-subtle block mb-0.5">Resp Rate (/min)</label>
                <input
                  type="text"
                  placeholder="--"
                  value={vitals.resp_rate}
                  onChange={(e) => setVitals((prev) => ({ ...prev, resp_rate: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-background-elevated border border-border rounded-lg text-foreground font-mono focus:border-teal-500"
                />
              </div>
            </div>
          </Panel>

          {/* Context-Aware History at a Glance */}
          <Panel padding="md">
            <SectionHeader icon={CalendarDays} title="History at a Glance" subtitle={isReturningPatient ? "Longitudinal Record" : "Encounter Facts"} />
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-2 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Chief Complaint & Duration</p>
                  <p className="text-xs text-foreground-subtle">
                    {consultation.clinical_facts?.symptoms
                      ? `${consultation.clinical_facts.symptoms.join(", ")} — ${consultation.clinical_facts.duration || "Current encounter"}`
                      : consultation.complaint_summary || "New Patient Consultation"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Medications Taken at Home</p>
                  <p className="text-xs text-foreground-subtle">
                    {Array.isArray(consultation.clinical_facts?.medications_taken) && consultation.clinical_facts.medications_taken.length > 0
                      ? consultation.clinical_facts.medications_taken.map((m: any) => `${m.drug_name} (${m.timing || 'at home'} - ${m.effect || 'taken'})`).join(", ")
                      : Array.isArray(consultation.patient_current_medications) && consultation.patient_current_medications.length > 0
                      ? consultation.patient_current_medications.map((m) => (typeof m === "string" ? m : (m as Record<string, any>).drug_name || "Medication")).join(", ")
                      : "None reported"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Exposures & Sick Contacts</p>
                  <p className="text-xs text-foreground-subtle">
                    {Array.isArray(consultation.clinical_facts?.exposures) && consultation.clinical_facts.exposures.length > 0
                      ? consultation.clinical_facts.exposures.join("; ")
                      : "No sick contacts reported"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Documented Negative Findings</p>
                  <p className="text-xs text-foreground-subtle">
                    {Array.isArray(consultation.clinical_facts?.negative_findings) && consultation.clinical_facts.negative_findings.length > 0
                      ? consultation.clinical_facts.negative_findings.join(", ")
                      : "None explicitly documented"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-2 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Extracted orders</p>
                  <p className="text-xs text-foreground-subtle">
                    {consultation.investigations && consultation.investigations.length > 0
                      ? consultation.investigations.join(", ")
                      : "No investigations or treatment orders yet."}
                  </p>
                </div>
              </div>
            </div>
          </Panel>

          <Panel padding="md">
            <SectionHeader icon={Coins} title="Billing Estimate" subtitle={clinicFees ? "From configured clinic fees" : "Indicative estimate (configure fees in settings)"} />
            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-foreground-subtle">Consultation fee</span>
                <span className="text-foreground tnum">{formatCurrency(estimate.base)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-subtle">Medications ({estimate.medCount})</span>
                <span className="text-foreground tnum">{formatCurrency(estimate.medCount * 25)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-subtle">Investigations ({estimate.invCount})</span>
                <span className="text-foreground tnum">{formatCurrency(estimate.invCount * 150)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-subtle">GST (18%)</span>
                <span className="text-foreground tnum">{formatCurrency(estimate.tax)}</span>
              </div>
              <div className="border-t border-border pt-2.5 flex items-center justify-between text-base font-semibold">
                <span className="text-foreground">Total</span>
                <span className="text-teal-400 tnum">{formatCurrency(estimate.total)}</span>
              </div>
            </div>
          </Panel>
        </div>

        {/* Center: Live Conversation & Workflow */}
        <div className="lg:col-span-6 space-y-5">
          {/* Ambient recorder strip */}
          <Panel padding="md">
            <SectionHeader
              icon={Mic}
              title="Ambient Scribe"
              subtitle="ClinicalScribe listens to Telugu, Hindi, or English"
              action={
                <Button variant="ghost" size="sm" onClick={onClear}>
                  Clear
                </Button>
              }
            />
            <div className="mt-4">
              <ConsultationRecorder
                consultationId={consultationId}
                appointmentId={appointmentId}
                onTranscribed={(data) => onDataChange(data as ConsultationData)}
                onClear={onClear}
              />
            </div>
          </Panel>

          {/* Workflow tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1" role="tablist" aria-label="Consultation sections">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const count =
                tab.id === "prescription"
                  ? consultation.medications?.length || 0
                  : tab.id === "orders"
                  ? consultation.investigations?.length || 0
                  : tab.id === "referral"
                  ? consultation.referrals?.length || 0
                  : 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  aria-selected={isActive}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all focus-ring",
                    isActive
                      ? "bg-teal-500 text-background"
                      : "text-foreground-subtle hover:text-foreground hover:bg-background-elevated border border-border"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none",
                        isActive ? "bg-background/20 text-background" : "bg-teal-500/15 text-teal-400"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <Panel padding="md" className="min-h-[420px]">
            {activeTab === "soap" && (
              <div className="space-y-4">
                <SectionHeader icon={FileText} title="Auto-Generated SOAP" subtitle="Review and edit before approving" />
                {(() => {
                  const meta = consultation.scribe_metadata;
                  if (!meta) return null;
                  const tier = meta.confidence_tier;
                  const warn = meta.confidence_warning;
                  const model = meta.model_used;
                  const execStatus = meta.execution_status;
                  const provider = meta.provider || meta.source_type;
                  const isLow = tier === "LOW";
                  const isMod = tier === "MODERATE";
                  return (
                    <div className="space-y-2">
                      {(isLow || isMod) && warn && (
                        <div className={cn("flex items-start gap-2.5 rounded-xl border p-3 text-xs", isLow ? "border-orange-500/40 bg-orange-500/10 text-orange-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300")}>
                          <AlertTriangle className={cn("w-4 h-4 mt-0.5 shrink-0", isLow ? "text-orange-400" : "text-amber-400")} />
                          <span>{warn}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-foreground-subtle">
                        <Badge variant={execStatus === "live" ? "teal" : "gray"} dot>
                          {execStatus === "live" ? "Live AI" : execStatus === "mock" ? "Mock" : (execStatus || "—")}
                        </Badge>
                        {model && <span>• {model}</span>}
                        {provider && <span>• {provider}</span>}
                        {meta.speech_recognition_confidence != null && (
                          <span>• STT {Math.round((meta.speech_recognition_confidence || 0) * 100)}%</span>
                        )}
                      </div>
                    </div>
                  );
                })()}
                <SOAPNoteEditor
                  consultation={consultation}
                  onApproved={onApproved}
                  allergyReviewed={isAllergyReviewed}
                  vitalsRecorded={isVitalsRecorded}
                  medicationsReviewed={isMedicationReviewed}
                  onRequestReviewAllergies={() => setShowAllergyModal(true)}
                  onRequestRecordVitals={() => {
                    const el = document.getElementById("structured-vitals-card");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  onRequestReviewMeds={() => setShowMedModal(true)}
                  safetyEvaluation={hasSafetyEvaluation}
                />
              </div>
            )}

            {activeTab === "prescription" && (
              <div className="space-y-4">
                <SectionHeader icon={Pill} title="Prescription (Rx)" />
                {consultation.medications && consultation.medications.length > 0 ? (
                  <div className="space-y-2">
                    {consultation.medications.map((m, idx) => (
                      <div key={idx} className="panel p-3 bg-background-elevated/50 border border-border">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{m.drug_name} {m.dosage}</span>
                          <Badge variant="teal">{m.frequency}</Badge>
                        </div>
                        <p className="text-xs text-foreground-subtle mt-1">
                          Duration: {m.duration} • {m.instructions}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border-strong bg-background-elevated/30 p-6 text-center">
                    <Pill className="w-5 h-5 text-foreground-subtle mx-auto mb-2" />
                    <p className="text-sm text-foreground-muted">No medications extracted yet.</p>
                    <p className="text-xs text-foreground-subtle mt-1">Start ambient recording or add them to the SOAP plan.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "orders" && (
              <div className="space-y-4">
                <SectionHeader icon={FlaskConical} title="Orders & Labs" />
                {consultation.investigations && consultation.investigations.length > 0 ? (
                  <div className="space-y-2">
                    {consultation.investigations.map((inv, idx) => (
                      <div key={idx} className="panel p-3 bg-background-elevated/50 border border-border flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{inv}</span>
                        <Button variant="secondary" size="sm">
                          Order
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border-strong bg-background-elevated/30 p-6 text-center">
                    <FlaskConical className="w-5 h-5 text-foreground-subtle mx-auto mb-2" />
                    <p className="text-sm text-foreground-muted">No investigations suggested.</p>
                    <p className="text-xs text-foreground-subtle mt-1">Add labs from the SOAP plan.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "referral" && (
              <div className="space-y-4">
                <SectionHeader icon={UserRound} title="Referrals" />
                {consultation.referrals && consultation.referrals.length > 0 ? (
                  <div className="space-y-2">
                    {consultation.referrals.map((r, idx) => (
                      <div key={idx} className="panel p-3 bg-background-elevated/50 border border-border">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{r.speciality}</span>
                          <Badge variant={r.urgency === "Urgent" ? "red" : "orange"}>{r.urgency}</Badge>
                        </div>
                        <p className="text-sm text-foreground-muted mt-1">{r.reason}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border-strong bg-background-elevated/30 p-6 text-center">
                    <UserRound className="w-5 h-5 text-foreground-subtle mx-auto mb-2" />
                    <p className="text-sm text-foreground-muted">No referrals suggested.</p>
                    <p className="text-xs text-foreground-subtle mt-1">The AI will surface specialty referrals as it analyzes the transcript.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "billing" && (
              <div className="space-y-4">
                <SectionHeader icon={Receipt} title="Billing Summary" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="panel p-3.5 bg-background-elevated/50 border border-border">
                    <p className="text-xs text-foreground-subtle">Subtotal</p>
                    <p className="text-lg font-semibold text-foreground tnum">{formatCurrency(estimate.subtotal)}</p>
                  </div>
                  <div className="panel p-3.5 bg-background-elevated/50 border border-border">
                    <p className="text-xs text-foreground-subtle">Tax (18%)</p>
                    <p className="text-lg font-semibold text-foreground tnum">{formatCurrency(estimate.tax)}</p>
                  </div>
                  <div className="panel p-3.5 bg-background-elevated/50 border border-border col-span-2">
                    <p className="text-xs text-foreground-subtle">Estimated Total</p>
                    <p className="text-2xl font-bold text-teal-400 tnum">{formatCurrency(estimate.total)}</p>
                  </div>
                </div>
                <p className="text-xs text-foreground-subtle">
                  Approve the SOAP note to generate the UPI invoice and prescription PDF.
                </p>
              </div>
            )}
          </Panel>

          {/* Live transcript */}
          <Panel padding="md">
            <SectionHeader icon={MessageSquare} title="Live Transcript" subtitle="Speaker-separated diarization" />
            <div className="mt-3 max-h-48 overflow-y-auto rounded-xl bg-background-elevated/50 border border-border p-3">
              {consultation.transcript_raw ? (
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {consultation.transcript_raw}
                </p>
              ) : (
                <div className="flex flex-col items-center text-center py-4">
                  <Mic className="w-5 h-5 text-foreground-subtle mb-2" />
                  <p className="text-sm text-foreground-subtle italic">
                    Start the ambient recorder to see the live transcript here.
                  </p>
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* Right: AI Panel */}
        <div className="lg:col-span-3 space-y-5">
          <Panel padding="md">
            <SectionHeader
              icon={Sparkles}
              title="AI Co-Pilot"
              subtitle="Always-visible assistant"
              action={<AIStatus state="running" label="On" />}
            />
            <div className="mt-4 space-y-3">
              <div className="panel p-3 bg-background-elevated/50 border border-border">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileCode className="w-4 h-4 text-blue-400" /> ICD-10 Suggestions
                </div>
                {consultation.diagnoses && consultation.diagnoses.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {consultation.diagnoses.map((d, idx) => (
                      <Badge key={idx} variant="blue" className={cn(d.is_provisional && "ring-1 ring-amber-500/40")}>
                        {d.code} <span className="text-foreground-subtle">{d.description}</span>
                        {d.is_provisional && <span className="text-amber-400 font-mono text-[9px] ml-1">PROVISIONAL</span>}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-foreground-subtle mt-2">No diagnoses yet.</p>
                )}
              </div>

              <div className="panel p-3 bg-background-elevated/50 border border-border">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Pill className="w-4 h-4 text-teal-400" /> Drug Suggestions
                </div>
                <p className="text-xs text-foreground-subtle mt-2">
                  {consultation.medications && consultation.medications.length > 0
                    ? `${consultation.medications.length} medication(s) extracted from transcript.`
                    : "No medications extracted yet."}
                </p>
              </div>

              <div className="panel p-3 bg-background-elevated/50 border border-border">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Clock className="w-4 h-4 text-orange-400" /> Follow-up
                </div>
                <p className="text-xs text-foreground-subtle mt-2">
                  {consultation.followup_days
                    ? `Suggested follow-up in ${consultation.followup_days} days.`
                    : "No follow-up interval suggested."}
                </p>
              </div>
            </div>
          </Panel>

          <SafetyFlagsPanel
            consultationId={consultation.consultation_id}
            medications={consultation.medications || []}
            patientId={consultation.patient_id}
            existingEvaluation={hasSafetyEvaluation ?? undefined}
          />

          <Panel padding="md">
            <SectionHeader icon={Activity} title="Agent Activity" subtitle="Live agent log feed" />
            {activityLoading ? (
              <div className="mt-3 flex items-center gap-2 text-xs text-foreground-subtle">
                <Activity className="w-3.5 h-3.5 animate-pulse text-teal-400" />
                Loading agent activity…
              </div>
            ) : activityItems.length > 0 ? (
              <ActivityFeed items={activityItems} className="mt-3" />
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-border bg-background-elevated/30 p-4 text-center">
                <Activity className="w-4 h-4 text-foreground-subtle mx-auto mb-1.5" />
                <p className="text-xs text-foreground-muted">No agent activity recorded yet for this consultation.</p>
                <p className="text-[11px] text-foreground-subtle mt-0.5">Actions logged by the agents will appear here in real time.</p>
              </div>
            )}
          </Panel>

          <Panel padding="md">
            <SectionHeader icon={ShieldCheck} title="Compliance" />
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-foreground-subtle">AI audit log</span>
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-subtle">Patient consent</span>
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-subtle">Prescription audit</span>
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {/* Allergy Assessment Modal */}
      {showAllergyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-background-panel border border-border-strong rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3>Allergy Assessment & Safety Review</h3>
              </div>
              <button
                onClick={() => setShowAllergyModal(false)}
                className="text-foreground-subtle hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-foreground-subtle">
              Document verified drug or food allergies, or confirm No Known Drug Allergies (NKDA).
            </p>

            {/* Quick Chips */}
            <div className="flex flex-wrap gap-1.5">
              {COMMON_ALLERGIES.map((alg) => {
                const isSelected = allergiesList.includes(alg);
                return (
                  <button
                    key={alg}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setAllergiesList(allergiesList.filter((a) => a !== alg));
                      } else {
                        setAllergiesList([...allergiesList.filter((a) => a !== "No Known Drug Allergies (NKDA)"), alg]);
                      }
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                      isSelected
                        ? "bg-red-500/20 border-red-500/50 text-red-300 font-semibold"
                        : "bg-background-elevated border-border text-foreground-muted hover:border-border-strong"
                    )}
                  >
                    {alg} {isSelected ? "✓" : "+"}
                  </button>
                );
              })}
            </div>

            {/* Detailed Custom Allergen Input */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input
                type="text"
                placeholder="Allergen substance..."
                value={allergySubstance}
                onChange={(e) => setAllergySubstance(e.target.value)}
                className="input-field col-span-2 text-xs py-1.5"
              />
              <select
                value={allergyReaction}
                onChange={(e) => setAllergyReaction(e.target.value)}
                className="input-field text-xs py-1.5"
              >
                <option value="Urticaria / Rash">Urticaria / Rash</option>
                <option value="Anaphylaxis">Anaphylaxis</option>
                <option value="Angioedema">Angioedema</option>
                <option value="Bronchospasm">Bronchospasm</option>
                <option value="GI Nausea / Vomiting">GI Upset</option>
              </select>
              <select
                value={allergySeverity}
                onChange={(e) => setAllergySeverity(e.target.value as any)}
                className="input-field text-xs py-1.5"
              >
                <option value="Mild">Mild</option>
                <option value="Moderate">Moderate</option>
                <option value="Severe">Severe / Life-Threatening</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                if (allergySubstance.trim()) {
                  const entry = `${allergySubstance.trim()} (${allergyReaction}, ${allergySeverity})`;
                  if (!allergiesList.includes(entry)) {
                    setAllergiesList([...allergiesList.filter(a => a !== "No Known Drug Allergies (NKDA)"), entry]);
                  }
                  setAllergySubstance("");
                }
              }}
              className="btn-secondary w-full py-1.5 text-xs flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Specific Allergy Entry
            </button>

            {/* NKDA button */}
            <button
              type="button"
              onClick={() => {
                setAllergiesList(["No Known Drug Allergies (NKDA)"]);
              }}
              className="w-full py-2 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Confirm No Known Drug Allergies (NKDA)
            </button>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => setShowAllergyModal(false)}
                className="btn-ghost text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingAssessment}
                onClick={() => handleSaveAllergies(allergiesList)}
                className="btn-primary text-xs px-4 py-1.5 font-semibold shadow-sm"
              >
                {savingAssessment ? "Saving..." : "Save Allergy Assessment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chronic Disease Assessment Modal */}
      {showChronicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-background-panel border border-border-strong rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <Activity className="w-5 h-5 text-blue-400" />
                <h3>Chronic Disease Assessment</h3>
              </div>
              <button
                onClick={() => setShowChronicModal(false)}
                className="text-foreground-subtle hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-foreground-subtle">
              Document pre-existing medical conditions, long-term comorbidities, or confirm no chronic history.
            </p>

            {/* Quick Chips */}
            <div className="flex flex-wrap gap-1.5">
              {COMMON_CHRONIC_CONDITIONS.map((cond) => {
                const isSelected = chronicList.includes(cond);
                return (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setChronicList(chronicList.filter((c) => c !== cond));
                      } else {
                        setChronicList([...chronicList.filter((c) => c !== "No Chronic Medical History"), cond]);
                      }
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                      isSelected
                        ? "bg-blue-500/20 border-blue-500/50 text-blue-300 font-semibold"
                        : "bg-background-elevated border-border text-foreground-muted hover:border-border-strong"
                    )}
                  >
                    {cond} {isSelected ? "✓" : "+"}
                  </button>
                );
              })}
            </div>

            {/* Custom Condition Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Other condition (e.g. Migraine, GERD)..."
                value={customCondition}
                onChange={(e) => setCustomCondition(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customCondition.trim()) {
                    e.preventDefault();
                    if (!chronicList.includes(customCondition.trim())) {
                      setChronicList([...chronicList.filter((c) => c !== "No Chronic Medical History"), customCondition.trim()]);
                    }
                    setCustomCondition("");
                  }
                }}
                className="input-field flex-1 text-xs py-1.5"
              />
              <button
                type="button"
                onClick={() => {
                  if (customCondition.trim() && !chronicList.includes(customCondition.trim())) {
                    setChronicList([...chronicList.filter((c) => c !== "No Chronic Medical History"), customCondition.trim()]);
                    setCustomCondition("");
                  }
                }}
                className="btn-secondary px-3 py-1.5 text-xs shrink-0"
              >
                Add
              </button>
            </div>

            {/* No Chronic History button */}
            <button
              type="button"
              onClick={() => {
                setChronicList(["No Chronic Medical History"]);
              }}
              className="w-full py-2 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Confirm No Chronic Medical History
            </button>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => setShowChronicModal(false)}
                className="btn-ghost text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingAssessment}
                onClick={() => handleSaveChronic(chronicList)}
                className="btn-primary text-xs px-4 py-1.5 font-semibold shadow-sm"
              >
                {savingAssessment ? "Saving..." : "Save Condition Assessment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Current Medication History Modal */}
      {showMedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-background-panel border border-border-strong rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <Pill className="w-5 h-5 text-teal-400" />
                <h3>Review Current Home Medications</h3>
              </div>
              <button
                onClick={() => setShowMedModal(false)}
                className="text-foreground-subtle hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-foreground-subtle">
              Record active ongoing home medications for drug-drug interaction screening, or confirm no current medications.
            </p>

            {/* Existing List */}
            {medicationList.length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {medicationList.map((m, idx) => (
                  <div key={idx} className="p-2 bg-background-elevated rounded-lg border border-border flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-foreground">{m.drug_name}</span> {m.dosage ? `(${m.dosage})` : ''}
                      <span className="text-2xs text-teal-400 font-mono ml-2">{m.frequency}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMedicationList(medicationList.filter((_, i) => i !== idx))}
                      className="text-foreground-subtle hover:text-red-400 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Medication Form */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input
                type="text"
                placeholder="Drug name (e.g. Metformin)..."
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                className="input-field col-span-2 text-xs py-1.5"
              />
              <input
                type="text"
                placeholder="Dose (e.g. 500mg)..."
                value={medDose}
                onChange={(e) => setMedDose(e.target.value)}
                className="input-field text-xs py-1.5"
              />
              <select
                value={medFreq}
                onChange={(e) => setMedFreq(e.target.value)}
                className="input-field text-xs py-1.5"
              >
                <option value="1-0-1">1-0-1 (BD)</option>
                <option value="1-0-0">1-0-0 (OD Morning)</option>
                <option value="0-0-1">0-0-1 (OD Night)</option>
                <option value="1-1-1">1-1-1 (TDS)</option>
                <option value="PRN">PRN (As Needed)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                if (medName.trim()) {
                  setMedicationList([
                    ...medicationList.filter(m => m.drug_name !== "No Active Current Medications"),
                    {
                      drug_name: medName.trim(),
                      dosage: medDose.trim() || "--",
                      frequency: medFreq,
                      route: medRoute,
                      duration: medDuration,
                      status: "Active"
                    }
                  ]);
                  setMedName("");
                  setMedDose("");
                }
              }}
              className="btn-secondary w-full py-1.5 text-xs flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Medication to List
            </button>

            {/* No Active Medications button */}
            <button
              type="button"
              onClick={() => {
                setMedicationList([{ drug_name: "No Active Current Medications", dosage: "--", frequency: "None" }]);
              }}
              className="w-full py-2 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Confirm No Active Home Medications
            </button>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => setShowMedModal(false)}
                className="btn-ghost text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingAssessment}
                onClick={() => handleSaveMedications(medicationList)}
                className="btn-primary text-xs px-4 py-1.5 font-semibold shadow-sm"
              >
                {savingAssessment ? "Saving..." : "Save Medication History"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FHIR R4 Encounter Export Modal */}
      <FHIRExportModal
        isOpen={showFHIRModal}
        onClose={() => setShowFHIRModal(false)}
        consultationId={consultationId}
        patientId={consultation.patient_id}
        patientName={consultation.patient_name || "Patient"}
      />

      {/* Longitudinal Patient Summary Modal */}
      <PatientSummaryModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        patientId={consultation.patient_id || ""}
        patientName={consultation.patient_name || "Patient"}
      />
    </div>
  );
}
