"use client";

import React, { useState } from "react";
import { useBilling } from "@/hooks/useBilling";
import { CreditCard, DollarSign, Download, CheckCircle, Clock, FileText } from "lucide-react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";

export default function BillingPage() {
  const { summary, loading, refresh } = useBilling();
  const clinicId = useClinicStore((state) => state.clinicId);
  const [marking, setMarking] = useState<string | null>(null);

  const handleMarkCash = async (invoiceId: string) => {
    if (!clinicId) return;
    try {
      setMarking(invoiceId);
      await api.post("/billing/mark-cash", {
        clinic_id: clinicId,
        invoice_id: invoiceId
      });
      refresh();
    } catch (e) {
      console.error("Mark cash error:", e);
    } finally {
      setMarking(null);
    }
  };

  const handleExportCsv = async () => {
    if (!clinicId) return;
    window.open(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/api/v1/billing/export-csv?clinic_id=${clinicId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-teal-400" />
            <h2 className="text-lg font-bold text-white">Billing & Financials</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">Managed by Agent 3 (BillingPulse) • Auto UPI links & daily P&L</p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Export Invoices CSV
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3.5">
          <span className="text-xs font-semibold text-slate-400 uppercase">Total Billed</span>
          <p className="text-xl font-bold text-white mt-1">₹{summary?.total_billed_rupees.toFixed(2) || "0.00"}</p>
        </div>
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3.5">
          <span className="text-xs font-semibold text-slate-400 uppercase">Collected</span>
          <p className="text-xl font-bold text-emerald-400 mt-1">₹{summary?.total_collected_rupees.toFixed(2) || "0.00"}</p>
        </div>
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3.5">
          <span className="text-xs font-semibold text-slate-400 uppercase">UPI / Online</span>
          <p className="text-xl font-bold text-teal-400 mt-1">₹{summary?.upi_collected_rupees.toFixed(2) || "0.00"}</p>
        </div>
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3.5">
          <span className="text-xs font-semibold text-slate-400 uppercase">Pending</span>
          <p className="text-xl font-bold text-amber-400 mt-1">₹{summary?.pending_rupees.toFixed(2) || "0.00"}</p>
        </div>
      </div>

      {/* Invoice List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-300">Today's Invoices</h3>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-slate-800/50 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : !summary || summary.invoices.length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-500">
            No invoices generated today. Invoices are automatically generated when consultations are completed.
          </div>
        ) : (
          summary.invoices.map((inv: any) => (
            <div
              key={inv.invoice_id}
              className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-teal-400">{inv.invoice_number}</span>
                  <span className="text-xs font-semibold text-white">₹{inv.amount_rupees.toFixed(2)}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      inv.status === "paid"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {inv.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Patient: {inv.patient_phone_masked} • {inv.consultation_type}
                </p>
              </div>

              {inv.status === "pending" && (
                <button
                  onClick={() => handleMarkCash(inv.invoice_id)}
                  disabled={marking === inv.invoice_id}
                  className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-xl transition-colors"
                >
                  Mark Cash Paid
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
