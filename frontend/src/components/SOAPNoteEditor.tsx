import React, { useState, useCallback, useEffect } from "react";
import { ConsultationData } from "@/hooks/useConsultation";
import { CheckCircle2, FileCode, Printer, Check, Pill, Stethoscope, FileText, Sparkles, AlertTriangle, AlertOctagon, ShieldAlert, X } from "lucide-react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";
import { useToast } from "@/components/design-system";

export function SOAPNoteEditor({
  consultation,
  onApproved,
  allergyReviewed = false,
  vitalsRecorded = false,
  medicationsReviewed = false,
  onRequestReviewAllergies,
  onRequestRecordVitals,
  onRequestReviewMeds,
  safetyEvaluation
}: {
  consultation: ConsultationData;
  onApproved: (result: any) => void;
  allergyReviewed?: boolean;
  vitalsRecorded?: boolean;
  medicationsReviewed?: boolean;
  onRequestReviewAllergies?: () => void;
  onRequestRecordVitals?: () => void;
  onRequestReviewMeds?: () => void;
  safetyEvaluation?: any;
}) {
  const clinicId = useClinicStore((state) => state.clinicId);
  const { toast } = useToast();
  const [subjective, setSubjective] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`vaidyaai_draft_soap_${consultation.consultation_id}`);
      if (saved) {
        try { return JSON.parse(saved).subjective || consultation.soap_note?.subjective || ""; } catch (e) {}
      }
    }
    return consultation.soap_note?.subjective || "";
  });
  const [objective, setObjective] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`vaidyaai_draft_soap_${consultation.consultation_id}`);
      if (saved) {
        try { return JSON.parse(saved).objective || consultation.soap_note?.objective || ""; } catch (e) {}
      }
    }
    return consultation.soap_note?.objective || "";
  });
  const [assessment, setAssessment] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`vaidyaai_draft_soap_${consultation.consultation_id}`);
      if (saved) {
        try { return JSON.parse(saved).assessment || consultation.soap_note?.assessment || ""; } catch (e) {}
      }
    }
    return consultation.soap_note?.assessment || "";
  });
  const [plan, setPlan] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`vaidyaai_draft_soap_${consultation.consultation_id}`);
      if (saved) {
        try { return JSON.parse(saved).plan || consultation.soap_note?.plan || ""; } catch (e) {}
      }
    }
    return consultation.soap_note?.plan || "";
  });
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(consultation.status === "approved");

  // Safety Confirmation & Hard-Stop Modal State
  const [safetyModal, setSafetyModal] = useState<{
    open: boolean;
    type: "hard_stop_low_confidence" | "hard_stop_allergy" | "hard_stop_interaction" | "soft_warning_vitals" | "soft_warning_assessment" | "soft_warning_meds" | null;
    title: string;
    message: string;
    overrideReason?: string;
  }>({ open: false, type: null, title: "", message: "" });
  const [overrideText, setOverrideText] = useState("");
  const [overriding, setOverriding] = useState(false);
  const [transcriptVerified, setTranscriptVerified] = useState(false);

  // Synchronize state when consultation object or consultation_id changes
  useEffect(() => {
    let savedSoap: any = null;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`vaidyaai_draft_soap_${consultation.consultation_id}`);
      if (saved) {
        try { savedSoap = JSON.parse(saved); } catch (e) {}
      }
    }
    setSubjective(savedSoap?.subjective || consultation.soap_note?.subjective || "");
    setObjective(savedSoap?.objective || consultation.soap_note?.objective || "");
    setAssessment(savedSoap?.assessment || consultation.soap_note?.assessment || "");
    setPlan(savedSoap?.plan || consultation.soap_note?.plan || "");
    setApproved(consultation.status === "approved");
  }, [consultation.consultation_id, consultation.soap_note, consultation.status]);

  // Auto-save draft to localStorage on edit
  useEffect(() => {
    if (typeof window !== "undefined" && !approved) {
      localStorage.setItem(
        `vaidyaai_draft_soap_${consultation.consultation_id}`,
        JSON.stringify({ subjective, objective, assessment, plan })
      );
    }
  }, [subjective, objective, assessment, plan, consultation.consultation_id, approved]);

  const executeApproval = useCallback(async () => {
    if (!clinicId) return;
    try {
      setApproving(true);
      const res = await api.post(`/consultations/${consultation.consultation_id}/approve`, {
        clinic_id: clinicId,
        edited_soap: { subjective, objective, assessment, plan },
        consultation_type: "new",
        transcript_reviewed: transcriptVerified
      });
      if (res.data?.error) {
        toast(res.data.detail || res.data.error, "error", "clinical");
        return;
      }
      setApproved(true);
      if (typeof window !== "undefined") {
        localStorage.removeItem(`vaidyaai_draft_soap_${consultation.consultation_id}`);
      }
      onApproved(res.data);
      toast("SOAP approved & UPI invoice issued.", "success", "clinical");
      setSafetyModal({ open: false, type: null, title: "", message: "" });
    } catch (e: any) {
      console.error("Approve consultation error:", e);
      const detail = e?.response?.data?.detail;
      toast(detail || "Approval failed. Try again.", "error", "clinical");
    } finally {
      setApproving(false);
    }
  }, [clinicId, consultation.consultation_id, subjective, objective, assessment, plan, onApproved, toast, transcriptVerified]);

  const handleApprove = useCallback(() => {
    if (!clinicId) return;

    // 0. HARD STOP: Low STT confidence requires explicit clinician transcript verification
    const scribeMeta = (consultation as any).scribe_metadata;
    const isLowConfidence = scribeMeta?.confidence_tier === "LOW" || (typeof scribeMeta?.speech_recognition_confidence === "number" && scribeMeta.speech_recognition_confidence < 0.60);
    if (isLowConfidence && !transcriptVerified) {
      setSafetyModal({
        open: true,
        type: "hard_stop_low_confidence",
        title: "Mandatory Safety Stop: Low Speech Recognition Confidence (<60%)",
        message: "The ambient Speech-to-Text recognition confidence was below 60%. Medical safety policy requires direct clinician review and verification of the consultation transcript before approving clinical notes and prescriptions."
      });
      return;
    }

    // 1. HARD STOP: Allergy status must be reviewed before prescription issuance
    if (!allergyReviewed) {
      setSafetyModal({
        open: true,
        type: "hard_stop_allergy",
        title: "Mandatory Safety Stop: Allergy Review Required",
        message: "Clinical safety policy requires reviewing patient allergy status before approving prescriptions. Please confirm No Known Drug Allergies (NKDA) or record verified drug/food allergies."
      });
      return;
    }

    // 2. HARD STOP: Severe drug interaction or allergy conflict detected
    if (safetyEvaluation && !safetyEvaluation.is_safe && !safetyEvaluation.overridden) {
      setSafetyModal({
        open: true,
        type: "hard_stop_interaction",
        title: "Critical Safety Alert: Drug Interaction Detected",
        message: safetyEvaluation.safety_summary || "PrescriptionSafe identified potential adverse drug interactions or allergy conflicts. Document a clinical override reason to proceed."
      });
      return;
    }

    // 3. SOFT WARNING: Vitals not documented for this encounter
    if (!vitalsRecorded) {
      setSafetyModal({
        open: true,
        type: "soft_warning_vitals",
        title: "Clinical Notice: Vitals Not Documented",
        message: "Vitals have not been recorded for this encounter. Would you like to record vitals or continue with consultation sign-off?"
      });
      return;
    }

    // 4. SOFT WARNING: Clinical Assessment / Diagnosis empty
    if (!assessment.trim() && (!consultation.diagnoses || consultation.diagnoses.length === 0)) {
      setSafetyModal({
        open: true,
        type: "soft_warning_assessment",
        title: "Clinical Notice: Assessment Incomplete",
        message: "Clinical assessment and diagnosis codes have not been entered. Would you like to review or proceed with sign-off?"
      });
      return;
    }

    // 5. SOFT WARNING: Current Medications unreviewed
    if (!medicationsReviewed) {
      setSafetyModal({
        open: true,
        type: "soft_warning_meds",
        title: "Clinical Notice: Current Medications Unreviewed",
        message: "Patient's current home medication history has not been confirmed. Would you like to review or continue?"
      });
      return;
    }

    // All safety gates verified
    executeApproval();
  }, [
    clinicId,
    allergyReviewed,
    safetyEvaluation,
    vitalsRecorded,
    assessment,
    consultation,
    transcriptVerified,
    medicationsReviewed,
    executeApproval
  ]);

  const handleOverrideSubmit = async () => {
    if (!clinicId || !overrideText.trim()) return;
    try {
      setOverriding(true);
      await api.post(`/consultations/${consultation.consultation_id}/override-safety`, {
        clinic_id: clinicId,
        override_reason: overrideText.trim()
      });
      toast("Clinical override recorded in audit trail.", "info", "security");
      executeApproval();
    } catch (e) {
      console.error("Override error:", e);
      toast("Override failed. Please try again.", "error", "clinical");
    } finally {
      setOverriding(false);
    }
  };

  // Keyboard shortcuts (Cmd/Ctrl + S to Save, Cmd/Ctrl + Enter to Approve)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        toast("Draft SOAP note saved locally.", "info", "clinical");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !approved && !approving) {
        e.preventDefault();
        handleApprove();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [approved, approving, handleApprove, toast]);

  const handleDownloadPdf = () => {
    if (!clinicId || !consultation.consultation_id) return;
    const downloadUrl = `${api.defaults.baseURL || ""}/consultations/${consultation.consultation_id}/pdf?clinic_id=${clinicId}`;
    window.open(downloadUrl, "_blank");
    toast("Opening prescription PDF...", "info", "clinical");
  };

  return (
    <div className="space-y-4">
      {/* ClinicalScribe Telemetry Provenance Banner */}
      {(consultation as any).scribe_metadata && (
        <div className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border text-xs font-mono ${(consultation as any).scribe_metadata.execution_status === "failed" || (consultation as any).scribe_metadata.error_state ? "bg-red-500/10 border-red-500/30 text-red-300" : (consultation as any).scribe_metadata.mock ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-teal-500/10 border-teal-500/20 text-teal-300"}`}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
            <span>Generated By: <strong>{(consultation as any).scribe_metadata.generated_by || "ClinicalScribe"}</strong></span>
            <span className="text-teal-400/60">•</span>
            <span>Provider: <strong>{(consultation as any).scribe_metadata.provider || "Google Cloud Vertex AI"}</strong></span>
            <span className={`px-2 py-0.5 rounded text-2xs font-bold uppercase ${
              (consultation as any).scribe_metadata.execution_status === "failed" || (consultation as any).scribe_metadata.error_state
                ? "bg-red-500/20 text-red-300 border border-red-500/40"
                : (consultation as any).scribe_metadata.mock
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
            }`}>
              {(consultation as any).scribe_metadata.execution_status === "failed" || (consultation as any).scribe_metadata.error_state
                ? "AI Execution Failed"
                : (consultation as any).scribe_metadata.mock
                ? "Dev Mock — Not For Clinical Use"
                : "Execution: LIVE"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-2xs text-teal-300/80 flex-wrap">
            <span>Model: <strong>{(consultation as any).scribe_metadata.model_used || "gemini-2.5-pro"}</strong></span>
            <span>Location: <strong>{(consultation as any).scribe_metadata.location || (consultation as any).scribe_metadata.region || "us-central1"}</strong></span>
            <span>STT: <strong>{(consultation as any).scribe_metadata.stt_provider || "Google Cloud Speech-to-Text"}</strong></span>
            <span>Latency: <strong>{(consultation as any).scribe_metadata.latency_ms || (consultation as any).scribe_metadata.total_latency_ms ? `${(consultation as any).scribe_metadata.latency_ms || (consultation as any).scribe_metadata.total_latency_ms}ms` : "--"}</strong></span>
            <span>Speech Recognition Confidence: <strong>{(consultation as any).scribe_metadata.speech_recognition_confidence || (consultation as any).scribe_metadata.confidence_score ? `${Math.round(((consultation as any).scribe_metadata.speech_recognition_confidence || (consultation as any).scribe_metadata.confidence_score) * 100)}%` : "--"}</strong></span>
            <span>Generated At: <strong>{(consultation as any).scribe_metadata.generated_at ? new Date((consultation as any).scribe_metadata.generated_at).toLocaleTimeString() : "Recent"}</strong></span>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-border/40 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-bold text-foreground">Clinical SOAP Note & Prescription</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${approved ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-300 border-amber-500/30'}`}>
              {consultation.status.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-foreground-subtle">Review AI-extracted clinical notes, ICD-10 coding, and Rx orders before signing off.</p>
        </div>

        <div className="flex items-center gap-3">
          {approved ? (
            <>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Approved & Invoice Issued
              </span>
              <button
                onClick={handleDownloadPdf}
                className="btn-primary text-xs flex items-center gap-1.5 px-3.5 py-2 shadow-sm"
              >
                <Printer className="w-4 h-4" /> Download PDF Prescription
              </button>
            </>
          ) : (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="btn-primary text-xs flex items-center gap-1.5 px-4 py-2 shadow-sm disabled:opacity-50"
            >
              {approving ? "Approving & Issuing Invoice..." : <>Approve SOAP & Issue UPI Invoice <Check className="w-4 h-4" /></>}
            </button>
          )}
        </div>
      </div>

      {/* STT Confidence / Transcription Quality Alert Banner */}
      {(consultation as any).scribe_metadata?.confidence_warning && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-amber-300">Speech-to-Text Recognition Quality Notice</p>
            <p className="text-foreground-subtle">{(consultation as any).scribe_metadata.confidence_warning}</p>
          </div>
        </div>
      )}

      {/* Extracted Allergy Alert Banner */}
      {Array.isArray((consultation as any).patient_allergies) && (consultation as any).patient_allergies.length > 0 && !(consultation as any).patient_allergies.includes("No Known Drug Allergies (NKDA)") && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-200">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-red-300">Patient-Reported Drug Allergy Detected</p>
            <p className="text-foreground-subtle">
              Encounter dialogue documented allergy to: <strong className="text-red-200">{(consultation as any).patient_allergies.join(", ")}</strong>. Please verify prescription safety before sign-off.
            </p>
          </div>
        </div>
      )}

      {/* Grid: SOAP Form (Left) & Diagnoses/Medications (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: SOAP Text Areas */}
        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="text-label text-teal-400 flex items-center gap-1.5 font-semibold">
              <FileText className="w-3.5 h-3.5" /> Subjective (S) — Patient Symptoms & History
            </label>
            <textarea
              rows={3}
              value={subjective}
              onChange={(e) => setSubjective(e.target.value)}
              className="input-field min-h-[85px] text-xs focus:ring-1 focus:ring-teal-500"
              placeholder="Patient reports fever, chills, cough..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-label text-teal-400 flex items-center gap-1.5 font-semibold">
              <FileText className="w-3.5 h-3.5" /> Objective (O) — Vitals & Physical Examination
            </label>
            <textarea
              rows={3}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="input-field min-h-[85px] text-xs focus:ring-1 focus:ring-teal-500"
              placeholder="Physical examination and vitals (e.g. general appearance, chest, CVS)..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-label text-teal-400 flex items-center gap-1.5 font-semibold">
              <FileText className="w-3.5 h-3.5" /> Assessment (A) — Diagnosis & Clinical Impression
            </label>
            <textarea
              rows={3}
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
              className="input-field min-h-[85px] text-xs focus:ring-1 focus:ring-teal-500"
              placeholder="Acute Upper Respiratory Tract Infection..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-label text-teal-400 flex items-center gap-1.5 font-semibold">
              <FileText className="w-3.5 h-3.5" /> Plan (P) — Treatment, Rx & Follow-Up
            </label>
            <textarea
              rows={3}
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="input-field min-h-[85px] text-xs focus:ring-1 focus:ring-teal-500"
              placeholder="Prescribed Paracetamol 650mg, hydration, 3-day follow-up..."
            />
          </div>
        </div>

        {/* Right Column: ICD-10 Diagnoses & Medications */}
        <div className="space-y-3.5">
          <div className="panel p-4 bg-background-elevated/50 border border-border rounded-2xl space-y-3 shadow-xs">
            <div className="text-label text-teal-400 flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold">
                <FileCode className="w-4 h-4" /> ICD-10 Diagnoses
              </span>
              <span className="text-2xs text-foreground-subtle font-mono">Agent 2 Extracted</span>
            </div>
            {consultation.diagnoses && consultation.diagnoses.length > 0 ? (
              <div className="space-y-2">
                {consultation.diagnoses.map((d, idx) => (
                  <div key={idx} className="p-2.5 bg-background-input rounded-xl border border-border flex items-center justify-between text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-foreground">{d.description}</span>
                      {d.is_provisional && (
                        <span className="text-[10px] text-amber-400 font-mono font-medium">AI SUGGESTION / PROVISIONAL</span>
                      )}
                    </div>
                    <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-300 font-mono rounded-md text-2xs shrink-0">{d.code || "ICD-10"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-foreground-subtle italic">No explicit ICD-10 diagnoses extracted.</p>
            )}
          </div>

          <div className="panel p-4 bg-background-elevated/50 border border-border rounded-2xl space-y-3 shadow-xs">
            <div className="text-label text-teal-400 flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold">
                <Pill className="w-4 h-4" /> Extracted Medications (Rx)
              </span>
              <span className="text-2xs text-foreground-subtle font-mono">Agent 5 Audited</span>
            </div>
            {consultation.medications && consultation.medications.length > 0 ? (
              <div className="space-y-2">
                {consultation.medications.map((m, idx) => (
                  <div key={idx} className="p-3 bg-background-input rounded-xl border border-border space-y-1 text-xs">
                    <div className="flex items-center justify-between font-bold text-foreground">
                      <span>{m.drug_name} ({m.dosage})</span>
                      <span className="text-teal-400 font-mono">{m.frequency}</span>
                    </div>
                    <p className="text-foreground-subtle text-2xs">Duration: {m.duration} • Instructions: {m.instructions}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-foreground-subtle italic">No medications extracted.</p>
            )}
          </div>
        </div>
      </div>

      {/* Clinical Safety Pre-Flight Dialog */}
      {safetyModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-background-panel border border-border-strong rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                {safetyModal.type === "hard_stop_low_confidence" && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                {safetyModal.type === "hard_stop_allergy" && <AlertOctagon className="w-5 h-5 text-red-400" />}
                {safetyModal.type === "hard_stop_interaction" && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                {safetyModal.type?.startsWith("soft_warning") && <ShieldAlert className="w-5 h-5 text-blue-400" />}
                <h3 className="text-sm font-bold">{safetyModal.title}</h3>
              </div>
              <button
                onClick={() => setSafetyModal({ open: false, type: null, title: "", message: "" })}
                className="text-foreground-subtle hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-foreground leading-relaxed">
              {safetyModal.message}
            </p>

            {/* Hard Stop Low Confidence: Clinician Verification */}
            {safetyModal.type === "hard_stop_low_confidence" && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
                <p className="text-2xs text-amber-300">
                  Please review the consultation transcript and confirm you have verified the dialogue accuracy.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setTranscriptVerified(true);
                    setSafetyModal({ open: false, type: null, title: "", message: "" });
                    executeApproval();
                  }}
                  className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> I Have Verified The Transcript — Approve SOAP
                </button>
              </div>
            )}

            {/* Hard Stop Allergy: Review button */}
            {safetyModal.type === "hard_stop_allergy" && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2">
                <p className="text-2xs text-red-300">
                  Prescription issuance is locked until allergy status is verified. Click below to review allergies or confirm NKDA.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSafetyModal({ open: false, type: null, title: "", message: "" });
                    if (onRequestReviewAllergies) onRequestReviewAllergies();
                  }}
                  className="w-full py-2 px-3 bg-red-500 hover:bg-red-400 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <ShieldAlert className="w-4 h-4" /> Review Allergies Now
                </button>
              </div>
            )}

            {/* Hard Stop Interaction: Override Form */}
            {safetyModal.type === "hard_stop_interaction" && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5">
                <label className="text-2xs font-semibold uppercase text-amber-300 block">
                  Document Clinical Override Rationale
                </label>
                <textarea
                  rows={2}
                  value={overrideText}
                  onChange={(e) => setOverrideText(e.target.value)}
                  placeholder="e.g., Patient monitored on this combination previously without adverse reaction..."
                  className="input-field text-xs py-1.5 focus:ring-amber-500"
                />
                <button
                  type="button"
                  disabled={overriding || !overrideText.trim()}
                  onClick={handleOverrideSubmit}
                  className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {overriding ? "Recording Override..." : "Submit Override & Approve Prescription"}
                </button>
              </div>
            )}

            {/* Soft Warnings Actions */}
            {safetyModal.type?.startsWith("soft_warning") && (
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => {
                    setSafetyModal({ open: false, type: null, title: "", message: "" });
                    if (safetyModal.type === "soft_warning_vitals" && onRequestRecordVitals) {
                      onRequestRecordVitals();
                    } else if (safetyModal.type === "soft_warning_meds" && onRequestReviewMeds) {
                      onRequestReviewMeds();
                    }
                  }}
                  className="btn-ghost text-xs px-3 py-1.5"
                >
                  {safetyModal.type === "soft_warning_vitals" ? "Record Vitals" : "Review Section"}
                </button>
                <button
                  type="button"
                  disabled={approving}
                  onClick={() => executeApproval()}
                  className="btn-primary text-xs px-4 py-1.5 font-semibold shadow-sm"
                >
                  {approving ? "Approving..." : "Continue Approval"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
