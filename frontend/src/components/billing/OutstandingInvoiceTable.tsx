import React from "react";
import { StatusBadge } from "../shared/StatusBadge";
import { AlertCircle, Send, CheckCircle2, Printer, Clock } from "lucide-react";
import clsx from "clsx";

export interface PendingInvoice {
  invoice_id: string;
  patient_name: string;
  patient_phone_masked: string;
  amount_rupees: number;
  due_date: string;
  days_overdue: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

interface OutstandingInvoiceTableProps {
  invoices: PendingInvoice[];
  onMarkPaid: (id: string) => void;
  onSendReminder: (id: string) => void;
  onPrint: (id: string) => void;
  className?: string;
}

export const OutstandingInvoiceTable: React.FC<OutstandingInvoiceTableProps> = ({
  invoices,
  onMarkPaid,
  onSendReminder,
  onPrint,
  className
}) => {
  return (
    <div className={clsx("bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4.5 space-y-3 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Outstanding Payments & Overdue Invoices</h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">Total Pending: {invoices.length}</span>
      </div>

      <div className="space-y-2">
        {invoices.map((inv) => (
          <div
            key={inv.invoice_id}
            className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs">{inv.invoice_id}</span>
                <span className="text-slate-300 font-semibold">• {inv.patient_name}</span>
                <StatusBadge
                  label={inv.days_overdue > 0 ? `${inv.days_overdue} Days Overdue` : "Due Today"}
                  variant={inv.days_overdue > 0 ? "error" : "warning"}
                  size="sm"
                />
              </div>

              <p className="text-[11px] text-slate-400 font-mono">
                {inv.patient_phone_masked} • Due Date: {inv.due_date}
              </p>
            </div>

            <div className="flex items-center gap-3 self-end md:self-center">
              <span className="text-sm font-bold text-amber-400 font-mono">₹{inv.amount_rupees}</span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onMarkPaid(inv.invoice_id)}
                  className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Mark Paid
                </button>

                <button
                  onClick={() => onSendReminder(inv.invoice_id)}
                  className="px-2.5 py-1 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1"
                >
                  <Send className="w-3 h-3 text-teal-400" /> Remind WA
                </button>

                <button
                  onClick={() => onPrint(inv.invoice_id)}
                  className="p-1 text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700 rounded-lg transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
