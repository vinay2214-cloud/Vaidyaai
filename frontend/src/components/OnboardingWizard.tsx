"use client";

import React, { useState } from "react";
import {
  Activity,
  Check,
  ArrowRight,
  ArrowLeft,
  Building2,
  UserCheck,
  CreditCard,
  Bot,
  Sparkles,
  Globe,
  Clock,
  ShieldCheck,
  Stethoscope
} from "lucide-react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";
import { setSessionCookie, isDevAuthBypassEnabled } from "@/lib/auth";

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const setClinic = useClinicStore((state) => state.setClinic);

  // Step 1: Practice Identity
  const [clinicName, setClinicName] = useState("");
  const [address, setAddress] = useState("Bairagipatteda, Tirupati, AP");
  const [country, setCountry] = useState("India");
  const [timezone, setTimezone] = useState("IST (Asia/Kolkata)");
  const [contactPhone, setContactPhone] = useState("+91 98765 43210");

  // Step 2: Administrator Profile
  const [doctorName, setDoctorName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminMobile, setAdminMobile] = useState("");
  const [specialty, setSpecialty] = useState("General Practice & Internal Medicine");

  // Step 3: Financial & Operations
  const [currency, setCurrency] = useState("INR (₹)");
  const [newFee, setNewFee] = useState(300);
  const [followupFee, setFollowupFee] = useState(150);
  const [taxSetting, setTaxSetting] = useState("Exempt (Healthcare Services)");
  const [workingHours, setWorkingHours] = useState("09:00 AM - 09:00 PM IST");

  // Step 4: AI Configuration Toggles
  const [aiAgents, setAiAgents] = useState({
    scribe: true,
    billing: true,
    prescription: true,
    insights: true,
    referral: true,
    appointments: true,
    retention: true
  });

  const toggleAgent = (key: keyof typeof aiAgents) => {
    setAiAgents((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFinish = async () => {
    try {
      setLoading(true);
      const res = await api.post("/clinics/setup", {
        clinic_name: clinicName.trim() || "Arogya Family Practice",
        doctor_name: doctorName.trim() || "Dr. Ramesh",
        phone: contactPhone || adminMobile || "+919876543210",
        location: address,
        consultation_fees: {
          new_patient_paise: newFee * 100,
          followup_paise: followupFee * 100,
          procedure_paise: 50000
        },
        whatsapp_phone_id: "default_phone_id"
      });

      setClinic(
        res.data.clinic_id,
        doctorName.trim() || "Dr. Ramesh",
        clinicName.trim() || "Arogya Family Practice",
        "administrator"
      );
      setSessionCookie();
      onComplete();
    } catch (e: any) {
      console.error("[VaidyaAI Onboarding] Setup failed:", e);
      if (isDevAuthBypassEnabled()) {
        // Fallback for dev mode only
        setClinic(
          "cln_e2e_test_clinic",
          doctorName.trim() || "Dr. Ramesh",
          clinicName.trim() || "Arogya Family Practice",
          "administrator"
        );
        setSessionCookie();
        onComplete();
      } else {
        alert(e?.response?.data?.detail || "Clinic setup failed. Please verify backend connection and credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl my-auto">
        {/* Header Branding & Step Counter */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Enterprise Clinic Setup</h2>
              <p className="text-xs text-slate-400">VaidyaAI Autonomous Healthcare Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-3 py-1 bg-slate-800 border border-slate-700 text-teal-400 rounded-full">
              Step {step} of 5
            </span>
          </div>
        </div>

        {/* Step Progress Visual Bar */}
        <div className="grid grid-cols-5 gap-2 my-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i <= step ? "bg-teal-400 shadow-sm shadow-teal-500/50" : "bg-slate-800"
              }`}
            />
          ))}
        </div>

        {/* STEP 1: Organization & Practice Identity */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-center gap-2 text-teal-400 font-semibold text-sm">
              <Building2 className="w-4 h-4" /> 1. Healthcare Organization & Practice Identity
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Clinic / Hospital Name *</label>
              <input
                type="text"
                placeholder="e.g. Arogya Wellness General Clinic"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Practice Location / Address</label>
              <input
                type="text"
                placeholder="Bairagipatteda, Tirupati, Andhra Pradesh"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Timezone</label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500 font-mono text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Primary Reception / WhatsApp Phone</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full mt-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition-all"
            >
              Next: Medical Director Profile <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2: Administrator Profile */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-center gap-2 text-teal-400 font-semibold text-sm">
              <UserCheck className="w-4 h-4" /> 2. Medical Director / Administrator Profile
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Administrator / Doctor Full Name *</label>
              <input
                type="text"
                placeholder="Dr. K. Ramesh, MBBS, MD"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Medical Specialty</label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500"
              >
                <option value="General Practice & Internal Medicine">General Practice & Internal Medicine</option>
                <option value="Cardiology">Cardiology</option>
                <option value="Pediatrics">Pediatrics</option>
                <option value="Orthopedics">Orthopedics</option>
                <option value="ENT & Pulmonology">ENT & Pulmonology</option>
                <option value="Dermatology">Dermatology</option>
                <option value="Gynecology & Obstetrics">Gynecology & Obstetrics</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Admin Email</label>
                <input
                  type="email"
                  placeholder="dr.ramesh@vaidyaai.local"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Admin Mobile</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={adminMobile}
                  onChange={(e) => setAdminMobile(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setStep(1)}
                className="w-1/3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="w-2/3 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20"
              >
                Next: Business Setup <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Financial & Operations */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-center gap-2 text-teal-400 font-semibold text-sm">
              <CreditCard className="w-4 h-4" /> 3. Business Configuration & Tariff Schedule
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">New Patient Fee (₹)</label>
                <input
                  type="number"
                  value={newFee}
                  onChange={(e) => setNewFee(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Follow-Up Fee (₹)</label>
                <input
                  type="number"
                  value={followupFee}
                  onChange={(e) => setFollowupFee(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Tax & Billing Policy</label>
              <input
                type="text"
                value={taxSetting}
                onChange={(e) => setTaxSetting(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Operating Clinic Hours</label>
              <input
                type="text"
                value={workingHours}
                onChange={(e) => setWorkingHours(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500 font-mono text-xs"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setStep(2)}
                className="w-1/3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="w-2/3 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20"
              >
                Next: AI Workforce Configuration <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: AI Workforce Setup */}
        {step === 4 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-teal-400 font-semibold text-sm">
                <Bot className="w-4 h-4" /> 4. AI Agents & Clinical Automation
              </div>
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> 7 Agents Pre-Configured
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {[
                { key: "scribe", name: "ClinicalScribe Agent", desc: "Ambient Speech-to-Text & ICD-10 SOAP Generation" },
                { key: "billing", name: "BillingPulse Agent", desc: "Razorpay UPI Payment Links & Daily P&L Briefing" },
                { key: "prescription", name: "PrescriptionSafe Agent", desc: "Drug Interaction & Allergy Safety Guard" },
                { key: "insights", name: "InsightEngine Agent", desc: "Weekly Executive Performance & Clinical Briefing" },
                { key: "referral", name: "ReferralCoordinator Agent", desc: "Specialist Referral Letter Generation" },
                { key: "appointments", name: "AppointmentFlow Agent", desc: "WhatsApp Slot Booking & Reminders" },
                { key: "retention", name: "RetentionRadar Agent", desc: "Patient Follow-up & Outreach Radar" }
              ].map((agent) => (
                <div
                  key={agent.key}
                  onClick={() => toggleAgent(agent.key as any)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                    aiAgents[agent.key as keyof typeof aiAgents]
                      ? "bg-slate-950 border-teal-500/40 text-white"
                      : "bg-slate-950/40 border-slate-800 text-slate-500"
                  }`}
                >
                  <div>
                    <p className="text-xs font-semibold">{agent.name}</p>
                    <p className="text-[11px] text-slate-400">{agent.desc}</p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                      aiAgents[agent.key as keyof typeof aiAgents]
                        ? "bg-teal-500 border-teal-400 text-slate-950"
                        : "border-slate-700"
                    }`}
                  >
                    {aiAgents[agent.key as keyof typeof aiAgents] && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setStep(3)}
                className="w-1/3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => setStep(5)}
                className="w-2/3 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20"
              >
                Next: Confirm & Provision <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Final Review & Activation */}
        {step === 5 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-center gap-2 text-teal-400 font-semibold text-sm">
              <ShieldCheck className="w-4 h-4" /> 5. Confirm Enterprise Activation
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 text-xs text-slate-300">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Clinic Name:</span>
                <span className="font-semibold text-white">{clinicName || "Arogya Family Practice"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Medical Director:</span>
                <span className="font-semibold text-white">{doctorName || "Dr. Ramesh"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Consultation Fees:</span>
                <span className="font-mono text-teal-400">₹{newFee} / ₹{followupFee}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">AI Agents Active:</span>
                <span className="text-emerald-400 font-semibold">7 / 7 Active</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Clicking <strong className="text-slate-200">Activate Workspace</strong> will execute server-side provisioning (`POST /api/v1/clinics/setup`), establish PostgreSQL database schemas, write Firestore tenant collections, and assign Firebase Custom User Claims.
            </p>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setStep(4)}
                className="w-1/3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleFinish}
                disabled={loading}
                className="w-2/3 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-teal-500/25 transition-all"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Activity className="w-4 h-4 animate-spin" /> Provisioning Workspace...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Activate VaidyaAI Workspace
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
