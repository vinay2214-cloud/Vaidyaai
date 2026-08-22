"use client";

import React from "react";
import { Panel, SectionHeader, Badge } from "@/components/design-system";
import { CreditCard, Banknote, Smartphone, QrCode } from "lucide-react";
import { cn } from "@/lib/cn";

export interface PatientInvoiceItem {
  invoice_id: string;
  invoice_number: string;
  amount_rupees: number;
  consultation_type?: string | null;
  status: string;
  payment_method?: string | null;
  created_at?: string | null;
  paid_at?: string | null;
}

interface PatientBillingCardProps {
  invoices: PatientInvoiceItem[];
  totalPaid: number;
  outstanding: number;
  className?: string;
}

const METHOD_ICON: Record<string, React.ElementType> = {
  cash: Banknote,
  upi: QrCode,
  card: CreditCard,
  whatsapp: Smartphone,
};

function formatCurrency(rupees: number): string {
  return `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

/**
 * A patient's full invoice history.
 *
 * The clinic-wide billing screen is bounded to the current day, so a patient's
 * past invoices were unreachable from their record — "has this patient settled
 * their previous visits?" could not be answered without leaving the chart.
 */
export function PatientBillingCard({
  invoices,
  totalPaid,
  outstanding,
  className,
}: PatientBillingCardProps) {
  const allSettled = invoices.length > 0 && outstanding === 0;

  return (
    <Panel padding="md" className={cn(className)}>
      <SectionHeader
        icon={CreditCard}
        title="Billing & Invoices"
        subtitle="Agent 3 (BillingPulse)"
        action={
          invoices.length > 0 ? (
            <Badge variant={allSettled ? "green" : "orange"} dot>
              {allSettled ? "All settled" : `${formatCurrency(outstanding)} outstanding`}
            </Badge>
          ) : undefined
        }
      />

      {invoices.length === 0 ? (
        <div className="mt-4 py-6 text-center">
          <p className="text-sm text-foreground-muted">No invoices raised yet.</p>
          <p className="text-xs text-foreground-subtle mt-1">
            An invoice is issued automatically when a consultation is approved.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {invoices.map((inv) => {
              const isPaid = inv.status === "paid";
              const method = (inv.payment_method || "").toLowerCase();
              const MethodIcon = METHOD_ICON[method] || CreditCard;
              return (
                <div
                  key={inv.invoice_id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background-elevated/60 px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground font-mono">
                        {inv.invoice_number}
                      </span>
                      <Badge variant={isPaid ? "green" : "orange"} className="text-[10px]">
                        {isPaid ? "Paid" : inv.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2.5 text-xs text-foreground-subtle flex-wrap">
                      {inv.payment_method && (
                        <span className="inline-flex items-center gap-1 capitalize">
                          <MethodIcon className="w-3 h-3" aria-hidden="true" />
                          {inv.payment_method}
                        </span>
                      )}
                      <span>{isPaid ? `Paid ${formatDate(inv.paid_at)}` : `Raised ${formatDate(inv.created_at)}`}</span>
                      {inv.consultation_type && (
                        <span className="capitalize">{inv.consultation_type}</span>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-bold tnum shrink-0",
                      isPaid ? "text-emerald-400" : "text-amber-300"
                    )}
                  >
                    {formatCurrency(inv.amount_rupees)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-sm">
            <span className="text-foreground-muted">
              {invoices.length} invoice{invoices.length === 1 ? "" : "s"} · lifetime collected
            </span>
            <span className="font-bold text-emerald-400 tnum">{formatCurrency(totalPaid)}</span>
          </div>
        </>
      )}
    </Panel>
  );
}
