import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Stethoscope, FileText, Share2, CreditCard, Send, Sparkles, Printer, Loader2 } from "lucide-react";
import clsx from "clsx";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";

interface QuickActionsBarProps {
  patientId: string;
  onGenerateSummary?: () => void;
  onSendFollowup?: () => void;
  className?: string;
}

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({
  patientId,
  onGenerateSummary,
  onSendFollowup,
  className
}) => {
  const router = useRouter();
  const clinicId = useClinicStore((state) => state.clinicId);
  const resetConsultation = useClinicStore((state) => state.resetConsultation);
  const setActiveConsultation = useClinicStore((state) => state.setActiveConsultation);
  const [starting, setStarting] = useState(false);

  const handleStartConsult = async () => {
    if (!clinicId) return;
    try {
      setStarting(true);
      resetConsultation();

      // 1. Create walk-in/appointment entry for patient
      const apptRes = await api.post("/appointments/walk-in", {
        clinic_id: clinicId,
        patient_phone: patientId,
        complaint_summary: "Follow-up Consultation",
        consultation_type: "followup"
      });

      const appointmentId = apptRes.data.appointment_id;

      // 2. Start fresh consultation
      const consRes = await api.post("/consultations/start", {
        clinic_id: clinicId,
        appointment_id: appointmentId
      });

      const newConsId = consRes.data.consultation_id;
      setActiveConsultation(newConsId, patientId, appointmentId);

      router.push(`/consultation/${newConsId}?appointment_id=${appointmentId}`);
    } catch (e) {
      console.error("Error starting consultation:", e);
      alert("Could not start consultation. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div
      className={clsx(
        "sticky top-[60px] z-20 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none shadow-lg",
        className
      )}
    >
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
        <button
          onClick={handleStartConsult}
          disabled={starting}
          className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-colors shadow-sm shrink-0 disabled:opacity-50"
        >
          {starting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Starting...
            </>
          ) : (
            <>
              <Stethoscope className="w-4 h-4" /> Start Consult
            </>
          )}
        </button>

        <button
          onClick={handleStartConsult}
          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/70 text-purple-300 text-xs font-semibold rounded-xl flex items-center gap-1 whitespace-nowrap transition-colors shrink-0"
        >
          <FileText className="w-3.5 h-3.5 text-purple-400" /> Generate SOAP
        </button>

        <button
          onClick={() => alert(`Printing Prescription Rx PDF for Patient ID: ${patientId}`)}
          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/70 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-1 whitespace-nowrap transition-colors shrink-0"
        >
          <Printer className="w-3.5 h-3.5 text-emerald-400" /> Print Rx
        </button>

        <button
          onClick={() => alert(`Opening Referral Letter Generator for Patient ID: ${patientId}`)}
          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/70 text-purple-300 text-xs font-semibold rounded-xl flex items-center gap-1 whitespace-nowrap transition-colors shrink-0"
        >
          <Share2 className="w-3.5 h-3.5 text-purple-400" /> Create Referral
        </button>

        <button
          onClick={() => alert(`Generating Invoice PDF & UPI Payment Link for Patient ID: ${patientId}`)}
          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/70 text-amber-300 text-xs font-semibold rounded-xl flex items-center gap-1 whitespace-nowrap transition-colors shrink-0"
        >
          <CreditCard className="w-3.5 h-3.5 text-amber-400" /> Create Invoice
        </button>

        {onSendFollowup && (
          <button
            onClick={onSendFollowup}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/70 text-blue-300 text-xs font-semibold rounded-xl flex items-center gap-1 whitespace-nowrap transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5 text-blue-400" /> Send Follow-up
          </button>
        )}

        {onGenerateSummary && (
          <button
            onClick={onGenerateSummary}
            className="px-2.5 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-bold rounded-xl flex items-center gap-1 whitespace-nowrap transition-colors shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-400" /> AI Summary
          </button>
        )}
      </div>
    </div>
  );
};
