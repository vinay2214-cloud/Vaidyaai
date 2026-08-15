"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Download, FileText, X, Loader2, ShieldCheck, Sparkles, AlertTriangle, Pill, Stethoscope, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";

interface PatientSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName?: string;
}

export function PatientSummaryModal({
  isOpen,
  onClose,
  patientId,
  patientName = "Patient",
}: PatientSummaryModalProps) {
  const clinicId = useClinicStore((state) => state.clinicId);
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!patientId || !clinicId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/consultations/patient-summary/${patientId}?clinic_id=${clinicId}`);
      setSummaryData(res.data);
    } catch (err: any) {
      console.error("Patient summary fetch error:", err);
      setError(err?.response?.data?.detail || "Could not fetch longitudinal patient summary.");
    } finally {
      setLoading(false);
    }
  }, [patientId, clinicId]);

  useEffect(() => {
    if (isOpen && patientId && clinicId) {
      fetchSummary();
    }
  }, [isOpen, patientId, clinicId, fetchSummary]);

  if (!isOpen) return null;

  // Normalize the backend's grounded summary shape into the display model.
  // The backend returns structured objects (allergen/reaction, description,
  // drug_name/dosage/frequency) rather than plain strings, so we map them here
  // to avoid rendering objects as React children.
  const allergies = (summaryData?.allergies || []).map((a: any) =>
    typeof a === "string" ? a : a?.allergen || ""
  ).filter(Boolean);
  const conditions = (summaryData?.active_conditions || []).map((c: any) =>
    typeof c === "string" ? c : c?.description || ""
  ).filter(Boolean);
  const medications = summaryData?.medication_history || [];
  const narrative = summaryData?.summary_text || "";

  const handleDownload = () => {
    if (!summaryData) return;
    const content = `# Longitudinal Clinical Patient Summary\n**Patient ID:** ${summaryData.patient_id}\n**Generated:** ${summaryData.generated_at}\n\n## Allergies\n${allergies.join(", ") || "None documented"}\n\n## Chronic Conditions\n${conditions.join(", ") || "None documented"}\n\n## Active Medications\n${medications.map((m: any) => `- ${m.drug_name} (${m.dosage})`).join("\n") || "None documented"}\n\n## Clinical Narrative\n${narrative || "No narrative available."}`;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Patient_Summary_${patientId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Longitudinal Patient Summary
                <span className="px-2 py-0.5 text-[10px] font-mono bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">
                  AI Grounded
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Synthesized across all reviewed consultations for {patientName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              <p className="text-xs font-medium">Assembling longitudinal record and clinical timeline...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex flex-col gap-2">
              <span className="font-bold">Failed to Load Patient Summary</span>
              <span>{error}</span>
              <button
                onClick={fetchSummary}
                className="self-start px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg text-xs font-semibold mt-1"
              >
                Retry
              </button>
            </div>
          )}

          {summaryData && !loading && (
            <>
              {summaryData.summary_generated === false && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs">
                  No clinician-reviewed consultations are available yet, so a
                  longitudinal summary cannot be synthesized. Facts are only
                  included after a clinician reviews and confirms the encounter.
                </div>
              )}
              {/* Provenance & Generation Meta */}
              <div className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-700/50 rounded-xl text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Synthesized by <strong>ClinicalScribe</strong> • Verified Patient ID: <code className="text-teal-300">{summaryData.patient_id}</code></span>
                </div>
                <button
                  onClick={fetchSummary}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              {/* Clinical Sections Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Allergies */}
                <div className="p-4 bg-slate-800/30 border border-slate-700/40 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Documented Allergies
                  </h4>
                  {allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {allergies.map((a: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/30 text-rose-200 rounded text-xs font-semibold">
                          {a}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No documented drug or food allergies.</p>
                  )}
                </div>

                {/* Chronic Conditions */}
                <div className="p-4 bg-slate-800/30 border border-slate-700/40 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5" /> Chronic Medical Conditions
                  </h4>
                  {conditions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {conditions.map((c: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded text-xs font-semibold">
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No chronic conditions documented.</p>
                  )}
                </div>
              </div>

              {/* Active Medications */}
              <div className="p-4 bg-slate-800/30 border border-slate-700/40 rounded-xl space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5" /> Current / Recent Medications
                </h4>
                {medications.length > 0 ? (
                  <div className="space-y-1.5">
                    {medications.map((m: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-800/60 rounded-lg text-xs">
                        <span className="font-semibold text-white">{m.drug_name}</span>
                        <span className="text-slate-400 font-mono">{m.dosage || "--"} • {m.frequency || "--"}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No active medication prescriptions on file.</p>
                )}
              </div>

              {/* Narrative Summary */}
              <div className="p-4 bg-slate-800/30 border border-slate-700/40 rounded-xl space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Synthesized Clinical Overview
                </h4>
                <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-line">
                  {narrative || "No reviewed encounters available to synthesize summary."}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span>Longitudinal Record Grounded</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={!summaryData || loading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-40 shadow-sm"
            >
              <Download className="w-4 h-4" /> Download Summary (MD)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
