import React from "react";
import { Share2, UserCheck, Clock, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import { StatusBadge } from "../shared/StatusBadge";

export interface ReferralItem {
  id: string;
  speciality: string;
  target_doctor?: string;
  reason: string;
  urgency: string;
  status: "pending" | "accepted" | "completed" | "cancelled";
  created_at: string;
}

interface ReferralCardProps {
  referrals: ReferralItem[];
  className?: string;
}

export const ReferralCard: React.FC<ReferralCardProps> = ({ referrals, className }) => {
  return (
    <div className={clsx("bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4.5 space-y-3 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Share2 className="w-5 h-5 text-purple-400" />
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            Specialist & Lab Referrals
            <span className="text-[10px] font-mono font-normal bg-purple-500/10 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
              Agent 7 (ReferralCoordinator)
            </span>
          </h3>
        </div>
      </div>

      <div className="space-y-2">
        {referrals.map((ref) => (
          <div key={ref.id} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-white text-xs">{ref.speciality}</h4>
                <StatusBadge label={ref.status} variant={ref.status === "completed" ? "success" : "pending"} size="sm" />
              </div>
              <p className="text-slate-300 mt-1 italic">&quot;{ref.reason}&quot;</p>
              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Referred to: {ref.target_doctor || "Dr. Mehta (Cardiology)"}</p>
            </div>

            <span className="text-[10px] font-mono text-slate-400 shrink-0">{ref.created_at}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
