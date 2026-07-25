import React from "react";
import { AgentCard } from "../shared/AgentCard";
import { DecisionCard } from "../shared/DecisionCard";
import { CreditCard, Bot, ShieldCheck, Activity } from "lucide-react";

export const BillingSidebar: React.FC = () => {
  const billingAgent = {
    name: "Agent 3: BillingPulse",
    agentId: "billing_pulse",
    role: "Automated Invoicing & Razorpay UPI",
    status: "active" as const,
    lastTask: "Processed ₹35,400 UPI collections",
    activityCount: 30,
    health: 100,
    latencyMs: 310
  };

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
            <strong className="text-teal-400 font-bold">98/100</strong>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Daily P&L Report:</span>
            <strong className="text-emerald-400">9 PM IST Job Active</strong>
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
          <DecisionCard
            id="dec_b1"
            agentName="BillingPulse"
            decisionType="invoice_generated"
            decisionMade="Generated invoice VDY-20260725-0012 (₹500) & sent Razorpay UPI link on WhatsApp."
            timeAgo="Today"
            modelUsed="gemini-1.5-flash"
            latencyMs={310}
          />
          <DecisionCard
            id="dec_b2"
            agentName="BillingPulse"
            decisionType="upi_received"
            decisionMade="Razorpay webhook verified UPI signature: ₹500 marked paid instantly."
            timeAgo="Today"
            modelUsed="gemini-1.5-flash"
            latencyMs={180}
          />
        </div>
      </div>
    </aside>
  );
};
