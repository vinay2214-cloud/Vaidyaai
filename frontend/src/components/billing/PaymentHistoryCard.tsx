import React from "react";
import { Clock, CheckCircle2, RefreshCw, ArrowUpRight } from "lucide-react";
import clsx from "clsx";

export interface PaymentTransaction {
  id: string;
  invoice_id: string;
  patient_name: string;
  amount_rupees: number;
  method: string;
  timestamp: string;
  status: "success" | "refunded" | "discounted";
}

interface PaymentHistoryCardProps {
  transactions: PaymentTransaction[];
  className?: string;
}

export const PaymentHistoryCard: React.FC<PaymentHistoryCardProps> = ({ transactions, className }) => {
  return (
    <div className={clsx("bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4.5 space-y-3 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-teal-400" />
          <h3 className="text-sm font-bold text-white">Payment & Collections History</h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">Total Transactions: {transactions.length}</span>
      </div>

      <div className="space-y-2">
        {transactions.map((tx) => (
          <div key={tx.id} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white font-mono">{tx.invoice_id}</span>
                <span className="text-slate-300 font-semibold">• {tx.patient_name}</span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                {tx.method} • {tx.timestamp}
              </p>
            </div>

            <div className="text-right font-mono">
              <span className="font-bold text-emerald-400 block text-xs">+₹{tx.amount_rupees}</span>
              <span className="text-[10px] text-slate-500 uppercase">{tx.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
