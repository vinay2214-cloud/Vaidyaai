"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useClinicStore } from "@/store/clinicStore";
import { useBilling } from "@/hooks/useBilling";
import { useToast, Panel, SectionHeader, Badge, ActivityFeed, ActivityItem, AIStatus, Button, PatientAvatar } from "@/components/design-system";
import { cn } from "@/lib/cn";
import {
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  CreditCard,
  Banknote,
  Smartphone,
  FileDown,
  Plus,
  CheckCircle2,
  Clock,
  Sparkles,
  Coins,
  TrendingUp,
  AlertTriangle,
  QrCode,
  ShieldCheck,
  Send,
  X,
  ExternalLink,
} from "lucide-react";
import api from "@/lib/api";
import { BACKEND_URL } from "@/lib/constants";

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Canonical invoice lifecycle, aligned with the backend statuses
// (generated -> sent -> pending -> paid, with waived as a terminal state).
const LIFECYCLE_STAGES = [
  "Generated",
  "Sent",
  "Pending",
  "Paid",
];

function PaymentModal({
  invoice,
  onClose,
  onConfirmPayment,
  onWhatsAppAction,
}: {
  invoice: any;
  onClose: () => void;
  onConfirmPayment: (invoiceId: string, method: string, notes?: string) => Promise<void>;
  onWhatsAppAction: (invoiceId: string, action: string) => Promise<any>;
}) {
  const [selectedMethod, setSelectedMethod] = useState<"cash" | "card" | "upi" | "whatsapp" | "insurance" | "credit">("cash");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [waStatusText, setWaStatusText] = useState<string | null>(null);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirmPayment(invoice.invoice_id, selectedMethod, notes);
      onClose();
    } catch (e) {
      console.error("Payment confirmation failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleWAAction = async (action: string) => {
    try {
      setLoading(true);
      const res = await onWhatsAppAction(invoice.invoice_id, action);
      if (action === "send_link") {
        setWaStatusText("Payment link delivered via WhatsApp.");
      } else if (action === "resend_reminder") {
        setWaStatusText("Payment reminder sent to patient via WhatsApp.");
      } else if (action === "delivery_status") {
        setWaStatusText(
          res?.reminder_sent_at
            ? `Delivery Status: Delivered on ${new Date(res.reminder_sent_at).toLocaleTimeString()}`
            : "Delivery Status: Message queued"
        );
      }
    } catch (e) {
      console.error("WhatsApp action failed:", e);
    } finally {
      setLoading(false);
    }
  };

  // Determine current lifecycle stage index (aligned with backend statuses)
  const currentStageIndex =
    invoice.status === "paid" || invoice.status === "waived"
      ? 3 // Paid
      : invoice.status === "sent"
      ? 1 // Sent
      : invoice.status === "generated"
      ? 0 // Generated
      : 2; // Pending

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-background-elevated border border-border rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-orange-400" />
              <h2 className="text-lg font-bold text-foreground">
                Payment Reconciliation — #{invoice.invoice_number}
              </h2>
            </div>
            <p className="text-xs text-foreground-subtle mt-0.5">
              {invoice.patient_phone_masked} • Created {new Date(invoice.created_at || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-foreground-subtle hover:text-foreground hover:bg-background-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lifecycle Stepper */}
        <div className="space-y-2">
          <p className="text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
            Invoice Lifecycle State
          </p>
          <div className="grid grid-cols-6 gap-1 bg-background-input p-2 rounded-xl border border-border text-center text-2xs font-medium">
            {LIFECYCLE_STAGES.map((stg, idx) => {
              const isCurrent = idx === currentStageIndex;
              const isPassed = idx < currentStageIndex;
              return (
                <div
                  key={stg}
                  className={cn(
                    "py-1.5 px-1 rounded-md transition-all font-mono",
                    isCurrent
                      ? "bg-orange-500 text-background font-bold"
                      : isPassed
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "text-foreground-subtle"
                  )}
                >
                  {stg}
                </div>
              );
            })}
          </div>
        </div>

        {/* Amount Banner */}
        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-between">
          <div>
            <p className="text-xs text-foreground-subtle">Total Amount Due</p>
            <p className="text-2xl font-bold text-orange-400 font-mono">
              {formatCurrency(invoice.amount_rupees)}
            </p>
          </div>
          <Badge variant={invoice.status === "paid" ? "green" : "orange"} dot>
            {invoice.status.toUpperCase()}
          </Badge>
        </div>

        {/* Payment Method Selector */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-foreground">Select Payment Method</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "cash", label: "Cash", icon: Banknote },
              { id: "card", label: "Card POS", icon: CreditCard },
              { id: "upi", label: "UPI QR", icon: QrCode },
              { id: "whatsapp", label: "WhatsApp Link", icon: Smartphone },
              { id: "insurance", label: "Insurance", icon: ShieldCheck },
              { id: "credit", label: "Clinic Credit", icon: Coins },
            ].map((m) => {
              const Icon = m.icon;
              const isSelected = selectedMethod === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMethod(m.id as any)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all focus-ring",
                    isSelected
                      ? "bg-orange-500/15 border-orange-500 text-orange-400"
                      : "bg-background-input border-border text-foreground-subtle hover:text-foreground hover:bg-background-hover"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Method Details & Action */}
        <div className="p-4 rounded-xl bg-background-input border border-border space-y-4 text-xs">
          {selectedMethod === "cash" && (
            <div className="space-y-3">
              <p className="text-foreground-subtle">
                Confirm cash payment received at clinic reception desk. BillingPulse will log <strong className="text-foreground">PAYMENT_RECEIVED</strong> and update revenue analytics immediately.
              </p>
              <Button
                variant="primary"
                className="w-full justify-center"
                disabled={loading}
                onClick={handleConfirm}
              >
                {loading ? "Processing..." : "Confirm Cash Payment"}
              </Button>
            </div>
          )}

          {selectedMethod === "card" && (
            <div className="space-y-3">
              <p className="text-foreground-subtle">
                Process swipe or tap on POS card terminal. Confirming updates revenue and reconciles invoice immediately.
              </p>
              <Button
                variant="primary"
                className="w-full justify-center"
                disabled={loading}
                onClick={handleConfirm}
              >
                {loading ? "Processing..." : "Confirm Card Payment"}
              </Button>
            </div>
          )}

          {selectedMethod === "upi" && (
            <div className="space-y-3 text-center">
              <div className="mx-auto w-32 h-32 bg-white p-2 rounded-xl flex items-center justify-center border border-border">
                <QrCode className="w-28 h-28 text-slate-900" />
              </div>
              <p className="text-2xs font-mono text-foreground-subtle truncate max-w-xs mx-auto">
                {invoice.payment_link_url || "https://razorpay.me/l/vaidyaai_demo"}
              </p>
              <p className="text-foreground-subtle text-2xs">
                Scan with GPay, PhonePe, or Paytm. Live Razorpay webhooks auto-reconcile in production.
              </p>
              <Button
                variant="primary"
                className="w-full justify-center"
                disabled={loading}
                onClick={handleConfirm}
              >
                {loading ? "Processing..." : "Confirm UPI Payment (Demo Manual)"}
              </Button>
            </div>
          )}

          {selectedMethod === "whatsapp" && (
            <div className="space-y-3">
              <p className="text-foreground-subtle">
                Deliver payment link via WhatsApp. <strong className="text-amber-300">Note:</strong> Sending link moves state to <em>Sent</em>. Does not mark as Paid until patient completes payment.
              </p>

              {waStatusText && (
                <div className="p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-300 font-mono text-2xs">
                  {waStatusText}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="justify-center text-xs"
                  disabled={loading}
                  onClick={() => handleWAAction("send_link")}
                >
                  <Send className="w-3.5 h-3.5" /> Send Link
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="justify-center text-xs"
                  disabled={loading}
                  onClick={() => handleWAAction("resend_reminder")}
                >
                  <Smartphone className="w-3.5 h-3.5" /> Remind
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="justify-center text-xs"
                  disabled={loading}
                  onClick={() => handleWAAction("delivery_status")}
                >
                  <Clock className="w-3.5 h-3.5" /> Check Status
                </Button>
              </div>
            </div>
          )}

          {selectedMethod === "insurance" && (
            <div className="space-y-3">
              <p className="text-foreground-subtle">Record TPA / Insurance Claim reference details:</p>
              <input
                type="text"
                placeholder="Policy / Pre-Auth Claim ID (e.g. TPA-88912)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-field text-xs"
              />
              <Button
                variant="primary"
                className="w-full justify-center"
                disabled={loading}
                onClick={handleConfirm}
              >
                {loading ? "Processing..." : "Confirm Insurance Claim"}
              </Button>
            </div>
          )}

          {selectedMethod === "credit" && (
            <div className="space-y-3">
              <p className="text-foreground-subtle">Record corporate or clinic credit account note:</p>
              <input
                type="text"
                placeholder="Corporate Account Note (e.g. Employee Credit)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-field text-xs"
              />
              <Button
                variant="primary"
                className="w-full justify-center"
                disabled={loading}
                onClick={handleConfirm}
              >
                {loading ? "Processing..." : "Confirm Credit Account"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BillingWorkflowPage() {
  const clinicId = useClinicStore((state) => state.clinicId);
  const { summary, loading: summaryLoading, refresh: refreshBilling } = useBilling();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshBilling();
    }, 15000);
    return () => clearInterval(interval);
  }, [refreshBilling]);

  const rawInvoices = useMemo(() => summary?.invoices || [], [summary?.invoices]);

  // Filter invoices strictly by status
  const filteredInvoices = useMemo(() => {
    if (filter === "pending") {
      return rawInvoices.filter((i: any) => i.status === "pending" || i.status === "sent" || i.status === "generated");
    }
    if (filter === "paid") {
      return rawInvoices.filter((i: any) => i.status === "paid" || i.status === "waived");
    }
    return rawInvoices;
  }, [rawInvoices, filter]);

  // Analytics derived directly from real backend summary
  const collected = summary?.total_collected_rupees || 0;
  const pending = summary?.pending_rupees || 0;
  const invoiceCount = summary?.invoice_count || rawInvoices.length;
  const collectionRate = collected + pending > 0 ? Math.round((collected / (collected + pending)) * 100) : 0;

  const handleExport = () => {
    window.open(`${BACKEND_URL}/api/v1/billing/export-csv?clinic_id=${clinicId}`);
    toast("CSV financial audit exported.", "success");
  };

  const handleConfirmPayment = async (invoiceId: string, method: string, notes?: string) => {
    if (!clinicId) return;
    try {
      await api.post("/billing/confirm-payment", {
        clinic_id: clinicId,
        invoice_id: invoiceId,
        payment_method: method,
        notes: notes,
      });
      toast(`Payment confirmed via ${method.toUpperCase()}! Revenue updated.`, "success");
      await refreshBilling();
    } catch (e) {
      console.error("Payment error:", e);
      toast("Payment confirmation failed.", "error");
    }
  };

  const handleWhatsAppAction = async (invoiceId: string, action: string) => {
    if (!clinicId) return;
    try {
      const res = await api.post("/billing/whatsapp-action", {
        clinic_id: clinicId,
        invoice_id: invoiceId,
        action: action,
      });
      toast(`WhatsApp action completed (${action}).`, "success");
      await refreshBilling();
      return res.data;
    } catch (e) {
      console.error("WhatsApp error:", e);
      toast("WhatsApp action failed.", "error");
    }
  };

  const activityItems: ActivityItem[] = useMemo(() => {
    return rawInvoices.slice(0, 5).map((inv: any, idx: number) => ({
      id: `act_${idx}`,
      time: inv.paid_at ? new Date(inv.paid_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Today",
      agent: "BillingPulse",
      agentColor: "orange",
      message: inv.status === "paid"
        ? `Reconciled payment of ${formatCurrency(inv.amount_rupees)} (${inv.payment_method?.toUpperCase() || "CASH"}) for ${inv.patient_phone_masked}`
        : `Invoice #${inv.invoice_number} pending payment for ${inv.patient_phone_masked}`,
      status: inv.status === "paid" ? "completed" : "pending",
    }));
  }, [rawInvoices]);

  if (summaryLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Receipt className="w-10 h-10 text-orange-400 animate-pulse" />
          <p className="text-foreground-muted text-sm font-medium">Loading BillingPulse workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Payment Dialog Modal */}
      {selectedInvoice && (
        <PaymentModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onConfirmPayment={handleConfirmPayment}
          onWhatsAppAction={handleWhatsAppAction}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Receipt className="w-6 h-6 text-orange-400" /> Billing & Payment Reconciliation
          </h1>
          <p className="text-sm text-foreground-subtle">
            Live practice revenue pipeline & automated reconciliation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleExport}>
            <FileDown className="w-4 h-4" /> Export CSV Audit
          </Button>
        </div>
      </div>

      {/* Financial KPI Status Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Panel padding="sm" className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-foreground-subtle">Collected Today</p>
              <p className="text-base font-semibold text-foreground">{formatCurrency(collected)}</p>
            </div>
          </div>
        </Panel>
        <Panel padding="sm" className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-foreground-subtle">Pending</p>
              <p className="text-base font-semibold text-foreground">{formatCurrency(pending)}</p>
            </div>
          </div>
        </Panel>
        <Panel padding="sm" className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-foreground-subtle">Invoices Today</p>
              <p className="text-base font-semibold text-foreground">{invoiceCount}</p>
            </div>
          </div>
        </Panel>
        <Panel padding="sm" className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <p className="text-xs text-foreground-subtle">Collection Rate</p>
              <p className="text-base font-semibold text-foreground">{collectionRate}%</p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Main Revenue Pipeline & Invoices List */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <SectionHeader icon={Coins} title="Revenue Pipeline & Invoices" subtitle="Click any Pending invoice to reconcile payment" />
            <div className="flex items-center gap-1.5">
              {(["all", "pending", "paid"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors focus-ring capitalize",
                    filter === f ? "bg-orange-500 text-background" : "text-foreground-subtle hover:text-foreground hover:bg-background-elevated"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <Panel padding="md">
            {filteredInvoices.length > 0 ? (
              <div className="space-y-3">
                {filteredInvoices.map((inv: any) => {
                  const isPaid = inv.status === "paid" || inv.status === "waived";
                  return (
                    <div
                      key={inv.invoice_id}
                      onClick={() => !isPaid && setSelectedInvoice(inv)}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border transition-all duration-200",
                        isPaid
                          ? "bg-background-elevated/40 border-border opacity-90"
                          : "bg-orange-500/5 border-orange-500/30 hover:border-orange-500/60 cursor-pointer shadow-xs hover:shadow-md"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <PatientAvatar name={inv.patient_phone_masked} size="md" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-foreground font-mono">
                              #{inv.invoice_number}
                            </p>
                            <Badge variant={isPaid ? "green" : "orange"} dot>
                              {inv.status.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-xs text-foreground-subtle">
                            {inv.patient_phone_masked} • {inv.consultation_type ? inv.consultation_type.toUpperCase() : "New Visit"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-bold text-foreground font-mono">
                            {formatCurrency(inv.amount_rupees)}
                          </p>
                          <p className="text-2xs text-foreground-subtle font-mono uppercase">
                            {inv.payment_method || "Pending Payment"}
                          </p>
                        </div>

                        {!isPaid ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedInvoice(inv);
                            }}
                            className="text-xs"
                          >
                            Reconcile Payment
                          </Button>
                        ) : (
                          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Paid
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center space-y-3">
                <Receipt className="w-10 h-10 text-foreground-subtle mx-auto" />
                <p className="text-sm font-medium text-foreground">
                  No {filter !== "all" ? filter : ""} invoices found for today.
                </p>
                <p className="text-xs text-foreground-subtle max-w-sm mx-auto">
                  Invoices will appear here automatically when consultations are approved.
                </p>
              </div>
            )}
          </Panel>
        </div>

        {/* Right AI & Activity Panel */}
        <div className="lg:col-span-4 space-y-5">
          <Panel padding="md">
            <SectionHeader
              icon={Sparkles}
              title="BillingPulse AI"
              subtitle="Agent 3"
              action={<AIStatus state="running" label="Active" />}
            />
            <div className="mt-4 space-y-3">
              <div className="panel p-3 bg-background-elevated/50 border border-border">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <TrendingUp className="w-4 h-4 text-teal-400" /> Revenue Summary
                </div>
                <p className="text-sm text-foreground font-mono font-bold mt-1">
                  {formatCurrency(collected)} Collected ({collectionRate}%)
                </p>
              </div>
              <div className="panel p-3 bg-background-elevated/50 border border-border">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <AlertTriangle className="w-4 h-4 text-orange-400" /> Outstanding
                </div>
                <p className="text-xs text-foreground-subtle mt-1 font-mono">
                  {formatCurrency(pending)} in pending invoices.
                </p>
              </div>
              <div className="panel p-3 bg-background-elevated/50 border border-border">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Smartphone className="w-4 h-4 text-blue-400" /> Reconciliation Tip
                </div>
                <p className="text-xs text-foreground-subtle mt-1">
                  Click any Pending invoice to process Cash, Card, UPI QR, or WhatsApp links.
                </p>
              </div>
            </div>
          </Panel>

          <Panel padding="md">
            <SectionHeader icon={Clock} title="Agent Decision Stream" />
            <ActivityFeed items={activityItems} className="mt-3" />
          </Panel>

          <Panel padding="md">
            <SectionHeader icon={CreditCard} title="Accepted Payment Channels" />
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-foreground-subtle flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-green-400" /> Cash
                </span>
                <span className="font-semibold text-foreground">Reception POS</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-subtle flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-orange-400" /> Card
                </span>
                <span className="font-semibold text-foreground">POS Terminal</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-subtle flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-blue-400" /> UPI QR & Razorpay
                </span>
                <span className="font-semibold text-foreground">Auto-Reconciled</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-subtle flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-teal-400" /> WhatsApp Link
                </span>
                <span className="font-semibold text-foreground">48h Expiry</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
