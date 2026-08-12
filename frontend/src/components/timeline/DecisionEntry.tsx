import React from "react";
import { AgentChip } from "./AgentChip";
import { LatencyBadge } from "./LatencyBadge";
import { StatusBadge } from "../shared/StatusBadge";
import { Clock, Cpu, AlertTriangle, CheckCircle, ChevronRight } from "lucide-react";
import clsx from "clsx";

export interface LogData {
  id: string;
  agent_name: string;
  decision_type: string;
  decision_made: string;
  clinic_id: string;
  input_summary?: string;
  output_summary?: string;
  model_used?: string;
  latency_ms?: number;
  confidence?: number;
  patient_phone_masked?: string;
  success?: boolean;
  created_at?: any;
}

interface DecisionEntryProps {
  log: LogData;
  className?: string;
}

export const DecisionEntry: React.FC<DecisionEntryProps> = ({ log, className }) => {
  const isError = log.success === false;
  const formattedTime = log.created_at
    ? typeof log.created_at === "string"
      ? new Date(log.created_at).toLocaleTimeString()
      : log.created_at.seconds
      ? new Date(log.created_at.seconds * 1000).toLocaleTimeString()
      : "Just now"
    : "Just now";

  const confidenceScore = log.confidence ? (log.confidence <= 1 ? Math.round(log.confidence * 100) : Math.round(log.confidence)) : null;
  const modelName = log.model_used || "—";

  return (
    <div
      className={clsx(
        "relative pl-6 pb-6 border-l-2 transition-all duration-300 animate-in fade-in slide-in-from-top-2",
        isError ? "border-rose-500/60" : "border-slate-700/60 hover:border-teal-500/60",
        className
      )}
    >
      {/* Timeline Node Bullet */}
      <div
        className={clsx(
          "absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 bg-slate-900 flex items-center justify-center",
          isError ? "border-rose-500 text-rose-500" : "border-teal-400 text-teal-400"
        )}
      >
        <span className={clsx("w-1.5 h-1.5 rounded-full", isError ? "bg-rose-500" : "bg-teal-400")} />
      </div>

      {/* Entry Container Card */}
      <div
        className={clsx(
          "bg-slate-800/80 border rounded-2xl p-4 space-y-3 shadow-sm hover:border-slate-600 transition-colors",
          isError ? "border-rose-500/40 bg-rose-950/20" : "border-slate-700/60"
        )}
      >
        {/* Header Row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <AgentChip agentName={log.agent_name} />
            <StatusBadge
              label={log.decision_type}
              variant={isError ? "error" : "info"}
              size="sm"
            />
            {isError ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/30">
                <AlertTriangle className="w-3 h-3" /> FAILED
              </span>
            ) : confidenceScore ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30 font-mono">
                <CheckCircle className="w-3 h-3" /> {confidenceScore}% confidence
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/30 font-mono">
                <CheckCircle className="w-3 h-3" /> Verified Decision
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" /> {formattedTime}
            </span>
            <span>•</span>
            <LatencyBadge latencyMs={log.latency_ms} />
          </div>
        </div>

        {/* Decision Content */}
        <div className="space-y-1.5">
          <h4 className="text-sm font-bold text-white leading-snug">{log.decision_made}</h4>
          
          {log.input_summary && (
            <p className="text-xs text-slate-300 bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-800 font-mono">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] block mb-0.5">Input Context:</span>
              {log.input_summary}
            </p>
          )}

          {log.output_summary && (
            <p className="text-xs text-slate-300 bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-800 font-mono">
              <span className="text-teal-400 font-semibold uppercase tracking-wider text-[10px] block mb-0.5">Output Action:</span>
              {log.output_summary}
            </p>
          )}
        </div>

        {/* Error Details Visualization */}
        {isError && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 space-y-1">
            <span className="font-bold flex items-center gap-1 text-rose-400">
              <AlertTriangle className="w-4 h-4" /> Agent Failure Warning
            </span>
            <p className="font-mono text-[11px]">
              Agent execution returned error response. Automatic retry or emergency doctor fallback initiated.
            </p>
          </div>
        )}

        {/* Footer Meta Row */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700/40 text-[11px] text-slate-400 font-mono">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-teal-400" />
            Model: <span className="text-slate-200 font-semibold">{modelName}</span>
          </span>

          {log.patient_phone_masked && (
            <span>Patient: {log.patient_phone_masked}</span>
          )}
        </div>
      </div>
    </div>
  );
};
