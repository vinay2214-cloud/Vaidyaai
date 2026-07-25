"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Users, Search, HeartPulse, ChevronRight } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";

export default function PatientsPage() {
  const clinicId = useClinicStore((state) => state.clinicId);
  const [searchTerm, setSearchTerm] = useState("");
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPatients = useCallback(async () => {
    if (!clinicId) return;
    try {
      setLoading(true);
      const url = searchTerm
        ? `/patients?clinic_id=${clinicId}&search=${encodeURIComponent(searchTerm)}`
        : `/patients?clinic_id=${clinicId}`;
      const res = await api.get(url);
      setPatients(res.data);
    } catch (e) {
      console.warn("Fetch patients error:", e);
    } finally {
      setLoading(false);
    }
  }, [clinicId, searchTerm]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-400" />
            <h2 className="text-lg font-bold text-white">Patient Records</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">DPDP Act 2023 Compliant • Encrypted PHI & Consent Audit</p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
        <input
          type="text"
          placeholder="Search patients by name or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500"
        />
      </div>

      {/* Patient List */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-800/50 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : patients.length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500">
            <HeartPulse className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-300">No Patient Records Found</h3>
            <p className="max-w-sm mx-auto mt-1">
              Patients who book via WhatsApp or Walk-in modal will automatically appear here.
            </p>
          </div>
        ) : (
          patients.map((pat) => (
            <Link
              key={pat.patient_id}
              href={`/patients/${pat.patient_id}`}
              className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-slate-600 transition-colors block"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-500/10 border border-teal-500/30 rounded-xl flex items-center justify-center text-teal-400 font-bold">
                  {pat.name ? pat.name.charAt(0).toUpperCase() : "P"}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{pat.name || "Patient"}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {pat.patient_phone_masked} • Age: {pat.age || "N/A"} • Gender: {pat.gender || "N/A"}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
