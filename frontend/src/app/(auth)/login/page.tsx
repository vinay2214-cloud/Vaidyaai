"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { setSessionCookie, isDevAuthBypassEnabled, DEV_CLINIC_DATA } from "@/lib/auth";
import { useClinicStore } from "@/store/clinicStore";
import { Activity, Phone, ArrowRight, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const setClinic = useClinicStore((state) => state.setClinic);

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, "recaptcha-container", {
        size: "invisible",
        callback: () => {}
      });
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    setError(null);
    setLoading(true);

    if (isDevAuthBypassEnabled()) {
      console.info("[VaidyaAI Dev Auth] Executing development authentication bypass...");
      setClinic(
        DEV_CLINIC_DATA.clinicId,
        DEV_CLINIC_DATA.doctorName,
        DEV_CLINIC_DATA.clinicName,
        DEV_CLINIC_DATA.role
      );
      setSessionCookie();
      setLoading(false);
      if (typeof window !== "undefined") {
        window.location.assign("/");
      } else {
        router.push("/");
      }
      return;
    }

    try {
      setupRecaptcha();
      const appVerifier = (window as any).recaptchaVerifier;
      const formattedPhone = phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber.replace(/\D/g, "")}`;
      
      const result = await signInWithPhoneNumber(firebaseAuth, formattedPhone, appVerifier);
      setConfirmationResult(result);
      setStep("otp");
    } catch (err: any) {
      console.error("SMS send error:", err);
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
        } catch (e) {}
        (window as any).recaptchaVerifier = null;
      }
      setError("Could not send the verification code. Please check the number and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!confirmationResult) {
        setError("Verification session expired. Please request a new code.");
        setStep("phone");
        return;
      }
      await confirmationResult.confirm(otp);
      setSessionCookie();
      if (typeof window !== "undefined") {
        window.location.assign("/");
      } else {
        router.push("/");
      }
    } catch (err: any) {
      console.error("OTP verification error:", err);
      setError("Invalid or expired verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div id="recaptcha-container"></div>
      
      <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-teal-500/10 border border-teal-500/30 rounded-2xl flex items-center justify-center mb-3">
            <Activity className="w-8 h-8 text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">VaidyaAI Agents</h1>
          <p className="text-slate-400 text-sm mt-1">Autonomous AI Workforce for Solo Clinics</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm rounded-xl text-center">
            {error}
          </div>
        )}

        {step === "phone" ? (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div>
              <label htmlFor="doctor-phone" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Doctor Mobile Number
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3.5 text-slate-400 font-medium text-sm">+91</span>
                <input
                  id="doctor-phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full pl-14 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-mono text-sm"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? "Authenticating..." : <>Get Verification Code <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <label htmlFor="otp-code" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Enter 6-Digit Verification OTP
              </label>
              <input
                id="otp-code"
                name="one-time-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-center font-mono text-xl tracking-widest focus:outline-none focus:border-teal-500"
                required
              />
              <p className="text-xs text-slate-500 text-center mt-2">Enter the 6-digit code sent to your mobile.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? "Verifying..." : <>Verify & Access Dashboard <ShieldCheck className="w-4 h-4" /></>}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-slate-700/50 text-center text-xs text-slate-500">
          Built for Indian solo practitioners • Protected by DPDP Act 2023
        </div>
      </div>
    </div>
  );
}
