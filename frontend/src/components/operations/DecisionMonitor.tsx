import React, { useState } from "react";
import { DecisionTimeline } from "../timeline/DecisionTimeline";
import { LogData } from "../timeline/DecisionEntry";
import { Bot, Search, Filter } from "lucide-react";

interface DecisionMonitorProps {
  logs: LogData[];
  className?: string;
}

export const DecisionMonitor: React.FC<DecisionMonitorProps> = ({ logs, className }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("ALL");

  const filteredLogs = logs.filter((log) => {
    const matchesAgent = selectedAgent === "ALL" || log.agent_name.toLowerCase() === selectedAgent.toLowerCase();
    const matchesSearch =
      log.decision_made.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.agent_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesAgent && matchesSearch;
  });

  return (
    <div className={`bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4.5 space-y-4 shadow-sm ${className || ""}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-teal-400" />
          <h3 className="text-sm font-bold text-white">Live AI Decision Operations Feed</h3>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search AI decisions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 w-48 font-mono"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
        {["ALL", "ClinicalScribe", "PrescriptionSafe", "BillingPulse", "RetentionRadar", "InsightEngine"].map((agent) => (
          <button
            key={agent}
            onClick={() => setSelectedAgent(agent)}
            className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors border ${
              selectedAgent === agent
                ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                : "bg-slate-900 text-slate-400 border-slate-700"
            }`}
          >
            {agent}
          </button>
        ))}
      </div>

      {/* Timeline Stream */}
      <DecisionTimeline logs={filteredLogs} />
    </div>
  );
};
