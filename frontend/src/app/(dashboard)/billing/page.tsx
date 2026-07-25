"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";
import { useBilling } from "@/hooks/useBilling";
import { BillingHeader } from "@/components/billing/BillingHeader";
import { FinancialKPICard, FinancialMetrics } from "@/components/billing/FinancialKPICard";
import { RevenueChart } from "@/components/analytics/RevenueChart";
import { OutstandingInvoiceTable, PendingInvoice } from "@/components/billing/OutstandingInvoiceTable";
import { PaymentAnalyticsCard } from "@/components/billing/PaymentAnalyticsCard";
import { BillingInsightCard, BillingPulseInsights } from "@/components/billing/BillingInsightCard";
import { InvoiceCard, InvoiceData } from "@/components/billing/InvoiceCard";
import { PaymentHistoryCard, PaymentTransaction } from "@/components/billing/PaymentHistoryCard";
import { FinancialQualityCard } from "@/components/billing/FinancialQualityCard";
import { BillingSidebar } from "@/components/billing/BillingSidebar";
import { FinancialSkeleton } from "@/components/billing/FinancialSkeleton";

export default function FinancialIntelligencePage() {
  const clinicId = useClinicStore((state) => state.clinicId);
  const { summary, loading: summaryLoading } = useBilling();
  const [loading, setLoading] = useState(true);

  // Safety Timeout: Never lock UI in infinite skeleton loading if backend is offline
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const metrics: FinancialMetrics = {
    revenue_today: summary?.total_collected_rupees || 9500,
    revenue_week: 35400,
    revenue_month: 142000,
    outstanding_amount: summary?.pending_rupees || 1200,
    collected_today: summary?.total_collected_rupees || 9500,
    collection_rate_pct: 100,
    pending_invoices_count: 2,
    avg_bill_value_rupees: 500,
    refunds_count: 0
  };

  const pendingInvoices: PendingInvoice[] = [
    {
      invoice_id: "VDY-20260725-0014",
      patient_name: "Anita Verma",
      patient_phone_masked: "+91XXXXXX8890",
      amount_rupees: 500,
      due_date: "25-Jul-2026",
      days_overdue: 0,
      priority: "MEDIUM"
    },
    {
      invoice_id: "VDY-20260724-0010",
      patient_name: "Suresh Patel",
      patient_phone_masked: "+91XXXXXX4512",
      amount_rupees: 700,
      due_date: "24-Jul-2026",
      days_overdue: 1,
      priority: "HIGH"
    }
  ];

  const insights: BillingPulseInsights = {
    generated_at: "Today, 10:45 AM IST",
    revenue_forecast: "₹42,500 expected over next 7 days (+12% growth)",
    revenue_risks: [
      "2 overdue invoices totaling ₹1,200 pending > 24 hours.",
      "Cash payments require manual marking at end of day."
    ],
    collection_opportunities: [
      "Sending automated WhatsApp UPI link reminder recovers 90% of pending bills within 2 hours.",
      "Package consultation + HbA1c lab combo fee increases average bill value by ₹350."
    ],
    delayed_payments: [
      "Suresh Patel (VDY-20260724-0010) — 1 day overdue."
    ],
    recommendations: [
      "Enable instant Razorpay UPI QR display on clinic checkout tablet.",
      "Trigger Agent 3 (BillingPulse) 9 PM IST daily automated P&L report."
    ]
  };

  const sampleInvoices: InvoiceData[] = [
    {
      invoice_id: "VDY-20260725-0012",
      patient_name: "Ramesh Sharma",
      patient_phone_masked: "+91XXXXXX3210",
      visit_date: "25-Jul-2026",
      amount_rupees: 500,
      payment_method: "Razorpay UPI",
      payment_status: "paid",
      created_by: "Agent 3 (BillingPulse)"
    },
    {
      invoice_id: "VDY-20260725-0013",
      patient_name: "Priya Nair",
      patient_phone_masked: "+91XXXXXX7711",
      visit_date: "25-Jul-2026",
      amount_rupees: 800,
      payment_method: "Razorpay UPI",
      payment_status: "paid",
      created_by: "Agent 3 (BillingPulse)"
    }
  ];

  const transactions: PaymentTransaction[] = [
    {
      id: "tx_1",
      invoice_id: "VDY-20260725-0012",
      patient_name: "Ramesh Sharma",
      amount_rupees: 500,
      method: "UPI (pay_Q9Z128x)",
      timestamp: "Today, 10:22 AM",
      status: "success"
    },
    {
      id: "tx_2",
      invoice_id: "VDY-20260725-0013",
      patient_name: "Priya Nair",
      amount_rupees: 800,
      method: "UPI (pay_Q9Z129y)",
      timestamp: "Today, 10:40 AM",
      status: "success"
    }
  ];

  const handleExport = (type: "csv" | "json" | "pdf") => {
    if (type === "csv") {
      window.open(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/api/v1/billing/export-csv?clinic_id=${clinicId || "clinic_1"}`);
    } else if (type === "json") {
      const dataStr = JSON.stringify({ metrics, invoices: sampleInvoices }, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VaidyaAI_Financial_Audit_${clinicId || "clinic"}.json`;
      a.click();
    } else {
      alert("Downloading Executive Financial Report PDF...");
    }
  };

  if (loading && summaryLoading) {
    return <FinancialSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <BillingHeader
        financialHealthScore={98}
        onNewInvoice={() => alert("Creating new manual invoice...")}
        onExport={handleExport}
      />

      {/* SECTION 1: Financial KPI Bar */}
      <FinancialKPICard metrics={metrics} />

      {/* SECTION 5: BillingPulse Insights */}
      <BillingInsightCard insights={insights} />

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Primary Financial Workspaces */}
        <div className="lg:col-span-2 space-y-4">
          {/* SECTION 2: Revenue Dashboard */}
          <RevenueChart />

          {/* SECTION 3: Outstanding Payments */}
          <OutstandingInvoiceTable
            invoices={pendingInvoices}
            onMarkPaid={(id) => alert(`Invoice ${id} marked cash paid`)}
            onSendReminder={(id) => alert(`WhatsApp payment reminder sent for invoice ${id}`)}
            onPrint={(id) => alert(`Printing invoice ${id}...`)}
          />

          {/* SECTION 4: Payment Analytics & Method Breakdown */}
          <PaymentAnalyticsCard />

          {/* SECTION 6: Invoice Management List */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Recent Invoices</h3>
            {sampleInvoices.map((inv) => (
              <InvoiceCard
                key={inv.invoice_id}
                invoice={inv}
                onView={(id) => alert(`Viewing invoice ${id}`)}
                onPrint={(id) => alert(`Printing invoice ${id}`)}
                onDownload={(id) => alert(`Downloading PDF for ${id}`)}
                onShare={(id) => alert(`Sharing invoice ${id} on WhatsApp`)}
              />
            ))}
          </div>

          {/* SECTION 7: Payment History */}
          <PaymentHistoryCard transactions={transactions} />

          {/* SECTION 8: Financial Quality Metrics */}
          <FinancialQualityCard />
        </div>

        {/* SECTION 10: Right Sidebar (BillingPulse Status & Alerts) */}
        <div className="space-y-4">
          <BillingSidebar />
        </div>
      </div>
    </div>
  );
}
