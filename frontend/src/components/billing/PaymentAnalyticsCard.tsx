import React from "react";
import { ChartContainer } from "../analytics/ChartContainer";
import { CreditCard, QrCode, Banknote, ShieldCheck } from "lucide-react";

export const PaymentAnalyticsCard: React.FC = () => {
  const paymentMethods = [
    { method: "UPI (Razorpay)", icon: QrCode, pct: 72, amount: 25480, color: "bg-teal-400 text-teal-400" },
    { method: "Cash", icon: Banknote, pct: 20, amount: 7080, color: "bg-emerald-400 text-emerald-400" },
    { method: "Card / POS", icon: CreditCard, pct: 5, amount: 1770, color: "bg-purple-400 text-purple-400" },
    { method: "Insurance / TPA", icon: ShieldCheck, pct: 3, amount: 1070, color: "bg-blue-400 text-blue-400" }
  ];

  return (
    <ChartContainer title="Payment Method Distribution" subtitle="Collection Breakdown via Agent 3 (BillingPulse)">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Percentage Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between font-mono text-slate-300">
            <span>UPI Collection Share:</span>
            <strong className="text-teal-400 font-bold text-sm">72% (Razorpay)</strong>
          </div>

          <div className="h-3 bg-slate-900 rounded-full overflow-hidden flex">
            <div className="w-[72%] bg-teal-400 h-full" />
            <div className="w-[20%] bg-emerald-400 h-full" />
            <div className="w-[5%] bg-purple-400 h-full" />
            <div className="w-[3%] bg-blue-400 h-full" />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
            {paymentMethods.map((pm, i) => {
              const Icon = pm.icon;
              return (
                <div key={i} className="flex items-center gap-1.5 text-slate-300">
                  <Icon className={`w-3.5 h-3.5 ${pm.color.split(" ")[1]}`} />
                  <span>{pm.method}: <strong className="text-white">{pm.pct}%</strong></span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Methods List */}
        <div className="space-y-2">
          {paymentMethods.map((pm, i) => (
            <div key={i} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <pm.icon className={`w-4 h-4 ${pm.color.split(" ")[1]}`} />
                <span className="font-bold text-white text-xs">{pm.method}</span>
              </div>
              <div className="text-right font-mono">
                <span className="font-bold text-teal-400 block text-xs">₹{pm.amount}</span>
                <span className="text-[10px] text-slate-500">{pm.pct}% share</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartContainer>
  );
};
