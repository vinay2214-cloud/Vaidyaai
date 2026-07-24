"use client";

import React from "react";
import { AgentLog } from "@/hooks/useAgentLogs";
import { AGENT_COLOR_MAP } from "@/lib/constants";
import { Cpu, CheckCircle2, AlertTriangle, Clock, Zap } from "lucide-react";

export function AgentLogFeed({ logs, loading }: { logs: AgentLog[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-slate-800/40 border border-slate-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-8 text-center">
        <Cpu className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-300">No Agent Decisions Logged Yet</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          All autonomous AI decisions from all 7 agents stream here in real-time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => {
        const colors = AGENT_COLOR_MAP[log.agent_name] || {
          bg: "bg-slate-700/20",
          text: "text-slate-300",
          border: "border-slate-700"
        };

        const agentTitle = log.agent_name
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join("");

        return (
          <div
            key={log.id}
            className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex flex-col gap-2 shadow-sm hover:border-slate-600 transition-colors"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-0.5 rounded-lg border font-bold ${colors.bg} ${colors.text} ${colors.border}`}>
                  {agentTitle}
                </span>
                <span className="text-xs font-mono text-slate-400 font-semibold">{log.decision_type}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                {log.latency_ms !== undefined && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Zap className="w-3 h-3 text-amber-400" /> {log.latency_ms}ms
                  </span>
                )}
                {log.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                )}
              </div>
            </div>

            <p className="text-sm font-medium text-white mt-1">{log.decision_made}</p>

            {(log.input_summary || log.patient_phone_masked) && (
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                {log.patient_phone_masked && (
                  <span>Patient: {log.patient_phone_masked}</span>
                )}
                {log.input_summary && (
                  <span className="truncate max-w-md text-slate-500 italic">
                    "{log.input_summary}"
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
