"use client";

import React, { useEffect, useState } from "react";
import { Appointment } from "@/hooks/useAppointmentsToday";
import { useClinicStore } from "@/store/clinicStore";
import { useToast } from "@/components/design-system";
import { PatientAvatar, RiskBadge, Badge, Button } from "@/components/design-system";
import api from "@/lib/api";
import { apiErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { Clock, CheckCircle, XCircle, Stethoscope, MessageCircle, Footprints, RotateCcw, UserX, Hourglass } from "lucide-react";

/** Wait in whole minutes between arrival and either consultation start or now. */
function waitMinutes(arrivedAt?: string | null, startedAt?: string | null): number | null {
  if (!arrivedAt) return null;
  const arrived = new Date(arrivedAt).getTime();
  if (Number.isNaN(arrived)) return null;
  const end = startedAt ? new Date(startedAt).getTime() : Date.now();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.floor((end - arrived) / 60000));
}

function formatWait(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * How a patient reached the queue. In a real clinic these carry different
 * urgency and different data completeness: a walk-in has no prior record, a
 * WhatsApp booking arrived with a stated complaint, a follow-up already has
 * history. Text alone made them indistinguishable at a glance.
 */
function sourceTag(bookedBy: string, consultationType: string) {
  if (consultationType === "followup") {
    return { label: "Follow-up", Icon: RotateCcw, className: "bg-blue-500/10 text-blue-300 border-blue-500/30" };
  }
  if (bookedBy === "whatsapp_agent" || bookedBy === "whatsapp") {
    return { label: "WhatsApp", Icon: MessageCircle, className: "bg-teal-500/10 text-teal-300 border-teal-500/30" };
  }
  return { label: "Walk-in", Icon: Footprints, className: "bg-purple-500/10 text-purple-300 border-purple-500/30" };
}

const STATUS_CONFIRMATION: Record<string, string> = {
  completed: "Consultation marked complete.",
  cancelled: "Appointment cancelled.",
  no_show: "Marked as no-show. The slot is now free.",
  arrived: "Patient marked as arrived.",
};

interface QueuePatientRowProps {
  appointment: Appointment;
}

export function QueuePatientRow({ appointment }: QueuePatientRowProps) {
  const clinicId = useClinicStore((state) => state.clinicId);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  // Re-render once a minute so a waiting patient's clock actually advances
  // instead of freezing at whatever it read when the queue last loaded.
  const [, setTick] = useState(0);
  const isWaiting = appointment.status === "arrived" || appointment.status === "booked";
  useEffect(() => {
    if (!isWaiting) return;
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, [isWaiting]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!clinicId) return;
    try {
      setUpdating(true);
      await api.patch(`/appointments/${appointment.appointment_id}/status`, {
        clinic_id: clinicId,
        status: newStatus,
      });
      toast(STATUS_CONFIRMATION[newStatus] || `Status updated to ${newStatus}`, "success", "clinical");
    } catch (e) {
      console.error("Failed to update status:", e);
      toast(apiErrorMessage(e, `update ${appointment.patient_name || "this patient"}'s status`), "error", "clinical");
    } finally {
      setUpdating(false);
    }
  };

  const startConsultation = async () => {
    if (!clinicId) return;
    try {
      setUpdating(true);
      await api.patch(`/appointments/${appointment.appointment_id}/status`, {
        clinic_id: clinicId,
        status: "in_progress",
      });
      const res = await api.post("/consultations/start", {
        clinic_id: clinicId,
        appointment_id: appointment.appointment_id,
      });
      const consId = res.data.consultation_id;
      window.location.assign(`/consultation/${consId}?appointment_id=${appointment.appointment_id}`);
    } catch (e) {
      console.error("Failed to start consultation:", e);
      toast(apiErrorMessage(e, "start this consultation"), "error", "clinical");
    } finally {
      setUpdating(false);
    }
  };

  // How long they have ACTUALLY been waiting, which is what front-desk staff
  // and the doctor think in. The old display was a position-derived ETA
  // (queue_number * 12 minutes) presented as "wait", so a patient who had sat
  // there for an hour still read "~12m wait".
  const waited = waitMinutes(appointment.arrived_at, appointment.consultation_started_at);
  const isLongWait = waited !== null && waited >= 30 && isWaiting;
  const isVeryLongWait = waited !== null && waited >= 45 && isWaiting;

  const waitDisplay =
    appointment.status === "in_progress"
      ? "In room"
      : appointment.status === "completed"
      ? waited !== null
        ? `Waited ${formatWait(waited)}`
        : "Done"
      : waited !== null
      ? `Waiting ${formatWait(waited)}`
      : "Just arrived";

  const tag = sourceTag(appointment.booked_by, appointment.consultation_type);
  const TagIcon = tag.Icon;

  const statusLabel =
    appointment.status === "booked"
      ? "Booked"
      : appointment.status === "arrived"
      ? "Arrived"
      : appointment.status === "in_progress"
      ? "In Progress"
      : appointment.status === "completed"
      ? "Completed"
      : appointment.status;

  return (
    <div className="group flex items-center gap-3 p-3 rounded-xl bg-background-elevated/50 border border-border hover:border-border-strong hover:bg-background-hover transition-all duration-250">
      <PatientAvatar name={appointment.patient_name || "Patient"} size="md" status={appointment.status === "in_progress" ? "in-consultation" : undefined} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{appointment.patient_name || "Patient"}</span>
          <Badge variant="outline" className="text-[10px]">#{appointment.queue_number}</Badge>
          {(appointment as any).risk_level && <RiskBadge level={(appointment as any).risk_level} />}
          <Badge variant={appointment.status === "completed" ? "green" : appointment.status === "in_progress" ? "teal" : "neutral"} className="text-[10px]">
            {statusLabel}
          </Badge>
        </div>
        <div className="flex items-center gap-2.5 mt-1.5 text-xs text-foreground-subtle flex-wrap">
          {/* Wait time leads: "who has been waiting longest" is the question
              actually being asked when scanning a queue. */}
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-semibold font-mono border",
              isVeryLongWait
                ? "bg-red-500/10 text-red-300 border-red-500/30"
                : isLongWait
                ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                : "bg-background-input/60 text-foreground-muted border-transparent"
            )}
            title={appointment.arrived_at ? `Arrived ${new Date(appointment.arrived_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : undefined}
          >
            <Hourglass className="w-3 h-3 shrink-0" aria-hidden="true" />
            {waitDisplay}
          </span>

          <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border font-semibold", tag.className)}>
            <TagIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
            {tag.label}
          </span>

          <span className="flex items-center gap-1"><Clock className="w-3 h-3" aria-hidden="true" /> {appointment.slot_time_str}</span>
          <span>{appointment.patient_phone_masked}</span>
        </div>
        {appointment.complaint_summary && (
          <p className="text-xs text-foreground-muted mt-1.5 italic truncate">
            "{appointment.complaint_summary}"
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {(appointment.status === "booked" || appointment.status === "arrived") && (
          <Button size="sm" onClick={startConsultation} isLoading={updating}>
            <Stethoscope className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Start</span>
          </Button>
        )}
        {appointment.status === "in_progress" && (
          <Button size="sm" variant="secondary" onClick={() => handleStatusUpdate("completed")} isLoading={updating}>
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Finish</span>
          </Button>
        )}
        {isWaiting && (
          <button
            onClick={() => handleStatusUpdate("no_show")}
            disabled={updating}
            title="Patient left or did not attend"
            className="p-2 text-foreground-subtle hover:text-amber-400 rounded-lg transition-colors focus-ring disabled:opacity-50"
            aria-label={`Mark ${appointment.patient_name || "patient"} as no-show`}
          >
            <UserX className="w-4 h-4" />
          </button>
        )}
        {appointment.status !== "cancelled" && appointment.status !== "completed" && appointment.status !== "in_progress" && (
          <button
            onClick={() => handleStatusUpdate("cancelled")}
            disabled={updating}
            className="p-2 text-foreground-subtle hover:text-red-400 rounded-lg transition-colors focus-ring disabled:opacity-50"
            aria-label={`Cancel ${appointment.patient_name || "patient"}'s appointment`}
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
