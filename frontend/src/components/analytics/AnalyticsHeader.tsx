import React from "react";
import { BarChart3, RefreshCw, Cpu, Sparkles } from "lucide-react";
import { ExportPanel } from "./ExportPanel";

interface AnalyticsHeaderProps {
  healthScore: number;
  lastUpdated: string;
  onGenerateReport: () => void;
  isGenerating: boolean;
  onExport: (type: "csv" | "json" | "pdf") => void;
  className?: string;
}

export const AnalyticsHeader: React.FC<AnalyticsHeaderProps> = ({
  healthScore,
  lastUpdated,
  onGenerateReport,
  isGenerating,
  onExport,
  className
}) => {
  return (
    <div className={`space-y-4 ${className || ""}`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-400" />
            <h2 className="text-lg font-bold text-white">Practice Intelligence Center</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Executive Cockpit Managed by Agent 6 (InsightEngine) • Gemini 1.5 Pro Intelligence
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onGenerateReport}
            disabled={isGenerating}
            className="px-3.5 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-lg shadow-teal-500/10"
          >
            <RefreshCw className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} /> Run InsightEngine Report
          </button>

          <ExportPanel onExport={onExport} />
        </div>
      </div>
    </div>
  );
};
