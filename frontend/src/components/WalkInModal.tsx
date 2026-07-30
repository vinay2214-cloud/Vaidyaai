"use client";

import React, { useState } from "react";
import { useUIStore } from "@/store/uiStore";
import { useClinicStore } from "@/store/clinicStore";
import { X, UserPlus, Phone, User, FileText } from "lucide-react";
import api from "@/lib/api";

export function WalkInModal() {
  const isOpen = useUIStore((state) => state.isWalkInModalOpen);
  const setOpen = useUIStore((state) => state.setWalkInModalOpen);
  const clinicId = useClinicStore((state) => state.clinicId);

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [complaint, setComplaint] = useState("");
  const [consultType, setConsultType] = useState("new");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) return;
    if (!phone || phone.length < 10) {
      setError("Please enter a valid mobile number");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const apptRes = await api.post("/appointments/walk-in", {
        clinic_id: clinicId,
        patient_phone: phone,
        patient_name: name || undefined,
        complaint_summary: complaint || "Walk-in Consultation",
        consultation_type: consultType
      });

      const appointmentId = apptRes.data.appointment_id;
      const patientId = apptRes.data.patient_id;

      const consRes = await api.post("/consultations/start", {
        clinic_id: clinicId,
        appointment_id: appointmentId
      });

      const newConsId = consRes.data.consultation_id;
      const resetConsultation = useClinicStore.getState().resetConsultation;
      const setActiveConsultation = useClinicStore.getState().setActiveConsultation;

      resetConsultation();
      setActiveConsultation(newConsId, patientId, appointmentId);

      setOpen(false);
      setPhone("");
      setName("");
      setComplaint("");

      window.location.assign(`/consultation/${newConsId}?appointment_id=${appointmentId}`);
    } catch (err: any) {
      console.error("Failed to add walk-in:", err);
      setError("Could not add walk-in patient. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
        <button
          onClick={() => setOpen(false)}
          aria-label="Close dialog"
          className="absolute right-4 top-4 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-6">
          <UserPlus className="w-5 h-5 text-teal-400" />
          <h2 className="text-lg font-bold text-white">Add Walk-In Patient</h2>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Patient Mobile Number *
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="tel"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-teal-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Patient Full Name (Optional)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Ramesh Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Primary Medical Complaint
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Fever & body pain for 2 days"
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Consultation Type
            </label>
            <select
              value={consultType}
              onChange={(e) => setConsultType(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500"
            >
              <option value="new">New Patient (₹300)</option>
              <option value="followup">Follow-Up (₹150)</option>
              <option value="procedure">Minor Procedure (₹500)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add to Queue & Mark Arrived"}
          </button>
        </form>
      </div>
    </div>
  );
}
