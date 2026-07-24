"use client";

import React from "react";
import { Settings, Shield, Cpu, Phone, DollarSign } from "lucide-react";
import { useClinicStore } from "@/store/clinicStore";

export default function SettingsPage() {
  const clinicName = useClinicStore((state) => state.clinicName);
  const doctorName = useClinicStore((state) => state.doctorName);
  const clinicId = useClinicStore((state) => state.clinicId);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-teal-400" />
          <h2 className="text-lg font-bold text-white">Clinic & Agent Settings</h2>
        </div>
        <p className="text-xs text-slate-400 mt-1">Manage practice parameters and agent toggles</p>
      </div>

      <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white border-b border-slate-700 pb-2">Practice Profile</h3>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-400">Clinic Name</span>
            <p className="text-sm font-semibold text-white mt-0.5">{clinicName || "VaidyaAI Clinic"}</p>
          </div>
          <div>
            <span className="text-slate-400">Doctor</span>
            <p className="text-sm font-semibold text-white mt-0.5">Dr. {doctorName || "Doctor"}</p>
          </div>
          <div>
            <span className="text-slate-400">Clinic ID</span>
            <p className="text-xs font-mono text-teal-400 mt-0.5">{clinicId || "demo_clinic_id"}</p>
          </div>
          <div>
            <span className="text-slate-400">GCP Region</span>
            <p className="text-xs font-mono text-slate-300 mt-0.5">asia-south1 (Vertex AI)</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white border-b border-slate-700 pb-2">Active AI Workforce (7 Agents)</h3>
        <div className="space-y-2 text-xs">
          {[
            "Agent 1: AppointmentFlow (WhatsApp Booking)",
            "Agent 2: ClinicalScribe (SOAP Generation)",
            "Agent 3: BillingPulse (UPI Payments & P&L)",
            "Agent 4: RetentionRadar (Daily Re-engagement)",
            "Agent 5: PrescriptionSafe (Drug Interaction Check)",
            "Agent 6: InsightEngine (Weekly Analytics)",
            "Agent 7: ReferralCoordinator (Lab/Specialist Tracking)"
          ].map((agent, idx) => (
            <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
              <span className="font-medium text-slate-200">{agent}</span>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-lg">
                ACTIVE
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
