import React from "react";
import { StatusBadge } from "../shared/StatusBadge";
import { FileText, Printer, Download, Share2, Eye, CreditCard } from "lucide-react";
import clsx from "clsx";

export interface InvoiceData {
  invoice_id: string;
  patient_name: string;
  patient_phone_masked: string;
  visit_date: string;
  amount_rupees: number;
  payment_method: string;
  payment_status: "paid" | "pending" | "waived";
  created_by: string;
}

interface InvoiceCardProps {
  invoice: InvoiceData;
  onView?: (id: string) => void;
  onPrint?: (id: string) => void;
  onDownload?: (id: string) => void;
  onShare?: (id: string) => void;
  className?: string;
}

export const InvoiceCard: React.FC<InvoiceCardProps> = ({
  invoice,
  onView,
  onPrint,
  onDownload,
  onShare,
  className
}) => {
  const isPaid = invoice.payment_status === "paid";

  return (
    <div className={clsx("bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm hover:border-slate-600 transition-colors text-xs", className)}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center text-teal-400 font-bold shrink-0">
          <CreditCard className="w-5 h-5" />
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold text-white text-xs">{invoice.invoice_id}</h4>
            <span className="text-slate-300 font-semibold">• {invoice.patient_name}</span>
            <StatusBadge
              label={invoice.payment_status.toUpperCase()}
              variant={isPaid ? "success" : invoice.payment_status === "pending" ? "warning" : "neutral"}
              size="sm"
            />
          </div>

          <p className="text-[11px] text-slate-400 font-mono">
            {invoice.patient_phone_masked} • Visit: {invoice.visit_date} • Created by: {invoice.created_by}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 self-end md:self-center">
        <div className="text-right font-mono">
          <span className="font-bold text-teal-400 text-sm block">₹{invoice.amount_rupees}</span>
          <span className="text-[10px] text-slate-400">{invoice.payment_method}</span>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1">
          {onView && (
            <button onClick={() => onView(invoice.invoice_id)} className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-700 rounded-lg transition-colors">
              <Eye className="w-3.5 h-3.5" />
            </button>
          )}

          {onPrint && (
            <button onClick={() => onPrint(invoice.invoice_id)} className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-700 rounded-lg transition-colors">
              <Printer className="w-3.5 h-3.5" />
            </button>
          )}

          {onDownload && (
            <button onClick={() => onDownload(invoice.invoice_id)} className="p-1.5 text-slate-400 hover:text-teal-400 bg-slate-900 border border-slate-700 rounded-lg transition-colors">
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          {onShare && (
            <button onClick={() => onShare(invoice.invoice_id)} className="p-1.5 text-slate-400 hover:text-emerald-400 bg-slate-900 border border-slate-700 rounded-lg transition-colors">
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
