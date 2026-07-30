"use client";

import React, { useState } from "react";
import { cn } from "@/lib/cn";
import { Panel, SectionHeader, Badge, ActivityFeed, ActivityItem, AIStatus, Button, PatientAvatar } from "@/components/design-system";
import { ConsultationRecorder } from "@/components/ConsultationRecorder";
import { SOAPNoteEditor } from "@/components/SOAPNoteEditor";
import { SafetyFlagsPanel } from "@/components/SafetyFlagsPanel";
import { ConsultationData } from "@/hooks/useConsultation";
import {
  Stethoscope,
  FileText,
  Pill,
  FlaskConical,
  UserRound,
  Receipt,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Coins,
  CalendarDays,
  Activity,
  ArrowLeft,
  FileCode,
  Mic,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";

const tabs = [
  { id: "soap", label: "SOAP", icon: FileText },
  { id: "prescription", label: "Prescription", icon: Pill },
  { id: "orders", label: "Orders & Labs", icon: FlaskConical },
  { id: "referral", label: "Referral", icon: UserRound },
  { id: "billing", label: "Billing", icon: Receipt },
] as const;

type TabId = (typeof tabs)[number]["id"];

interface ConsultationWorkspaceProps {
  consultation: ConsultationData;
  consultationId: string;
  appointmentId: string;
  onDataChange: (data: ConsultationData) => void;
  onClear: () => void;
  onApproved: () => void;
}

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function computeEstimate(consultation: ConsultationData) {
  const base = 500;
  const perMed = 25;
  const perInvestigation = 150;
  const medCount = consultation.medications?.length || 0;
  const invCount = consultation.investigations?.length || 0;
  const subtotal = base + medCount * perMed + invCount * perInvestigation;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;
  return { base, medCount, invCount, subtotal, tax, total };
}

export function ConsultationWorkspace({
  consultation,
  consultationId,
  appointmentId,
  onDataChange,
  onClear,
  onApproved,
}: ConsultationWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabId>("soap");

  const estimate = computeEstimate(consultation);

  const activityItems: ActivityItem[] = [
    {
      id: "act_1",
      time: "10:02",
      agent: "AppointmentFlow",
      agentColor: "blue",
      message: "Checked in patient for consultation.",
      status: "completed",
    },
    {
      id: "act_2",
      time: "10:04",
      agent: "ClinicalScribe",
      agentColor: "teal",
      message: "Started ambient audio capture.",
      status: consultation.status === "draft" ? "running" : "completed",
    },
    {
      id: "act_3",
      time: "10:08",
      agent: "PrescriptionSafe",
      agentColor: "red",
      message: "Safety audit pending medication review.",
      status: "pending",
    },
    {
      id: "act_4",
      time: "10:10",
      agent: "BillingPulse",
      agentColor: "orange",
      message: "Estimated invoice ready for approval.",
      status: consultation.status === "approved" ? "completed" : "pending",
    },
  ];

  const hasSafetyEvaluation = (consultation as any).safety_evaluation;

  return (
    <div className="space-y-5">
      {/* Top navigation & status bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-teal-400" />
              Active Consultation Workspace
            </h1>
            <p className="text-xs text-foreground-subtle font-mono">
              {consultationId} • {appointmentId}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <AIStatus
            state={consultation.status === "approved" ? "completed" : "running"}
            label={consultation.status === "approved" ? "Consultation Approved" : "AI Scribing Active"}
          />
          <Badge variant={consultation.status === "approved" ? "green" : "blue"}>
            {consultation.status === "approved" ? "Approved" : "Draft"}
          </Badge>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Patient Context */}
        <div className="lg:col-span-3 space-y-5">
          <Panel padding="md">
            <div className="flex items-center gap-3">
              <PatientAvatar name="Ramesh Sharma" size="lg" status="in-consultation" />
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground truncate">Ramesh Sharma</h2>
                <p className="text-xs text-foreground-subtle">42Y • Male • B+</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="panel p-2.5 bg-background-elevated/50 border border-border">
                <p className="text-xs text-foreground-subtle">Phone</p>
                <p className="font-medium text-foreground truncate">+91XXXXXX3210</p>
              </div>
              <div className="panel p-2.5 bg-background-elevated/50 border border-border">
                <p className="text-xs text-foreground-subtle">Visit</p>
                <p className="font-medium text-foreground">Quarterly Review</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-subtle flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Allergies
                </span>
                <span className="text-foreground font-medium">Penicillin</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-subtle flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-orange-400" /> Chronic
                </span>
                <span className="text-foreground font-medium">T2DM, HTN</span>
              </div>
            </div>
          </Panel>

          <Panel padding="md">
            <SectionHeader icon={CalendarDays} title="History at a Glance" />
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-2" />
                <div>
                  <p className="text-sm text-foreground">Last visit: 25-Jun-2026</p>
                  <p className="text-xs text-foreground-subtle">BP 132/84, HbA1c 7.3%</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2" />
                <div>
                  <p className="text-sm text-foreground">Active meds</p>
                  <p className="text-xs text-foreground-subtle">Metformin 500mg, Telmisartan 40mg</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-2" />
                <div>
                  <p className="text-sm text-foreground">Pending labs</p>
                  <p className="text-xs text-foreground-subtle">Renal Function, Microalbumin</p>
                </div>
              </div>
            </div>
          </Panel>

          <Panel padding="md">
            <SectionHeader icon={Coins} title="Billing Estimate" />
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-foreground-subtle">Consultation fee</span>
                <span className="text-foreground">{formatCurrency(estimate.base)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-subtle">Medications ({estimate.medCount})</span>
                <span className="text-foreground">{formatCurrency(estimate.medCount * 25)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-subtle">Investigations ({estimate.invCount})</span>
                <span className="text-foreground">{formatCurrency(estimate.invCount * 150)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-subtle">GST (18%)</span>
                <span className="text-foreground">{formatCurrency(estimate.tax)}</span>
              </div>
              <div className="border-t border-border pt-2 flex items-center justify-between text-base font-semibold">
                <span className="text-foreground">Total</span>
                <span className="text-teal-400">{formatCurrency(estimate.total)}</span>
              </div>
            </div>
          </Panel>
        </div>

        {/* Center: Live Conversation & Workflow */}
        <div className="lg:col-span-6 space-y-5">
          {/* Ambient recorder strip */}
          <Panel padding="md">
            <SectionHeader
              icon={Mic}
              title="Ambient Scribe"
              subtitle="ClinicalScribe listens to Telugu, Hindi, or English"
              action={
                <Button variant="ghost" size="sm" onClick={onClear}>
                  Clear
                </Button>
              }
            />
            <div className="mt-4">
              <ConsultationRecorder
                consultationId={consultationId}
                appointmentId={appointmentId}
                onTranscribed={(data) => onDataChange(data as ConsultationData)}
                onClear={onClear}
              />
            </div>
          </Panel>

          {/* Workflow tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all focus-ring",
                    isActive
                      ? "bg-teal-500 text-background"
                      : "text-foreground-subtle hover:text-foreground hover:bg-background-elevated"
                  )}
                  aria-pressed={isActive}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <Panel padding="md" className="min-h-[420px]">
            {activeTab === "soap" && (
              <div className="space-y-4">
                <SectionHeader icon={FileText} title="Auto-Generated SOAP" subtitle="Review and edit before approving" />
                <SOAPNoteEditor consultation={consultation} onApproved={onApproved} />
              </div>
            )}

            {activeTab === "prescription" && (
              <div className="space-y-4">
                <SectionHeader icon={Pill} title="Prescription (Rx)" />
                {consultation.medications && consultation.medications.length > 0 ? (
                  <div className="space-y-2">
                    {consultation.medications.map((m, idx) => (
                      <div key={idx} className="panel p-3 bg-background-elevated/50 border border-border">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{m.drug_name} {m.dosage}</span>
                          <Badge variant="teal">{m.frequency}</Badge>
                        </div>
                        <p className="text-xs text-foreground-subtle mt-1">
                          Duration: {m.duration} • {m.instructions}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-foreground-subtle">No medications extracted yet. Start ambient recording or edit manually.</p>
                )}
              </div>
            )}

            {activeTab === "orders" && (
              <div className="space-y-4">
                <SectionHeader icon={FlaskConical} title="Orders & Labs" />
                {consultation.investigations && consultation.investigations.length > 0 ? (
                  <div className="space-y-2">
                    {consultation.investigations.map((inv, idx) => (
                      <div key={idx} className="panel p-3 bg-background-elevated/50 border border-border flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{inv}</span>
                        <Button variant="secondary" size="sm">
                          Order
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-foreground-subtle">No investigations suggested. Add labs from the SOAP plan.</p>
                )}
              </div>
            )}

            {activeTab === "referral" && (
              <div className="space-y-4">
                <SectionHeader icon={UserRound} title="Referrals" />
                {consultation.referrals && consultation.referrals.length > 0 ? (
                  <div className="space-y-2">
                    {consultation.referrals.map((r, idx) => (
                      <div key={idx} className="panel p-3 bg-background-elevated/50 border border-border">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{r.speciality}</span>
                          <Badge variant={r.urgency === "Urgent" ? "red" : "orange"}>{r.urgency}</Badge>
                        </div>
                        <p className="text-sm text-foreground-muted mt-1">{r.reason}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-foreground-subtle">No referrals suggested.</p>
                )}
              </div>
            )}

            {activeTab === "billing" && (
              <div className="space-y-4">
                <SectionHeader icon={Receipt} title="Billing Summary" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="panel p-3 bg-background-elevated/50 border border-border">
                    <p className="text-xs text-foreground-subtle">Subtotal</p>
                    <p className="text-lg font-semibold text-foreground">{formatCurrency(estimate.subtotal)}</p>
                  </div>
                  <div className="panel p-3 bg-background-elevated/50 border border-border">
                    <p className="text-xs text-foreground-subtle">Tax (18%)</p>
                    <p className="text-lg font-semibold text-foreground">{formatCurrency(estimate.tax)}</p>
                  </div>
                  <div className="panel p-3 bg-background-elevated/50 border border-border col-span-2">
                    <p className="text-xs text-foreground-subtle">Estimated Total</p>
                    <p className="text-2xl font-bold text-teal-400">{formatCurrency(estimate.total)}</p>
                  </div>
                </div>
                <p className="text-xs text-foreground-subtle">
                  Approve the SOAP note to generate the UPI invoice and prescription PDF.
                </p>
              </div>
            )}
          </Panel>

          {/* Live transcript */}
          <Panel padding="md">
            <SectionHeader icon={MessageSquare} title="Live Transcript" subtitle="Speaker-separated diarization" />
            <div className="mt-3 max-h-48 overflow-y-auto rounded-xl bg-background-elevated/50 border border-border p-3">
              {consultation.transcript_raw ? (
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {consultation.transcript_raw}
                </p>
              ) : (
                <p className="text-sm text-foreground-subtle italic">
                  Start the ambient recorder to see the live transcript here.
                </p>
              )}
            </div>
          </Panel>
        </div>

        {/* Right: AI Panel */}
        <div className="lg:col-span-3 space-y-5">
          <Panel padding="md">
            <SectionHeader
              icon={Sparkles}
              title="AI Co-Pilot"
              subtitle="Always-visible assistant"
              action={<AIStatus state="running" label="On" />}
            />
            <div className="mt-4 space-y-3">
              <div className="panel p-3 bg-background-elevated/50 border border-border">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileCode className="w-4 h-4 text-blue-400" /> ICD-10 Suggestions
                </div>
                {consultation.diagnoses && consultation.diagnoses.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {consultation.diagnoses.map((d, idx) => (
                      <Badge key={idx} variant="blue">
                        {d.code} <span className="text-foreground-subtle">{d.description}</span>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-foreground-subtle mt-2">No diagnoses yet.</p>
                )}
              </div>

              <div className="panel p-3 bg-background-elevated/50 border border-border">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Pill className="w-4 h-4 text-teal-400" /> Drug Suggestions
                </div>
                <p className="text-xs text-foreground-subtle mt-2">
                  {consultation.medications && consultation.medications.length > 0
                    ? `${consultation.medications.length} medication(s) extracted from transcript.`
                    : "No medications extracted yet."}
                </p>
              </div>

              <div className="panel p-3 bg-background-elevated/50 border border-border">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Clock className="w-4 h-4 text-orange-400" /> Follow-up
                </div>
                <p className="text-xs text-foreground-subtle mt-2">
                  {consultation.followup_days
                    ? `Suggested follow-up in ${consultation.followup_days} days.`
                    : "No follow-up interval suggested."}
                </p>
              </div>
            </div>
          </Panel>

          <SafetyFlagsPanel
            consultationId={consultation.consultation_id}
            medications={consultation.medications || []}
            patientId={(consultation as any).patient_id}
            existingEvaluation={hasSafetyEvaluation}
          />

          <Panel padding="md">
            <SectionHeader icon={Activity} title="Agent Activity" />
            <ActivityFeed items={activityItems} className="mt-3" />
          </Panel>

          <Panel padding="md">
            <SectionHeader icon={ShieldCheck} title="Compliance" />
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-foreground-subtle">AI audit log</span>
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-subtle">Patient consent</span>
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-subtle">Prescription audit</span>
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
