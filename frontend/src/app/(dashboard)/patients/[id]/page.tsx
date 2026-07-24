"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { User, Phone, Calendar, HeartPulse, ArrowLeft, FileText, Pill, FileCode, ShieldAlert } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";

export default function PatientDetailPage() {
  const params = useParams();
  const patientId = (params?.id as string) || "pat_demo";
  const clinicId = useClinicStore((state) => state.clinicId);

  const [timeline, setTimeline] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId || !patientId) return;
    const fetchTimeline = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/patients/${patientId}/timeline?clinic_id=${clinicId}`);
        setTimeline(res.data);
      } catch (e) {
        console.warn("Fetch timeline error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchTimeline();
  }, [clinicId, patientId]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-20 bg-slate-800 rounded-2xl" />
        <div className="h-40 bg-slate-800 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/patients" className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-teal-400" /> {timeline?.name || "Patient Medical Record"}
          </h1>
          <p className="text-xs text-slate-400 font-mono">ID: {patientId} • {timeline?.phone_masked}</p>
        </div>
      </div>

      {/* Allergies & Chronic Conditions */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-1">
          <span className="text-xs font-bold uppercase text-rose-400 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" /> Known Allergies
          </span>
          <p className="text-xs text-white">
            {timeline?.allergies && timeline.allergies.length > 0
              ? timeline.allergies.join(", ")
              : "No known drug allergies reported"}
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-1">
          <span className="text-xs font-bold uppercase text-amber-400 flex items-center gap-1">
            <HeartPulse className="w-3.5 h-3.5" /> Chronic Conditions
          </span>
          <p className="text-xs text-white">
            {timeline?.chronic_conditions && timeline.chronic_conditions.length > 0
              ? timeline.chronic_conditions.join(", ")
              : "No chronic conditions recorded"}
          </p>
        </div>
      </div>

      {/* Longitudinal Timeline */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-teal-400" /> Longitudinal Clinical Timeline ({timeline?.total_visits || 0} Visits)
        </h3>

        {!timeline?.appointments || timeline.appointments.length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-500">
            No past visits recorded for this patient.
          </div>
        ) : (
          timeline.appointments.map((app: any) => (
            <div key={app.appointment_id} className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">{app.slot_date} • {app.slot_time_str}</span>
                <span className="px-2 py-0.5 bg-teal-500/10 border border-teal-500/30 text-teal-300 font-mono rounded-md uppercase">
                  {app.status}
                </span>
              </div>
              {app.complaint_summary && (
                <p className="text-xs text-slate-300 italic">"{app.complaint_summary}"</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
