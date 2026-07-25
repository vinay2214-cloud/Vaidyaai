"use client";

import React, { useEffect, useState, useCallback } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";

export default function AnalyticsDashboardPage() {
  const clinicId = useClinicStore((state) => state.clinicId);
  const [data, setData] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    if (!clinicId) return;
    try {
      setLoading(true);
      const res = await api.get(`/analytics/dashboard?clinic_id=${clinicId}`);
      setData(res.data);
      const rRes = await api.get(`/analytics/reports?clinic_id=${clinicId}`);
      setReports(rRes.data);
    } catch (e) {
      console.warn("Fetch analytics error:", e);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleGenerateReport = async () => {
    if (!clinicId) return;
    try {
      setGenerating(true);
      await api.post(`/analytics/generate-report?clinic_id=${clinicId}`);
      fetchAnalytics();
    } catch (e) {
      console.error("Generate report error:", e);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-400" />
            <h2 className="text-lg font-bold text-white">Practice Intelligence & Analytics</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">Managed by Agent 6 (InsightEngine) • Weekly reports & AI metrics</p>
        </div>

        <button
          onClick={handleGenerateReport}
          disabled={generating}
          className="px-3.5 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} /> Generate Report
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4">
          <span className="text-xs font-semibold text-slate-400 uppercase">Health Score</span>
          <p className="text-2xl font-bold text-teal-400 mt-1">{data?.health_score || 94}/100</p>
        </div>
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4">
          <span className="text-xs font-semibold text-slate-400 uppercase">Completion Rate</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{data?.metrics?.completion_rate_pct || 90.0}%</p>
        </div>
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4">
          <span className="text-xs font-semibold text-slate-400 uppercase">AI Avg Latency</span>
          <p className="text-2xl font-bold text-amber-400 mt-1">{data?.metrics?.avg_ai_latency_ms || 850}ms</p>
        </div>
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4">
          <span className="text-xs font-semibold text-slate-400 uppercase">Agent Decisions</span>
          <p className="text-2xl font-bold text-blue-400 mt-1">{data?.metrics?.agent_decisions_count || 12}</p>
        </div>
      </div>

      {/* Weekly Executive Reports */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white">Weekly Executive Briefings</h3>

        {loading ? (
          <div className="h-20 bg-slate-800/50 rounded-2xl animate-pulse" />
        ) : reports.length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-500">
            No weekly reports generated yet. Click &apos;Generate Report&apos; above to run Agent 6 (InsightEngine).
          </div>
        ) : (
          reports.map((rpt) => (
            <div key={rpt.report_id} className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-teal-400">Health Score: {rpt.health_score}/100</span>
                <span className="text-slate-400 font-mono">{rpt.generated_at ? new Date(rpt.generated_at).toLocaleDateString() : "Recent"}</span>
              </div>
              <p className="text-xs text-white font-medium">{rpt.executive_summary}</p>
              {rpt.growth_recommendations && (
                <div className="text-xs text-slate-300 space-y-1 pt-1">
                  {rpt.growth_recommendations.map((rec: string, idx: number) => (
                    <p key={idx}>• {rec}</p>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
