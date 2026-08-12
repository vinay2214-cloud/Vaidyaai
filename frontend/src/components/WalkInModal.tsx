"use client";

import React, { useState, useEffect } from "react";
import { useUIStore } from "@/store/uiStore";
import { useClinicStore } from "@/store/clinicStore";
import { X, UserPlus, Phone, User, FileText, MapPin, Briefcase, PhoneCall, Loader2 } from "lucide-react";
import api from "@/lib/api";

export function WalkInModal() {
  const isOpen = useUIStore((state) => state.isWalkInModalOpen);
  const setOpen = useUIStore((state) => state.setWalkInModalOpen);
  const clinicId = useClinicStore((state) => state.clinicId);

  const [clinicFees, setClinicFees] = useState<{ new_patient_paise?: number; followup_paise?: number; procedure_paise?: number } | null>(null);

  useEffect(() => {
    if (!isOpen || !clinicId) return;
    let cancelled = false;
    async function loadFees() {
      try {
        const res = await api.get("/clinics/settings");
        if (!cancelled) setClinicFees(res.data?.consultation_fees || null);
      } catch (e) {
        if (!cancelled) setClinicFees(null);
      }
    }
    loadFees();
    return () => { cancelled = true; };
  }, [isOpen, clinicId]);

  const feeLabel = (type: "new" | "followup" | "procedure") => {
    const def = type === "new" ? 30000 : type === "followup" ? 15000 : 50000;
    const paise = type === "new" ? clinicFees?.new_patient_paise : type === "followup" ? clinicFees?.followup_paise : clinicFees?.procedure_paise;
    const rupees = Math.round((paise ?? def) / 100);
    return `₹${rupees}`;
  };

  // Required Fields
  const [phone, setPhone] = useState("");
  const [complaint, setComplaint] = useState("");
  const [consultType, setConsultType] = useState("new");

  // Optional Fields
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [occupation, setOccupation] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) return;
    if (!phone || phone.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    if (!complaint.trim()) {
      setError("Please enter the chief medical complaint");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await api.post("/appointments/walk-in", {
        clinic_id: clinicId,
        patient_phone: phone,
        patient_name: name.trim() || undefined,
        patient_age: age ? parseInt(age, 10) : undefined,
        patient_gender: gender || undefined,
        address: address.trim() || undefined,
        occupation: occupation.trim() || undefined,
        emergency_contact: emergencyContact.trim() || undefined,
        complaint_summary: complaint.trim(),
        consultation_type: consultType,
      });

      // Dispatch event to refresh queue and dashboard statistics immediately
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("vaidyaai_appointment_created"));
      }

      // Close modal and reset form
      setOpen(false);
      setPhone("");
      setName("");
      setAge("");
      setGender("");
      setAddress("");
      setOccupation("");
      setEmergencyContact("");
      setComplaint("");
      setConsultType("new");
    } catch (err: any) {
      console.error("Failed to add walk-in patient:", err);
      setError("Could not register walk-in patient. Please verify details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="walkin-modal-title"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative space-y-4 my-8">
        <button
          onClick={() => setOpen(false)}
          aria-label="Close dialog"
          className="absolute right-4 top-4 text-slate-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/50 rounded-lg p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <UserPlus className="w-5 h-5 text-teal-400" />
          <h2 id="walkin-modal-title" className="text-lg font-bold text-white">Walk-In Patient Registration</h2>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Required Fields Section */}
          <div className="space-y-3">
            <div>
              <label htmlFor="walkin-phone" className="block text-xs font-semibold uppercase tracking-wider text-teal-400 mb-1">
                Mobile Number *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  id="walkin-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="walkin-complaint" className="block text-xs font-semibold uppercase tracking-wider text-teal-400 mb-1">
                Chief Complaint *
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  id="walkin-complaint"
                  name="complaint"
                  type="text"
                  placeholder="Fever & body pain for 2 days"
                  value={complaint}
                  onChange={(e) => setComplaint(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="walkin-consult-type" className="block text-xs font-semibold uppercase tracking-wider text-teal-400 mb-1">
                Consultation Type *
              </label>
              <select
                id="walkin-consult-type"
                name="consultType"
                value={consultType}
                onChange={(e) => setConsultType(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                required
              >
                <option value="new">New Consultation ({feeLabel("new")})</option>
                <option value="followup">Follow-Up Visit ({feeLabel("followup")})</option>
                <option value="procedure">Minor Procedure ({feeLabel("procedure")})</option>
              </select>
            </div>
          </div>

          <div className="border-t border-slate-700/60 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Optional Demographics</p>

            <div className="space-y-3">
              <div>
                <label htmlFor="walkin-name" className="block text-xs text-slate-400 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    id="walkin-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Ramesh Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="walkin-age" className="block text-xs text-slate-400 mb-1">
                    Age / DOB
                  </label>
                  <input
                    id="walkin-age"
                    name="age"
                    type="number"
                    min="0"
                    max="120"
                    placeholder="45"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label htmlFor="walkin-gender" className="block text-xs text-slate-400 mb-1">
                    Gender
                  </label>
                  <select
                    id="walkin-gender"
                    name="gender"
                    autoComplete="sex"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500"
                  >
                    <option value="">Not Recorded</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="walkin-address" className="block text-xs text-slate-400 mb-1">
                  Address
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
                  <input
                    id="walkin-address"
                    name="address"
                    type="text"
                    autoComplete="street-address"
                    placeholder="Sector 4, Hyderabad"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="walkin-occupation" className="block text-xs text-slate-400 mb-1">
                    Occupation
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      id="walkin-occupation"
                      name="occupation"
                      type="text"
                      placeholder="Engineer"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="walkin-emergency" className="block text-xs text-slate-400 mb-1">
                    Emergency Contact
                  </label>
                  <div className="relative">
                    <PhoneCall className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      id="walkin-emergency"
                      name="emergencyContact"
                      type="tel"
                      inputMode="tel"
                      placeholder="98765 00000"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Registering Walk-In Patient...
              </>
            ) : (
              "Register Patient & Add to Queue"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

