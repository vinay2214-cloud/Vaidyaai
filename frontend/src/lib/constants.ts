export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

export const AGENT_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  appointment_flow: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  clinical_scribe: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  billing_pulse: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  retention_radar: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  prescription_safe: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  insight_engine: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  referral_coordinator: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" }
};
