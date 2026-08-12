import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Stethoscope, FileText, Pill, Share2, Send, Sparkles, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";

interface PatientQuickActionsProps {
  patientId: string;
  patientName: string;
  patientPhoneMasked: string;
  onGenerateSummary?: (patientId: string) => void;
  onSendFollowup?: (patientId: string) => void;
  className?: string;
}

export const PatientQuickActions: React.FC<PatientQuickActionsProps> = ({
  patientId,
  patientName,
  onGenerateSummary,
  onSendFollowup,
  className
}) => {
  const router = useRouter();
  const clinicId = useClinicStore((state) => state.clinicId);
  const [starting, setStarting] = useState(false);
  const actionBase = "px-3 py-2 min-h-[2.25rem] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50";

  const handleStartConsult = async () => {
    if (!clinicId) return;
    try {
      setStarting(true);
      useClinicStore.getState().resetConsultation();

      const apptRes = await api.post("/appointments/walk-in", {
        clinic_id: clinicId,
        patient_id: patientId,
        complaint_summary: "Follow-up Consultation",
        consultation_type: "followup"
      });

      const appointmentId = apptRes.data.appointment_id;

      const consRes = await api.post("/consultations/start", {
        clinic_id: clinicId,
        appointment_id: appointmentId
      });

      const newConsId = consRes.data.consultation_id;
      useClinicStore.getState().setActiveConsultation(newConsId, patientId, appointmentId);

      router.push(`/consultation/${newConsId}?appointment_id=${appointmentId}`);
    } catch (e) {
      console.error("Error starting consultation:", e);
      alert("Could not start consultation. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className || ""}`}>
      <Link
        href={`/patients/${patientId}`}
        className={`${actionBase} bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-white`}
      >
        <User className="w-3.5 h-3.5 text-teal-400" /> Open Profile
      </Link>

      <button
        onClick={handleStartConsult}
        disabled={starting}
        className={`${actionBase} bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-sm disabled:opacity-50`}
      >
        {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Stethoscope className="w-3.5 h-3.5" />}
        Start Consult
      </button>

      <Link
        href={`/patients/${patientId}#soap`}
        className={`${actionBase} bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300`}
      >
        <FileText className="w-3.5 h-3.5 text-blue-400" /> SOAP
      </Link>

      <Link
        href={`/patients/${patientId}#prescriptions`}
        className={`${actionBase} bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300`}
      >
        <Pill className="w-3.5 h-3.5 text-emerald-400" /> Rx
      </Link>

      <Link
        href={`/patients/${patientId}#referrals`}
        className={`${actionBase} bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300`}
      >
        <Share2 className="w-3.5 h-3.5 text-purple-400" /> Referral
      </Link>

      {onSendFollowup && (
        <button
          onClick={() => onSendFollowup(patientId)}
          className={`${actionBase} bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-amber-300`}
        >
          <Send className="w-3.5 h-3.5 text-amber-400" /> Follow-up
        </button>
      )}

      {onGenerateSummary && (
        <button
          onClick={() => onGenerateSummary(patientId)}
          className={`${actionBase} bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold`}
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" /> AI Summary
        </button>
      )}
    </div>
  );
};
