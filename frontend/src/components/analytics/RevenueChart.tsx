import React, { useState } from "react";
import { ChartContainer } from "./ChartContainer";
import { IndianRupee, TrendingUp, CreditCard } from "lucide-react";

export const RevenueChart: React.FC = () => {
  const [timeframe, setTimeframe] = useState<"daily" | "weekly" | "monthly">("weekly");

  const revenueData = [
    { label: "Mon", amount: 4200, heightPct: 60 },
    { label: "Tue", amount: 5800, heightPct: 80 },
    { label: "Wed", amount: 3900, heightPct: 55 },
    { label: "Thu", amount: 6400, heightPct: 90 },
    { label: "Fri", amount: 7200, heightPct: 100 },
    { label: "Sat", amount: 5100, heightPct: 75 },
    { label: "Sun", amount: 2800, heightPct: 40 }
  ];

  const topProcedures = [
    { name: "General Consultation", count: 42, revenue: 21000 },
    { name: "Diabetic Quarterly Panel", count: 18, revenue: 14400 },
    { name: "ECG & Cardiac Screening", count: 12, revenue: 9600 },
    { name: "Follow-Up Consultation", count: 25, revenue: 7500 }
  ];

  return (
    <ChartContainer
      title="Revenue Analytics & Procedures"
      subtitle="BillingPulse Automated Invoicing & Razorpay UPI Collection"
      action={
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/60 p-1 rounded-xl text-xs">
          <button
            onClick={() => setTimeframe("daily")}
            className={`px-2.5 py-0.5 rounded-lg font-semibold font-mono ${timeframe === "daily" ? "bg-teal-500/20 text-teal-300" : "text-slate-400"}`}
          >
            Daily
          </button>
          <button
            onClick={() => setTimeframe("weekly")}
            className={`px-2.5 py-0.5 rounded-lg font-semibold font-mono ${timeframe === "weekly" ? "bg-teal-500/20 text-teal-300" : "text-slate-400"}`}
          >
            Weekly
          </button>
          <button
            onClick={() => setTimeframe("monthly")}
            className={`px-2.5 py-0.5 rounded-lg font-semibold font-mono ${timeframe === "monthly" ? "bg-teal-500/20 text-teal-300" : "text-slate-400"}`}
          >
            Monthly
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bar Chart Visualization */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-400">Total Weekly Revenue:</span>
            <span className="text-lg font-bold text-teal-400 font-mono">₹35,400</span>
          </div>

          <div className="h-40 bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 flex items-end justify-between gap-2">
            {revenueData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                <span className="text-[10px] font-mono text-teal-300 opacity-0 group-hover:opacity-100 transition-opacity">
                  ₹{d.amount}
                </span>
                <div
                  style={{ height: `${d.heightPct}%` }}
                  className="w-full bg-gradient-to-t from-teal-600 to-teal-400 rounded-t-lg transition-all group-hover:bg-teal-300"
                />
                <span className="text-[10px] font-mono text-slate-400">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Procedures List */}
        <div className="space-y-2 text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Top Revenue Procedures:</span>
          <div className="space-y-2">
            {topProcedures.map((p, i) => (
              <div key={i} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-xs">{p.name}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">{p.count} procedures</span>
                </div>
                <span className="font-bold text-teal-400 font-mono">₹{p.revenue}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ChartContainer>
  );
};
