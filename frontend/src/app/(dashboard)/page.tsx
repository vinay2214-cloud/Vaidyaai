"use client";

import React from "react";
import { useAppointmentsToday } from "@/hooks/useAppointmentsToday";
import { AppointmentCard } from "@/components/AppointmentCard";
import { WalkInModal } from "@/components/WalkInModal";
import { Calendar, Users, CheckCircle2, Clock, PlusCircle } from "lucide-react";
import { useUIStore } from "@/store/uiStore";

export default function TodayQueuePage() {
  const { appointments, loading } = useAppointmentsToday();
  const setWalkInModalOpen = useUIStore((state) => state.setWalkInModalOpen);

  const totalBooked = appointments.length;
  const arrived = appointments.filter((a) => a.status === "arrived" || a.status === "in_progress").length;
  const completed = appointments.filter((a) => a.status === "completed").length;

  return (
    <div className="space-y-6">
      <WalkInModal />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Today</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{totalBooked}</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Waiting / In Consult</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-2">{arrived}</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{completed}</p>
        </div>
      </div>

      {/* Header & Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-teal-400" />
          <h2 className="text-lg font-bold text-white">Today's Live Queue</h2>
        </div>
        <button
          onClick={() => setWalkInModalOpen(true)}
          className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1"
        >
          <PlusCircle className="w-3.5 h-3.5" /> Walk-In
        </button>
      </div>

      {/* Queue List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-800/50 border border-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-8 text-center">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No Appointments Today Yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Patients who message your WhatsApp number will automatically appear here via Agent 1 (AppointmentFlow).
          </p>
          <button
            onClick={() => setWalkInModalOpen(true)}
            className="mt-4 px-4 py-2 bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-bold rounded-xl"
          >
            Add First Walk-In Patient
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((app) => (
            <AppointmentCard key={app.appointment_id} appointment={app} />
          ))}
        </div>
      )}
    </div>
  );
}
