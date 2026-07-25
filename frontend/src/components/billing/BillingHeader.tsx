import React from "react";
import { CreditCard, PlusCircle } from "lucide-react";
import { ExportPanel } from "../analytics/ExportPanel";

interface BillingHeaderProps {
  financialHealthScore: number;
  onNewInvoice: () => void;
  onExport: (type: "csv" | "json" | "pdf") => void;
  className?: string;
}

export const BillingHeader: React.FC<BillingHeaderProps> = ({
  financialHealthScore,
  onNewInvoice,
  onExport,
  className
}) => {
  return (
    <div className={`space-y-4 ${className || ""}`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-teal-400" />
            <h2 className="text-lg font-bold text-white">Financial Intelligence Center</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated Invoicing & UPI Collection Engine Managed by Agent 3 (BillingPulse) • Razorpay Integrated
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onNewInvoice}
            className="px-3.5 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-lg shadow-teal-500/10"
          >
            <PlusCircle className="w-4 h-4" /> Create Invoice
          </button>

          <ExportPanel onExport={onExport} />
        </div>
      </div>
    </div>
  );
};
