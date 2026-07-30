"use client";

import React, { useState } from "react";
import { ConsultationData } from "@/hooks/useConsultation";
import { CheckCircle2, FileCode, Printer, Check, Pill } from "lucide-react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";
import { useToast } from "@/components/design-system";

export function SOAPNoteEditor({
  consultation,
  onApproved
}: {
  consultation: ConsultationData;
  onApproved: (result: any) => void;
}) {
  const clinicId = useClinicStore((state) => state.clinicId);
  const { toast } = useToast();
  const [subjective, setSubjective] = useState(consultation.soap_note?.subjective || "");
  const [objective, setObjective] = useState(consultation.soap_note?.objective || "");
  const [assessment, setAssessment] = useState(consultation.soap_note?.assessment || "");
  const [plan, setPlan] = useState(consultation.soap_note?.plan || "");
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(consultation.status === "approved");

  const handleApprove = async () => {
    if (!clinicId) return;
    try {
      setApproving(true);
      const res = await api.post(`/consultations/${consultation.consultation_id}/approve`, {
        clinic_id: clinicId,
        edited_soap: { subjective, objective, assessment, plan },
        consultation_type: "new"
      });
      setApproved(true);
      onApproved(res.data);
      toast("SOAP approved & UPI invoice issued.", "success");
    } catch (e) {
      console.error("Approve consultation error:", e);
      toast("Approval failed. Try again.", "error");
    } finally {
      setApproving(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!clinicId) return;
    window.open(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/api/v1/consultations/${consultation.consultation_id}/pdf?clinic_id=${clinicId}`);
  };

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="text-label text-teal-400">Status: {consultation.status.toUpperCase()}</span>
          <p className="text-sm font-semibold text-foreground">Clinical SOAP Note & Prescription</p>
        </div>

        <div className="flex items-center gap-3">
          {approved ? (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-green-500/10 text-green-400 border-green-500/30">
                <CheckCircle2 className="w-4 h-4" /> Approved & Invoice Generated
              </span>
              <button
                onClick={handleDownloadPdf}
                className="btn-primary text-xs"
              >
                <Printer className="w-4 h-4" /> Download PDF Prescription
              </button>
            </>
          ) : (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="btn-primary text-xs disabled:opacity-50"
            >
              {approving ? "Approving & Issuing Invoice..." : <>Approve SOAP & Issue UPI Invoice <Check className="w-4 h-4" /></>}
            </button>
          )}
        </div>
      </div>

      {/* Grid: SOAP Form (Left) & Diagnoses/Medications (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: SOAP Text Areas */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-label text-teal-400">Subjective (S)</label>
            <textarea
              rows={3}
              value={subjective}
              onChange={(e) => setSubjective(e.target.value)}
              className="input-field min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-label text-teal-400">Objective (O)</label>
            <textarea
              rows={3}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="input-field min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-label text-teal-400">Assessment (A)</label>
            <textarea
              rows={3}
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
              className="input-field min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-label text-teal-400">Plan (P)</label>
            <textarea
              rows={3}
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="input-field min-h-[80px]"
            />
          </div>
        </div>

        {/* Right Column: ICD-10 Diagnoses & Medications */}
        <div className="space-y-4">
          <div className="panel p-4 bg-background-elevated/50 border border-border space-y-3">
            <div className="text-label text-teal-400 flex items-center gap-2">
              <FileCode className="w-4 h-4" /> ICD-10 Diagnoses
            </div>
            {consultation.diagnoses && consultation.diagnoses.length > 0 ? (
              <div className="space-y-2">
                {consultation.diagnoses.map((d, idx) => (
                  <div key={idx} className="p-2.5 bg-background-input rounded-xl border border-border flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{d.description}</span>
                    <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-300 font-mono rounded-md">{d.code || "ICD-10"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-foreground-subtle">No explicit diagnoses extracted.</p>
            )}
          </div>

          <div className="panel p-4 bg-background-elevated/50 border border-border space-y-3">
            <div className="text-label text-teal-400 flex items-center gap-2">
              <Pill className="w-4 h-4" /> Extracted Medications (Rx)
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
              <p className="text-xs text-foreground-subtle">No medications extracted.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
