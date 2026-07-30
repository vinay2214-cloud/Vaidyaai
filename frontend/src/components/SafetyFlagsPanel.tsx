"use client";

import React, { useState } from "react";
import { ShieldAlert, ShieldCheck, AlertTriangle, AlertOctagon, Shield } from "lucide-react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";
import { Panel, SectionHeader, Button } from "@/components/design-system";
import { cn } from "@/lib/cn";

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
      <Panel padding="md">
        <SectionHeader
          icon={Shield}
          title="Agent 5: PrescriptionSafe"
          subtitle="Drug interaction & allergy audit"
          action={
            <Button
              variant="secondary"
              size="sm"
              isLoading={loading}
              onClick={handleCheckSafety}
              disabled={loading || !medications || medications.length === 0}
            >
              Run Safety Check
            </Button>
          }
        />
      </Panel>
    );
  }

  const severityColors: Record<string, { variant: "red" | "orange" | "blue" | "gray"; icon: any; text: string }> = {
    CRITICAL: { variant: "red", icon: AlertOctagon, text: "text-red-400" },
    HIGH: { variant: "orange", icon: AlertTriangle, text: "text-orange-400" },
    MEDIUM: { variant: "orange", icon: AlertTriangle, text: "text-orange-400" },
    LOW: { variant: "blue", icon: ShieldAlert, text: "text-blue-400" },
  };

  const panelBorder = evaluation.is_safe || evaluation.overridden ? "border-green-500/30" : "border-red-500/30";

  return (
    <Panel padding="md" className={cn("border", panelBorder)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {evaluation.is_safe ? (
            <ShieldCheck className="w-5 h-5 text-green-400" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-red-400" />
          )}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              PrescriptionSafe Audit
            </h4>
            <p className="text-xs text-foreground-subtle">{evaluation.warnings_count} warnings</p>
          </div>
        </div>
        {evaluation.overridden && (
          <span className="text-xs px-2 py-0.5 bg-orange-500/10 border border-orange-500/30 text-orange-300 rounded-md font-mono">
            Doctor Overridden
          </span>
        )}
      </div>

      <p className="text-sm text-foreground-muted mt-3">{evaluation.safety_summary}</p>

      {evaluation.warnings && evaluation.warnings.length > 0 && (
        <div className="space-y-2 mt-3">
          {evaluation.warnings.map((w, idx) => {
            const style = severityColors[w.severity] || severityColors.MEDIUM;
            const Icon = style.icon;
            return (
              <div
                key={idx}
                className={cn(
                  "p-3 rounded-xl border space-y-1 text-xs",
                  style.variant === "red" && "bg-red-500/10 border-red-500/30",
                  style.variant === "orange" && "bg-orange-500/10 border-orange-500/30",
                  style.variant === "blue" && "bg-blue-500/10 border-blue-500/30"
                )}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className={cn("flex items-center gap-1.5", style.text)}>
                    <Icon className="w-3.5 h-3.5" /> [{w.severity}] {w.type}
                  </span>
                  <span className="text-foreground-subtle font-mono">{w.drugs_involved.join(" + ")}</span>
                </div>
                <p className="text-foreground">{w.message}</p>
                <p className="text-foreground-subtle italic">Recommendation: {w.recommendation}</p>
              </div>
            );
          })}
        </div>
      )}

      {!evaluation.is_safe && !evaluation.overridden && (
        <div className="pt-3 border-t border-border space-y-2 mt-3">
          <label className="text-label">Clinical Reason to Override Warning *</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Patient monitored, benefits outweigh interaction risk"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="input-field"
            />
            <Button
              onClick={handleOverride}
              disabled={isOverriding || !overrideReason.trim()}
              isLoading={isOverriding}
              variant="secondary"
              size="sm"
            >
              Override
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
