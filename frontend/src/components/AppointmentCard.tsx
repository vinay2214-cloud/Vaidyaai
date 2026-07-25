"use client";

import React, { useState } from "react";
import { Appointment } from "@/hooks/useAppointmentsToday";
import { Clock, CheckCircle, XCircle, ArrowRight, MessageSquare, FileText, CreditCard, Sparkles } from "lucide-react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";
import { StatusBadge, StatusVariant } from "./shared/StatusBadge";

export function AppointmentCard({ appointment }: { appointment: Appointment }) {
  const clinicId = useClinicStore((state) => state.clinicId);
  const [updating, setUpdating] = useState(false);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!clinicId) return;
    try {
      setUpdating(true);
      await api.patch(`/appointments/${appointment.appointment_id}/status`, {
        clinic_id: clinicId,
        status: newStatus
      });
    } catch (e) {
      console.error("Failed to update status:", e);
    } finally {
      setUpdating(false);
    }
  };

  const statusVariantMap: Record<string, { variant: StatusVariant; label: string }> = {
    booked: { variant: "info", label: "Booked (WhatsApp)" },
    arrived: { variant: "warning", label: "Arrived in Clinic" },
    in_progress: { variant: "running", label: "In Consultation" },
    completed: { variant: "success", label: "Completed" },
    cancelled: { variant: "error", label: "Cancelled" }
  };

  const { variant, label } = statusVariantMap[appointment.status] || { variant: "neutral", label: appointment.status };

  // Calculate estimated wait time (ETA) based on queue position
  const etaMinutes = (appointment.queue_number - 1) * 12;
  const etaDisplay = appointment.status === "in_progress" 
    ? "In Room" 
    : appointment.status === "completed" 
    ? "Done" 
    : etaMinutes <= 0 
    ? "Now" 
    : `~${etaMinutes} mins wait`;

  const bookingSource = appointment.booked_by === "whatsapp_agent" ? "WhatsApp Agent" : "Walk-in Desk";
  const whatsappStatus = appointment.status === "booked" ? "Reminder Sent" : "Delivered";
  const soapStatus = appointment.status === "completed" ? "SOAP Approved" : appointment.status === "in_progress" ? "SOAP Scribe Active" : "Pending";
  const billingStatus = appointment.status === "completed" ? "UPI Paid" : "Pending";

  return (
    <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:border-slate-600 transition-colors">
      <div className="flex items-start gap-3.5 min-w-0">
        <div className="w-10 h-10 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center text-teal-400 font-bold shrink-0 text-sm">
          #{appointment.queue_number}
        </div>

        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-white text-sm">{appointment.patient_name || "Patient"}</h3>
            <StatusBadge label={label} variant={variant} size="sm" />
            <span className="text-[10px] font-mono bg-slate-900 border border-slate-700/60 px-2 py-0.5 rounded-full text-slate-300">
              ETA: {etaDisplay}
            </span>
          </div>

          <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 font-mono text-slate-300">
              <Clock className="w-3.5 h-3.5 text-teal-400" /> {appointment.slot_time_str}
            </span>
            <span>•</span>
            <span className="font-mono text-slate-400">{appointment.patient_phone_masked}</span>
            <span>•</span>
            <span className="capitalize text-slate-300">{appointment.consultation_type}</span>
          </p>

          {/* Status Chips Row */}
          <div className="flex items-center gap-2 flex-wrap text-[11px] pt-1">
            <span className="inline-flex items-center gap-1 bg-slate-900/80 border border-slate-700/50 text-slate-300 px-2 py-0.5 rounded-md">
              <Sparkles className="w-3 h-3 text-teal-400" /> {bookingSource}
            </span>
            <span className="inline-flex items-center gap-1 bg-slate-900/80 border border-slate-700/50 text-emerald-400 px-2 py-0.5 rounded-md">
              <MessageSquare className="w-3 h-3 text-emerald-400" /> WA: {whatsappStatus}
            </span>
            <span className="inline-flex items-center gap-1 bg-slate-900/80 border border-slate-700/50 text-purple-300 px-2 py-0.5 rounded-md">
              <FileText className="w-3 h-3 text-purple-400" /> SOAP: {soapStatus}
            </span>
            <span className="inline-flex items-center gap-1 bg-slate-900/80 border border-slate-700/50 text-amber-300 px-2 py-0.5 rounded-md">
              <CreditCard className="w-3 h-3 text-amber-400" /> Bill: {billingStatus}
            </span>
          </div>

          {appointment.complaint_summary && (
            <p className="text-xs text-slate-300 mt-1.5 bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-800 italic">
              &quot;{appointment.complaint_summary}&quot;
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
        {appointment.status === "booked" && (
          <button
            onClick={() => handleStatusUpdate("arrived")}
            disabled={updating}
            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-xl transition-colors"
          >
            Mark Arrived
          </button>
        )}

        {(appointment.status === "booked" || appointment.status === "arrived") && (
          <button
            onClick={() => handleStatusUpdate("in_progress")}
            disabled={updating}
            className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            Start Consult <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        {appointment.status === "in_progress" && (
          <button
            onClick={() => handleStatusUpdate("completed")}
            disabled={updating}
            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" /> Finish
          </button>
        )}

        {appointment.status !== "cancelled" && appointment.status !== "completed" && (
          <button
            onClick={() => handleStatusUpdate("cancelled")}
            disabled={updating}
            className="px-2.5 py-1.5 text-slate-400 hover:text-rose-400 text-xs transition-colors"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
