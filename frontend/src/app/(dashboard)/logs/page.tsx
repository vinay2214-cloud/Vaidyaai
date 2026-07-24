"use client";

import React from "react";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { AgentStatusBar } from "@/components/AgentStatusBar";
import { AgentLogFeed } from "@/components/AgentLogFeed";
import { useUIStore } from "@/store/uiStore";
import { Cpu, Download } from "lucide-react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";

export default function AgentLogsPage() {
  const selectedAgentFilter = useUIStore((state) => state.selectedAgentFilter);
  const setSelectedAgentFilter = useUIStore((state) => state.setSelectedAgentFilter);
  const clinicId = useClinicStore((state) => state.clinicId);
  const { logs, loading } = useAgentLogs(selectedAgentFilter);

  const handleExportEvidence = async () => {
    if (!clinicId) return;
    try {
      const res = await api.get(`/analytics/export-evidence?clinic_id=${clinicId}`);
      const jsonStr = JSON.stringify(res.data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vaidyaai_agent_evidence_${clinicId}.json`;
      a.click();
    } catch (e) {
      console.error("Export evidence error:", e);
      alert("Could not export evidence package.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-teal-400" />
            <h2 className="text-lg font-bold text-white">Agent Decision Feed</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">Real-time autonomous decision audit stream across all 7 AI agents</p>
        </div>

        <button
          onClick={handleExportEvidence}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Export Evidence JSON
        </button>
      </div>

      {/* Filter Bar */}
      <AgentStatusBar activeFilter={selectedAgentFilter} onSelectFilter={setSelectedAgentFilter} />

      {/* Decision Logs Feed */}
      <AgentLogFeed logs={logs} loading={loading} />
    </div>
  );
}
