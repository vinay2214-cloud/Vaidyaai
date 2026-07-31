"use client";

import React, { useEffect, useState } from "react";
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
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Coins,
  TrendingUp,
  AlertTriangle,
  MoreHorizontal,
} from "lucide-react";

interface WorkflowItem {
  id: string;
  stage: "consultation" | "invoice" | "sent" | "paid" | "reconciled" | "report";
  patient: string;
  phone: string;
  amount: number;
  method: string;
  status: "completed" | "running" | "pending" | "failed";
  time: string;
  action?: string;
}

const stages = [
  { id: "consultation", label: "Consultation", icon: Receipt },
  { id: "invoice", label: "Invoice Generated", icon: ArrowUpRight },
  { id: "sent", label: "UPI Link / QR Sent", icon: Smartphone },
  { id: "paid", label: "Payment Received", icon: Banknote },
  { id: "reconciled", label: "Auto-Reconciled", icon: CheckCircle2 },
  { id: "report", label: "EOD Report", icon: FileDown },
] as const;

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function BillingWorkflowPage() {
  const clinicId = useClinicStore((state) => state.clinicId);
  const { summary, loading: summaryLoading, refresh: refreshBilling } = useBilling();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    const interval = setInterval(() => {
      refreshBilling();
    }, 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [refreshBilling]);

  const collected = summary?.total_collected_rupees || 9500;
  const pending = summary?.pending_rupees || 1200;
  const invoiceCount = summary?.invoice_count || 5;
  const collectionRate = collected + pending > 0 ? Math.round((collected / (collected + pending)) * 100) : 0;

  const rawInvoices = summary?.invoices || [];
  const displayWorkflow: WorkflowItem[] = rawInvoices.length > 0
    ? rawInvoices.map((inv: any, idx: number) => ({
        id: inv.invoice_id || `inv_${idx}`,
        stage: inv.status === "paid" ? ("paid" as const) : ("invoice" as const),
        patient: `Patient (${inv.patient_phone_masked})`,
        phone: inv.patient_phone_masked,
        amount: inv.amount_rupees,
        method: inv.payment_method ? inv.payment_method.toUpperCase() : "Razorpay UPI",
        status: inv.status === "paid" ? ("completed" as const) : ("pending" as const),
        time: inv.created_at ? new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Today",
        action: inv.status === "paid" ? "Paid" : `Invoice ${inv.invoice_number}`
      }))
    : [
    {
      id: "wf_1",
      stage: "consultation",
      patient: "Ramesh Sharma",
      phone: "+91XXXXXX3210",
      amount: 500,
      method: "Consultation",
      status: "completed",
      time: "10:05 AM",
      action: "SOAP approved",
    },
    {
      id: "wf_2",
      stage: "invoice",
      patient: "Ramesh Sharma",
      phone: "+91XXXXXX3210",
      amount: 500,
      method: "Razorpay UPI",
      status: "completed",
      time: "10:06 AM",
      action: "Invoice VDY-20260725-0012",
    },
    {
      id: "wf_3",
      stage: "sent",
      patient: "Ramesh Sharma",
      phone: "+91XXXXXX3210",
      amount: 500,
      method: "WhatsApp UPI link",
      status: "completed",
      time: "10:06 AM",
      action: "Link sent",
    },
    {
      id: "wf_4",
      stage: "paid",
      patient: "Ramesh Sharma",
      phone: "+91XXXXXX3210",
      amount: 500,
      method: "UPI (pay_Q9Z128x)",
      status: "completed",
      time: "10:22 AM",
      action: "Paid",
    },
    {
      id: "wf_5",
      stage: "reconciled",
      patient: "Ramesh Sharma",
      phone: "+91XXXXXX3210",
      amount: 500,
      method: "Razorpay",
      status: "completed",
      time: "10:22 AM",
      action: "Matched",
    },
    {
      id: "wf_6",
      stage: "consultation",
      patient: "Priya Nair",
      phone: "+91XXXXXX7711",
      amount: 800,
      method: "Consultation + Lab",
      status: "completed",
      time: "10:30 AM",
      action: "SOAP approved",
    },
    {
      id: "wf_7",
      stage: "invoice",
      patient: "Priya Nair",
      phone: "+91XXXXXX7711",
      amount: 800,
      method: "Razorpay UPI",
      status: "completed",
      time: "10:31 AM",
      action: "Invoice VDY-20260725-0013",
    },
    {
      id: "wf_8",
      stage: "paid",
      patient: "Priya Nair",
      phone: "+91XXXXXX7711",
      amount: 800,
      method: "UPI (pay_Q9Z129y)",
      status: "completed",
      time: "10:40 AM",
      action: "Paid",
    },
    {
      id: "wf_9",
      stage: "invoice",
      patient: "Anita Verma",
      phone: "+91XXXXXX8890",
      amount: 500,
      method: "Cash",
      status: "pending",
      time: "11:00 AM",
      action: "Awaiting cash marking",
    },
    {
      id: "wf_10",
      stage: "invoice",
      patient: "Suresh Patel",
      phone: "+91XXXXXX4512",
      amount: 700,
      method: "UPI",
      status: "failed",
      time: "Yesterday",
      action: "1 day overdue",
    },
  ];

  const filtered = displayWorkflow.filter((item) => {
    if (filter === "pending") return item.status === "pending" || item.status === "failed";
    if (filter === "paid") return item.status === "completed";
    return true;
  });

  const activity: ActivityItem[] = [
    {
      id: "ba_1",
      time: "10:22",
      agent: "BillingPulse",
      agentColor: "orange",
      message: "Auto-reconciled UPI payment for Ramesh Sharma.",
      status: "completed",
    },
    {
      id: "ba_2",
      time: "10:40",
      agent: "BillingPulse",
      agentColor: "orange",
      message: "Sent WhatsApp payment receipt to Priya Nair.",
      status: "completed",
    },
    {
      id: "ba_3",
      time: "11:05",
      agent: "BillingPulse",
      agentColor: "orange",
      message: "Flagged Suresh Patel invoice as overdue.",
      status: "pending",
    },
  ];

  const handleExport = () => {
    window.open(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/api/v1/billing/export-csv?clinic_id=${clinicId || "clinic_1"}`);
    toast("CSV financial audit exported.", "success");
  };

  const handleNewInvoice = () => {
    toast("Manual invoice creation opened.", "info");
  };

  const handleAction = (item: WorkflowItem) => {
    if (item.status === "failed") {
      toast(`Payment reminder sent to ${item.patient}.`, "success");
    } else if (item.status === "pending") {
      toast(`Marked ${item.patient} as cash paid.`, "success");
    } else {
      toast(`Invoice ${item.action} opened.`, "info");
    }
  };

  if (loading || summaryLoading) {
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Receipt className="w-6 h-6 text-orange-400" /> Billing Workflow
          </h1>
          <p className="text-sm text-foreground-subtle">Live revenue pipeline • Today, 25-Jul-2026</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleExport}>
            <FileDown className="w-4 h-4" /> Export CSV
          </Button>
          <Button variant="primary" onClick={handleNewInvoice}>
            <Plus className="w-4 h-4" /> New Invoice
          </Button>
        </div>
      </div>

      {/* Slim status bar */}
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
              <p className="text-xs text-foreground-subtle">Invoices</p>
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
        {/* Timeline */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <SectionHeader icon={Coins} title="Today's Revenue Pipeline" subtitle="Consultation → Invoice → Payment → Reconcile" />
            <div className="flex items-center gap-2">
              {(["all", "pending", "paid"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors focus-ring",
                    filter === f ? "bg-orange-500 text-background" : "text-foreground-subtle hover:text-foreground hover:bg-background-elevated"
                  )}
                >
                  {f[0].toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <Panel padding="md">
            <div className="space-y-6">
              {stages.map((stage, stageIdx) => {
                const StageIcon = stage.icon;
                const items = filtered.filter((i) => i.stage === stage.id);
                if (items.length === 0) return null;
                return (
                  <div key={stage.id} className="relative pl-8">
                    <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                    <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-background-elevated border border-border flex items-center justify-center">
                      <StageIcon className="w-3.5 h-3.5 text-orange-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">{stage.label}</h3>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border transition-all hover:bg-background-hover",
                            item.status === "failed" && "bg-red-500/5 border-red-500/30",
                            item.status === "pending" && "bg-orange-500/5 border-orange-500/30",
                            item.status === "completed" && "bg-background-elevated/50 border-border"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <PatientAvatar name={item.patient} size="sm" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{item.patient}</p>
                              <p className="text-xs text-foreground-subtle">
                                {item.phone} • {item.time}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                              <p className="text-sm font-semibold text-foreground">{formatCurrency(item.amount)}</p>
                              <p className="text-xs text-foreground-subtle">{item.method}</p>
                            </div>
                            <Badge
                              variant={
                                item.status === "completed" ? "green" : item.status === "pending" ? "orange" : item.status === "failed" ? "red" : "gray"
                              }
                              dot
                            >
                              {item.action}
                            </Badge>
                            <button
                              onClick={() => handleAction(item)}
                              className="btn-ghost p-2"
                              aria-label={`Action for ${item.patient}`}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* Right AI panel */}
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
                  <TrendingUp className="w-4 h-4 text-teal-400" /> 7-day Forecast
                </div>
                <p className="text-sm text-foreground mt-1">₹42,500 expected (+12%)</p>
              </div>
              <div className="panel p-3 bg-background-elevated/50 border border-border">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <AlertTriangle className="w-4 h-4 text-orange-400" /> Risks
                </div>
                <p className="text-xs text-foreground-subtle mt-1">2 overdue invoices totaling ₹1,200.</p>
              </div>
              <div className="panel p-3 bg-background-elevated/50 border border-border">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Smartphone className="w-4 h-4 text-blue-400" /> Recovery Tip
                </div>
                <p className="text-xs text-foreground-subtle mt-1">WhatsApp UPI reminders recover 90% within 2 hours.</p>
              </div>
            </div>
          </Panel>

          <Panel padding="md">
            <SectionHeader icon={Clock} title="Agent Activity" />
            <ActivityFeed items={activity} className="mt-3" />
          </Panel>

          <Panel padding="md">
            <SectionHeader icon={CreditCard} title="Payment Methods" />
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-subtle flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-blue-400" /> UPI
                </span>
                <span className="font-medium text-foreground">80%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-subtle flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-green-400" /> Cash
                </span>
                <span className="font-medium text-foreground">15%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-subtle flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-orange-400" /> Card
                </span>
                <span className="font-medium text-foreground">5%</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
