import React from "react";
import Link from "next/link";
import { Stethoscope, FileText, Pill, Share2, CreditCard, Send, Sparkles, Printer } from "lucide-react";
import clsx from "clsx";

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
  return (
    <div
      className={clsx(
        "sticky top-[60px] z-20 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none shadow-lg",
        className
      )}
    >
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
        <Link
          href={`/consultation/${patientId}`}
          className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-colors shadow-sm shrink-0"
        >
          <Stethoscope className="w-4 h-4" /> Start Consult
        </Link>

        <Link
          href={`/consultation/${patientId}?action=soap`}
          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/70 text-purple-300 text-xs font-semibold rounded-xl flex items-center gap-1 whitespace-nowrap transition-colors shrink-0"
        >
          <FileText className="w-3.5 h-3.5 text-purple-400" /> Generate SOAP
        </Link>

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
