"use client";

import React from "react";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { useAgentHealth } from "@/hooks/useAgentHealth";
import { AgentCard } from "../shared/AgentCard";
import { DecisionCard } from "../shared/DecisionCard";
import { CreditCard, Bot } from "lucide-react";

export const BillingSidebar: React.FC = () => {
  const { logs } = useAgentLogs();
  const { agents } = useAgentHealth();

  // Find BillingPulse agent info
  const billingAgentInfo = agents.find((a) => a.id === "billing_pulse");
  
  const billingAgent = {
    name: "Agent 3: BillingPulse",
    agentId: "billing_pulse",
    role: "Automated Invoicing & Razorpay UPI",
    status: (billingAgentInfo?.status === "active" ? "active" : "idle") as "active" | "idle",
    lastTask: billingAgentInfo?.last_decision || "No billing decisions yet",
    activityCount: billingAgentInfo?.tasks_today || 0,
    health: billingAgentInfo?.success_rate_pct ?? 0,
    latencyMs: billingAgentInfo?.avg_latency_ms || 0
  };

  // Filter logs for billing pulse
  const billingLogs = logs
    .filter((log) => log.agent_name.toLowerCase().includes("billing"))
    .slice(0, 3);

  return (
    <aside className="space-y-4">
      {/* BillingPulse Status */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-teal-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">BillingPulse Status</h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
            Active
          </span>
        </div>

        <AgentCard {...billingAgent} />

        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-1 text-xs font-mono">
          <div className="flex justify-between text-slate-300">
            <span>Financial Health Score:</span>
            <strong className="text-teal-400 font-bold">{billingAgent.health}/100</strong>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Daily P&L Report:</span>
            <strong className="text-emerald-400">Active</strong>
          </div>
        </div>
      </div>

      {/* Recent Billing Decisions */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-teal-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Billing Decisions</h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">Live</span>
        </div>

        <div className="space-y-2">
          {billingLogs.length > 0 ? (
            billingLogs.map((log) => (
              <DecisionCard
                key={log.id}
                id={log.id}
                agentName="BillingPulse"
                decisionType={log.decision_type}
                decisionMade={log.decision_made}
                timeAgo={log.created_at ? "Today" : "Recent"}
                modelUsed={log.model_used || "—"}
                latencyMs={log.latency_ms || 0}
              />
            ))
          ) : (
            <p className="text-xs text-slate-400 text-center py-4">No billing decisions yet today.</p>
          )}
        </div>
      </div>
    </aside>
  );
};
