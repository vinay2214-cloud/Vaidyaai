"use client";

import React, { useState } from "react";
import { Appointment } from "@/hooks/useAppointmentsToday";
import { User, Clock, CheckCircle, XCircle, ArrowRight, Activity } from "lucide-react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";

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

  const statusBadges: Record<string, { bg: string; text: string; label: string }> = {
    booked: { bg: "bg-blue-500/10", text: "text-blue-400 border-blue-500/30", label: "Booked (WhatsApp)" },
    arrived: { bg: "bg-amber-500/10", text: "text-amber-400 border-amber-500/30", label: "Arrived in Clinic" },
    in_progress: { bg: "bg-purple-500/10", text: "text-purple-400 border-purple-500/30", label: "In Consultation" },
    completed: { bg: "bg-emerald-500/10", text: "text-emerald-400 border-emerald-500/30", label: "Completed" },
    cancelled: { bg: "bg-rose-500/10", text: "text-rose-400 border-rose-500/30", label: "Cancelled" }
  };

  const badge = statusBadges[appointment.status] || statusBadges.booked;

  return (
    <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:border-slate-600 transition-colors">
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center text-teal-400 font-bold shrink-0">
          #{appointment.queue_number}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white text-base">{appointment.patient_name || "Patient"}</h3>
            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-3">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-500" /> {appointment.slot_time_str}</span>
            <span>•</span>
            <span>{appointment.patient_phone_masked}</span>
            <span>•</span>
            <span className="capitalize">{appointment.consultation_type}</span>
          </p>
          {appointment.complaint_summary && (
            <p className="text-xs text-slate-300 mt-2 bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-800 italic">
              "{appointment.complaint_summary}"
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 self-end md:self-center">
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
