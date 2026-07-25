import React from "react";
import { KPICard } from "../shared/KPICard";
import { IndianRupee, CreditCard, Activity, Clock, CheckCircle2, AlertCircle, ShoppingBag, ArrowDownLeft } from "lucide-react";

export interface FinancialMetrics {
  revenue_today: number;
  revenue_week: number;
  revenue_month: number;
  outstanding_amount: number;
  collected_today: number;
  collection_rate_pct: number;
  pending_invoices_count: number;
  avg_bill_value_rupees: number;
  refunds_count: number;
}

interface FinancialKPICardProps {
  metrics: FinancialMetrics;
  className?: string;
}

export const FinancialKPICard: React.FC<FinancialKPICardProps> = ({ metrics, className }) => {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 ${className || ""}`}>
      <KPICard title="Revenue Today" value={`₹${metrics.revenue_today}`} subtitle="Collected today" icon={IndianRupee} color="teal" trend="+18%" />
      <KPICard title="Revenue Week" value={`₹${metrics.revenue_week}`} subtitle="Past 7 days" icon={CreditCard} color="emerald" />
      <KPICard title="Revenue Month" value={`₹${metrics.revenue_month}`} subtitle="Current month" icon={Activity} color="blue" />
      <KPICard title="Outstanding" value={`₹${metrics.outstanding_amount}`} subtitle="Pending collections" icon={AlertCircle} color={metrics.outstanding_amount > 0 ? "amber" : "emerald"} />
      <KPICard title="Collected Today" value={`₹${metrics.collected_today}`} subtitle="Razorpay UPI + Cash" icon={CheckCircle2} color="emerald" />
      <KPICard title="Collection Rate" value={`${metrics.collection_rate_pct}%`} subtitle="100% On-time" icon={Activity} color="teal" />
      <KPICard title="Pending Invoices" value={metrics.pending_invoices_count} subtitle="Awaiting UPI link pay" icon={Clock} color="purple" />
      <KPICard title="Avg Bill Value" value={`₹${metrics.avg_bill_value_rupees}`} subtitle="Per consultation" icon={ShoppingBag} color="indigo" />
      <KPICard title="Refunds & Waivers" value={metrics.refunds_count} subtitle="₹0 refunded" icon={ArrowDownLeft} color="slate" />
    </div>
  );
};
