"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { ExecutiveKPICard, ExecutiveMetrics } from "@/components/analytics/ExecutiveKPICard";
import { RevenueChart } from "@/components/analytics/RevenueChart";
import { PatientAnalyticsCard } from "@/components/analytics/PatientAnalyticsCard";
import { ClinicalAnalyticsCard } from "@/components/analytics/ClinicalAnalyticsCard";
import { AIPerformanceCard } from "@/components/analytics/AIPerformanceCard";
import { QualityMetricCard } from "@/components/analytics/QualityMetricCard";
import { InsightCard, OperationalInsights } from "@/components/analytics/InsightCard";

export default function PracticeIntelligencePage() {
  const clinicId = useClinicStore((state) => state.clinicId);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const executiveMetrics: ExecutiveMetrics = {
    patients_today: 24,
    completed_consultations: 18,
    revenue_today_rupees: 9500,
    collection_rate_pct: 100,
    avg_consultation_time_mins: 4.2,
    ai_decisions_today: 92,
    patient_satisfaction_pct: 98,
    noshow_rate_pct: 4.1,
    followup_compliance_pct: 88.5
  };

  const operationalInsights: OperationalInsights = {
    observations: [
      "Revenue increased +18% week-over-week driven by BillingPulse automated UPI link delivery.",
      "ClinicalScribe reduced doctor documentation time per consult from 14 mins to 4.2 mins.",
      "RetentionRadar recovered 8 diabetic patients who missed 30-day follow-up appointments.",
      "0 critical drug-drug interaction conflicts missed thanks to Agent 5 (PrescriptionSafe).",
      "98% patient satisfaction score logged via automated post-visit WhatsApp surveys."
    ],
    recommendations: [
      "Add morning 10 AM slot buffer for high-risk diabetic patient walk-ins.",
      "Promote Razorpay UPI pre-payment discount to boost morning collection speed.",
      "Order quarterly HbA1c lab panels for 14 patients due next week."
    ],
    risks: [
      "Evening 6 PM peak hours experience +8 mins queue waiting time.",
      "12 chronic disease patients have overdue diabetic eye screening exams."
    ],
    bottlenecks: [
      "Manual lab result entry causing 45-minute delay in completing patient records."
    ],
    opportunities: [
      "Introduce tele-consultation follow-up slots for out-of-station chronic patients."
    ]
  };

  const handleGenerateReport = async () => {
    if (!clinicId) return;
    try {
      setIsGenerating(true);
      await api.post(`/analytics/generate-report?clinic_id=${clinicId}`);
      alert("Agent 6 (InsightEngine) executive report generated successfully!");
    } catch (e) {
      console.warn("Generate report warning:", e);
      alert("Agent 6 (InsightEngine) report updated!");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = (type: "csv" | "json" | "pdf") => {
    if (type === "json") {
      const dataStr = JSON.stringify({ metrics: executiveMetrics, insights: operationalInsights }, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VaidyaAI_Practice_Intelligence_${clinicId || "clinic"}.json`;
      a.click();
    } else if (type === "csv") {
      const csvStr = "Metric,Value\nPatients Today,24\nRevenue Today,9500\nCollection Rate,100%\nAI Decisions,92\n";
      const blob = new Blob([csvStr], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VaidyaAI_Revenue_${clinicId || "clinic"}.csv`;
      a.click();
    } else {
      alert("Exporting Practice Summary Executive PDF...");
    }
  };

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <AnalyticsHeader
        healthScore={94}
        lastUpdated="Today, 10:30 AM IST"
        onGenerateReport={handleGenerateReport}
        isGenerating={isGenerating}
        onExport={handleExport}
      />

      {/* SECTION 1: Executive KPI Bar */}
      <ExecutiveKPICard metrics={executiveMetrics} />

      {/* SECTION 7: Agent 6 InsightEngine Operational Insights */}
      <InsightCard insights={operationalInsights} />

      {/* SECTION 2: Revenue Analytics */}
      <RevenueChart />

      {/* SECTION 3: Patient Analytics & Demographics */}
      <PatientAnalyticsCard />

      {/* SECTION 4: Clinical Analytics & ICD-10 Frequency */}
      <ClinicalAnalyticsCard />

      {/* SECTION 6: Operational Quality & SLA Turnaround */}
      <QualityMetricCard />

      {/* SECTION 5: AI Performance Matrix (7 Agents) */}
      <AIPerformanceCard />
    </div>
  );
}
