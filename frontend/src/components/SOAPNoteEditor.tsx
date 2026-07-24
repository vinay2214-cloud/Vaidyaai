"use client";

import React, { useState } from "react";
import { ConsultationData } from "@/hooks/useConsultation";
import { SafetyFlagsPanel } from "./SafetyFlagsPanel";
import { CheckCircle2, FileText, Pill, Stethoscope, FileCode, Printer, Check } from "lucide-react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";

export function SOAPNoteEditor({
  consultation,
  onApproved
}: {
  consultation: ConsultationData;
  onApproved: (result: any) => void;
}) {
  const clinicId = useClinicStore((state) => state.clinicId);
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
    } catch (e) {
      console.error("Approve consultation error:", e);
      alert("Approval failed. Try again.");
    } finally {
      setApproving(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!clinicId) return;
    window.open(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/api/v1/consultations/${consultation.consultation_id}/pdf?clinic_id=${clinicId}`);
  };

  return (
    <div className="space-y-6">
      {/* Action Bar Header */}
      <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-2xl p-4">
        <div>
          <span className="text-xs font-mono text-teal-400 font-bold uppercase">Status: {consultation.status.toUpperCase()}</span>
          <h2 className="text-base font-bold text-white mt-0.5">Clinical SOAP Note & Prescription</h2>
        </div>

        <div className="flex items-center gap-3">
          {approved ? (
            <>
              <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Approved & Invoice Generated
              </span>
              <button
                onClick={handleDownloadPdf}
                className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-4 h-4" /> Download PDF Prescription
              </button>
            </>
          ) : (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {approving ? "Approving & Issuing Invoice..." : <>Approve SOAP Note & Issue UPI Invoice <Check className="w-4 h-4" /></>}
            </button>
          )}
        </div>
      </div>

      {/* PrescriptionSafe Agent Safety Panel */}
      <SafetyFlagsPanel
        consultationId={consultation.consultation_id}
        medications={consultation.medications}
        existingEvaluation={(consultation as any).safety_evaluation}
      />

      {/* Grid: SOAP Form (Left) & Diagnoses/Medications (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: SOAP Text Areas */}
        <div className="space-y-4">
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-2">
            <label className="block text-xs font-bold uppercase text-teal-400">Subjective (S)</label>
            <textarea
              rows={3}
              value={subjective}
              onChange={(e) => setSubjective(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-2">
            <label className="block text-xs font-bold uppercase text-teal-400">Objective (O)</label>
            <textarea
              rows={3}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-2">
            <label className="block text-xs font-bold uppercase text-teal-400">Assessment (A)</label>
            <textarea
              rows={3}
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-2">
            <label className="block text-xs font-bold uppercase text-teal-400">Plan (P)</label>
            <textarea
              rows={3}
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        {/* Right Column: ICD-10 Diagnoses & Medications */}
        <div className="space-y-4">
          {/* Diagnoses Panel */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-400 uppercase">
              <FileCode className="w-4 h-4" /> ICD-10 Diagnoses
            </div>
            {consultation.diagnoses && consultation.diagnoses.length > 0 ? (
              <div className="space-y-2">
                {consultation.diagnoses.map((d, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{d.description}</span>
                    <span className="px-2 py-0.5 bg-teal-500/10 border border-teal-500/30 text-teal-300 font-mono rounded-md">{d.code || "ICD-10"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No explicit diagnoses extracted.</p>
            )}
          </div>

          {/* Medications Panel */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-400 uppercase">
              <Pill className="w-4 h-4" /> Extracted Medications (Rx)
            </div>
            {consultation.medications && consultation.medications.length > 0 ? (
              <div className="space-y-2">
                {consultation.medications.map((m, idx) => (
                  <div key={idx} className="p-3 bg-slate-900 rounded-xl border border-slate-700 space-y-1 text-xs">
                    <div className="flex items-center justify-between font-bold text-white">
                      <span>{m.drug_name} ({m.dosage})</span>
                      <span className="text-teal-400 font-mono">{m.frequency}</span>
                    </div>
                    <p className="text-slate-400 text-2xs">Duration: {m.duration} • Instructions: {m.instructions}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No medications extracted.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
