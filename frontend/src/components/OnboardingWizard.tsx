"use client";

import React, { useState } from "react";
import { Activity, Check, ArrowRight, Building, User, Phone, MapPin, DollarSign } from "lucide-react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [clinicName, setClinicName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("Tirupati, AP");
  const [newFee, setNewFee] = useState(300);
  const [followupFee, setFollowupFee] = useState(150);
  const [whatsappPhoneId, setWhatsappPhoneId] = useState("");
  const [loading, setLoading] = useState(false);
  const setClinic = useClinicStore((state) => state.setClinic);

  const handleFinish = async () => {
    try {
      setLoading(true);
      const res = await api.post("/clinics/setup", {
        clinic_name: clinicName || "My General Clinic",
        doctor_name: doctorName || "Doctor",
        phone: phone || "+919876543210",
        location: location,
        consultation_fees: {
          new_patient_paise: newFee * 100,
          followup_paise: followupFee * 100,
          procedure_paise: 50000
        },
        whatsapp_phone_id: whatsappPhoneId || "default_phone_id"
      });

      setClinic(
        res.data.clinic_id,
        doctorName || "Doctor",
        clinicName || "My General Clinic"
      );
      onComplete();
    } catch (e) {
      console.error("Onboarding setup failed:", e);
      onComplete(); // Fallback for dev mode
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-6 h-6 text-teal-400" />
          <h2 className="text-xl font-bold text-white">Clinic Onboarding</h2>
          <span className="ml-auto text-xs font-mono text-slate-400">Step {step} of 3</span>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-200">1. Practice Identity</h3>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Clinic Name</label>
              <input
                type="text"
                placeholder="Sri Venkateswara Care Clinic"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Doctor Name</label>
              <input
                type="text"
                placeholder="Dr. K. Ramesh, MBBS, MD"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Clinic Contact Phone</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full mt-4 py-3 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2"
            >
              Continue to Consultation Fees <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-200">2. Consultation Fees & Location</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">New Patient Fee (₹)</label>
                <input
                  type="number"
                  value={newFee}
                  onChange={(e) => setNewFee(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Follow-Up Fee (₹)</label>
                <input
                  type="number"
                  value={followupFee}
                  onChange={(e) => setFollowupFee(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Clinic Address / Location</label>
              <input
                type="text"
                placeholder="Bairagipatteda, Tirupati, AP"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="w-1/3 py-3 bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="w-2/3 py-3 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2"
              >
                Configure WhatsApp AI <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-200">3. Activate All 7 AI Agents</h3>
            <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <Check className="w-4 h-4" /> All 7 AI Agents will be enabled automatically
              </div>
              <p>• Agent 1: AppointmentFlow (WhatsApp Booking)</p>
              <p>• Agent 2: ClinicalScribe (SOAP Note Generation)</p>
              <p>• Agent 3: BillingPulse (UPI Payments & Daily P&L)</p>
              <p>• Agent 4: RetentionRadar (Daily Re-engagement)</p>
              <p>• Agent 5: PrescriptionSafe (Drug Interaction Check)</p>
              <p>• Agent 6: InsightEngine (Weekly Analytics)</p>
              <p>• Agent 7: ReferralCoordinator (Lab/Specialist Tracking)</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="w-1/3 py-3 bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl"
              >
                Back
              </button>
              <button
                onClick={handleFinish}
                disabled={loading}
                className="w-2/3 py-3 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2"
              >
                {loading ? "Activating..." : "Launch VaidyaAI Workspace"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
