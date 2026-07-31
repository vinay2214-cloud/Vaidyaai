"use client";

import React, { useState } from "react";
import { Appointment } from "@/hooks/useAppointmentsToday";
import { useClinicStore } from "@/store/clinicStore";
import { useToast } from "@/components/design-system";
import { PatientAvatar, RiskBadge, Badge, Button } from "@/components/design-system";
import api from "@/lib/api";
import { Clock, Sparkles, CheckCircle, XCircle, Stethoscope } from "lucide-react";

interface QueuePatientRowProps {
  appointment: Appointment;
}

export function QueuePatientRow({ appointment }: QueuePatientRowProps) {
  const clinicId = useClinicStore((state) => state.clinicId);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const handleStatusUpdate = async (newStatus: string) => {
    if (!clinicId) return;
    try {
      setUpdating(true);
      await api.patch(`/appointments/${appointment.appointment_id}/status`, {
        clinic_id: clinicId,
        status: newStatus,
      });
      toast(`Status updated to ${newStatus}`, "success");
    } catch (e) {
      console.error("Failed to update status:", e);
      toast("Failed to update status", "error");
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
      toast("Could not start consultation", "error");
    } finally {
      setUpdating(false);
    }
  };

  const etaMinutes = (appointment.queue_number - 1) * 12;
  const etaDisplay =
    appointment.status === "in_progress"
      ? "In Room"
      : appointment.status === "completed"
      ? "Done"
      : etaMinutes <= 0
      ? "Now"
      : `~${etaMinutes}m wait`;

  const riskLevel: "low" | "medium" | "high" | "critical" =
    appointment.status === "in_progress"
      ? "high"
      : etaMinutes > 30
      ? "high"
      : etaMinutes > 15
      ? "medium"
      : "low";

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
          <RiskBadge level={riskLevel} />
          <Badge variant={appointment.status === "completed" ? "green" : appointment.status === "in_progress" ? "teal" : "neutral"} className="text-[10px]">
            {statusLabel}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-foreground-subtle flex-wrap">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {appointment.slot_time_str}</span>
          <span>{appointment.patient_phone_masked}</span>
          <span className="capitalize">{appointment.consultation_type}</span>
          <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-teal-400" /> {appointment.booked_by === "whatsapp_agent" ? "WhatsApp" : "Walk-in"}</span>
          <span className="font-mono text-foreground-muted">{etaDisplay}</span>
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
        {appointment.status !== "cancelled" && appointment.status !== "completed" && appointment.status !== "in_progress" && (
          <button
            onClick={() => handleStatusUpdate("cancelled")}
            disabled={updating}
            className="p-2 text-foreground-subtle hover:text-red-400 rounded-lg transition-colors focus-ring"
            aria-label="Cancel appointment"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
