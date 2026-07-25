import React, { useState } from "react";
import { TimelineEntry, LongitudinalTimelineItem, LongitudinalItemType } from "./TimelineEntry";
import { EmptyState } from "../shared/EmptyState";
import { Activity, Filter } from "lucide-react";

interface ClinicalTimelineProps {
  items: LongitudinalTimelineItem[];
  className?: string;
}

export const ClinicalTimeline: React.FC<ClinicalTimelineProps> = ({ items, className }) => {
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const filteredItems = items.filter((item) => {
    if (typeFilter === "ALL") return true;
    return item.type === typeFilter.toLowerCase();
  });

  return (
    <div className={`space-y-4 ${className || ""}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-teal-400" />
          <h3 className="text-sm font-bold text-white">Longitudinal Clinical Timeline</h3>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setTypeFilter("ALL")}
            className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors border ${
              typeFilter === "ALL"
                ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
          >
            All Events ({items.length})
          </button>
          <button
            onClick={() => setTypeFilter("consultation")}
            className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors border ${
              typeFilter === "consultation"
                ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
          >
            Consults
          </button>
          <button
            onClick={() => setTypeFilter("prescription")}
            className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors border ${
              typeFilter === "prescription"
                ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
          >
            Prescriptions
          </button>
          <button
            onClick={() => setTypeFilter("referral")}
            className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors border ${
              typeFilter === "referral"
                ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
          >
            Referrals
          </button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <EmptyState
          title="No Timeline Events Recorded"
          description="Longitudinal clinical consultations, prescriptions, SOAP notes, and retention follow-ups will stream here automatically."
          icon={Activity}
        />
      ) : (
        <div className="mt-4">
          {filteredItems.map((item) => (
            <TimelineEntry key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};
