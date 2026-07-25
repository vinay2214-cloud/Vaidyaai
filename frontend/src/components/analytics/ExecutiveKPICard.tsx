import React from "react";
import { KPICard } from "../shared/KPICard";
import { Users, CheckCircle2, IndianRupee, Clock, Bot, Smile, AlertCircle, HeartPulse, Activity } from "lucide-react";

export interface ExecutiveMetrics {
  patients_today: number;
  completed_consultations: number;
  revenue_today_rupees: number;
  collection_rate_pct: number;
  avg_consultation_time_mins: number;
  ai_decisions_today: number;
  patient_satisfaction_pct: number;
  noshow_rate_pct: number;
  followup_compliance_pct: number;
}

interface ExecutiveKPICardProps {
  metrics: ExecutiveMetrics;
  className?: string;
}

export const ExecutiveKPICard: React.FC<ExecutiveKPICardProps> = ({ metrics, className }) => {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 ${className || ""}`}>
      <KPICard title="Patients Today" value={metrics.patients_today} subtitle="Registered queue" icon={Users} color="blue" />
      <KPICard title="Completed Consults" value={metrics.completed_consultations} subtitle="Finished SOAP notes" icon={CheckCircle2} color="emerald" />
      <KPICard title="Revenue Today" value={`₹${metrics.revenue_today_rupees}`} subtitle="UPI + Cash collected" icon={IndianRupee} color="teal" trend="+18%" />
      <KPICard title="Collection Rate" value={`${metrics.collection_rate_pct}%`} subtitle="100% BillingPulse UPI" icon={Activity} color="emerald" />
      <KPICard title="Avg Consult Time" value={`${metrics.avg_consultation_time_mins} min`} subtitle="ClinicalScribe active" icon={Clock} color="amber" />
      <KPICard title="AI Decisions Today" value={metrics.ai_decisions_today} subtitle="Autonomous agent tasks" icon={Bot} color="purple" />
      <KPICard title="Patient Rating" value={`${metrics.patient_satisfaction_pct}%`} subtitle="WhatsApp CSAT Feedback" icon={Smile} color="indigo" />
      <KPICard title="No-Show Rate" value={`${metrics.noshow_rate_pct}%`} subtitle="-40% recovery" icon={AlertCircle} color="rose" />
      <KPICard title="Follow-Up Rate" value={`${metrics.followup_compliance_pct}%`} subtitle="RetentionRadar track" icon={HeartPulse} color="teal" trend="High" />
    </div>
  );
};
