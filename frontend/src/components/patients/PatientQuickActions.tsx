import React from "react";
import Link from "next/link";
import { User, Stethoscope, FileText, Pill, Share2, Send, Sparkles } from "lucide-react";

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
  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className || ""}`}>
      <Link
        href={`/patients/${patientId}`}
        className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-white text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors"
      >
        <User className="w-3.5 h-3.5 text-teal-400" /> Open Profile
      </Link>

      <Link
        href={`/consultation/${patientId}`}
        className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors shadow-sm"
      >
        <Stethoscope className="w-3.5 h-3.5" /> Start Consult
      </Link>

      <Link
        href={`/patients/${patientId}#soap`}
        className="px-2 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-xs font-medium rounded-xl flex items-center gap-1 transition-colors"
      >
        <FileText className="w-3.5 h-3.5 text-blue-400" /> SOAP
      </Link>

      <Link
        href={`/patients/${patientId}#prescriptions`}
        className="px-2 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-xs font-medium rounded-xl flex items-center gap-1 transition-colors"
      >
        <Pill className="w-3.5 h-3.5 text-emerald-400" /> Rx
      </Link>

      <Link
        href={`/patients/${patientId}#referrals`}
        className="px-2 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-xs font-medium rounded-xl flex items-center gap-1 transition-colors"
      >
        <Share2 className="w-3.5 h-3.5 text-purple-400" /> Referral
      </Link>

      {onSendFollowup && (
        <button
          onClick={() => onSendFollowup(patientId)}
          className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-amber-300 text-xs font-medium rounded-xl flex items-center gap-1 transition-colors"
        >
          <Send className="w-3.5 h-3.5 text-amber-400" /> Follow-up
        </button>
      )}

      {onGenerateSummary && (
        <button
          onClick={() => onGenerateSummary(patientId)}
          className="px-2.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" /> AI Summary
        </button>
      )}
    </div>
  );
};
