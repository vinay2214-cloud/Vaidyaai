import React from "react";
import { Activity, Calendar, User, Stethoscope, Pill, Share2, CreditCard, HeartPulse } from "lucide-react";
import clsx from "clsx";

export interface LongitudinalOverview {
  last_visit: string;
  primary_physician: string;
  visit_count: number;
  active_problems: string[];
  current_medications_count: number;
  upcoming_followup: string;
  active_referrals_count: number;
  outstanding_bills_rupees: number;
}

interface PatientOverviewCardProps {
  overview: LongitudinalOverview;
  className?: string;
}

export const PatientOverviewCard: React.FC<PatientOverviewCardProps> = ({ overview, className }) => {
  return (
    <div className={clsx("bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4.5 space-y-4 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-teal-400" />
          <h3 className="text-sm font-bold text-white">Longitudinal Summary & Overview</h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400 bg-slate-900 border border-slate-700/60 px-2.5 py-0.5 rounded-full">
          Total Visits: <strong className="text-teal-400">{overview.visit_count}</strong>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Last Visit</span>
          <p className="text-xs font-bold text-white mt-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-teal-400" /> {overview.last_visit}
          </p>
          <span className="text-[10px] text-slate-500 block mt-0.5">{overview.primary_physician}</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Upcoming Follow-Up</span>
          <p className="text-xs font-bold text-amber-400 mt-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-amber-400" /> {overview.upcoming_followup}
          </p>
          <span className="text-[10px] text-slate-500 block mt-0.5">RetentionRadar Active</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Current Rx & Referrals</span>
          <p className="text-xs font-bold text-purple-300 mt-1 flex items-center gap-2">
            <span><Pill className="w-3.5 h-3.5 text-emerald-400 inline" /> {overview.current_medications_count} Active</span>
            <span><Share2 className="w-3.5 h-3.5 text-purple-400 inline" /> {overview.active_referrals_count} Ref</span>
          </p>
          <span className="text-[10px] text-slate-500 block mt-0.5">PrescriptionSafe Verified</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Outstanding Balance</span>
          <p className="text-xs font-bold mt-1 flex items-center gap-1 text-emerald-400">
            <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
            {overview.outstanding_bills_rupees === 0 ? "Fully Paid (₹0)" : `₹${overview.outstanding_bills_rupees} Pending`}
          </p>
          <span className="text-[10px] text-slate-500 block mt-0.5">BillingPulse UPI Integrated</span>
        </div>
      </div>

      {/* Active Problems Pill Row */}
      {overview.active_problems.length > 0 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 space-y-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Clinical Problems:</span>
          <div className="flex items-center gap-2 flex-wrap">
            {overview.active_problems.map((prob, idx) => (
              <span key={idx} className="bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs px-2.5 py-0.5 rounded-lg font-medium">
                • {prob}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
