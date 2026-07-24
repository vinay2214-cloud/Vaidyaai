"use client";

import React, { useState } from "react";
import { ShieldAlert, ShieldCheck, AlertTriangle, AlertOctagon, Check, Shield } from "lucide-react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";

export interface Warning {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  type: string;
  drugs_involved: string[];
  message: string;
  recommendation: string;
}

export interface SafetyEvaluation {
  is_safe: boolean;
  confidence_score: number;
  warnings_count: number;
  warnings: Warning[];
  safety_summary: string;
  overridden?: boolean;
  override_reason?: string;
}

export function SafetyFlagsPanel({
  consultationId,
  medications,
  patientId,
  existingEvaluation,
  onEvaluationUpdated
}: {
  consultationId: string;
  medications: any[];
  patientId?: string;
  existingEvaluation?: SafetyEvaluation;
  onEvaluationUpdated?: (evalData: SafetyEvaluation) => void;
}) {
  const clinicId = useClinicStore((state) => state.clinicId);
  const [evaluation, setEvaluation] = useState<SafetyEvaluation | undefined>(existingEvaluation);
  const [loading, setLoading] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [isOverriding, setIsOverriding] = useState(false);

  const handleCheckSafety = async () => {
    if (!clinicId || !medications || medications.length === 0) return;
    try {
      setLoading(true);
      const res = await api.post(`/consultations/${consultationId}/check-safety`, {
        clinic_id: clinicId,
        medications: medications,
        patient_id: patientId
      });
      setEvaluation(res.data);
      if (onEvaluationUpdated) onEvaluationUpdated(res.data);
    } catch (e) {
      console.error("Safety check error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async () => {
    if (!clinicId || !overrideReason.trim()) return;
    try {
      setIsOverriding(true);
      await api.post(`/consultations/${consultationId}/override-safety`, {
        clinic_id: clinicId,
        override_reason: overrideReason
      });
      const updated = {
        ...evaluation!,
        overridden: true,
        override_reason: overrideReason
      };
      setEvaluation(updated);
      if (onEvaluationUpdated) onEvaluationUpdated(updated);
    } catch (e) {
      console.error("Override error:", e);
    } finally {
      setIsOverriding(false);
    }
  };

  if (!evaluation) {
    return (
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase">
          <Shield className="w-4 h-4" /> Agent 5: PrescriptionSafe
        </div>
        <button
          onClick={handleCheckSafety}
          disabled={loading || !medications || medications.length === 0}
          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          {loading ? "Evaluating Safety..." : "Run Drug Interaction Check"}
        </button>
      </div>
    );
  }

  const severityColors: Record<string, { bg: string; border: string; text: string; icon: any }> = {
    CRITICAL: { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400", icon: AlertOctagon },
    HIGH: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", icon: AlertTriangle },
    MEDIUM: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", icon: AlertTriangle },
    LOW: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", icon: ShieldAlert }
  };

  return (
    <div className={`border rounded-2xl p-4 space-y-3 ${
      evaluation.is_safe || evaluation.overridden
        ? "bg-slate-800/80 border-emerald-500/30"
        : "bg-rose-950/20 border-rose-500/40"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {evaluation.is_safe ? (
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-rose-400" />
          )}
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            Agent 5: PrescriptionSafe Audit ({evaluation.warnings_count} Warnings)
          </h4>
        </div>
        {evaluation.overridden && (
          <span className="text-xs px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-md font-mono">
            Doctor Overridden
          </span>
        )}
      </div>

      <p className="text-xs text-slate-300 font-medium">{evaluation.safety_summary}</p>

      {evaluation.warnings && evaluation.warnings.length > 0 && (
        <div className="space-y-2 mt-2">
          {evaluation.warnings.map((w, idx) => {
            const style = severityColors[w.severity] || severityColors.MEDIUM;
            const Icon = style.icon;
            return (
              <div key={idx} className={`p-3 rounded-xl border ${style.bg} ${style.border} space-y-1 text-xs`}>
                <div className="flex items-center justify-between font-bold">
                  <span className={`flex items-center gap-1.5 ${style.text}`}>
                    <Icon className="w-3.5 h-3.5" /> [{w.severity}] {w.type}
                  </span>
                  <span className="text-slate-400 font-mono">{w.drugs_involved.join(" + ")}</span>
                </div>
                <p className="text-slate-200">{w.message}</p>
                <p className="text-slate-400 italic">Recommendation: {w.recommendation}</p>
              </div>
            );
          })}
        </div>
      )}

      {!evaluation.is_safe && !evaluation.overridden && (
        <div className="pt-2 border-t border-slate-700/60 space-y-2">
          <label className="block text-xs text-slate-400">Clinical Reason to Override Warning *</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Patient monitored, benefits outweigh interaction risk"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={handleOverride}
              disabled={isOverriding || !overrideReason.trim()}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              Override Warning
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
