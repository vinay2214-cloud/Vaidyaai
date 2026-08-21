"use client";

import React, { useState } from "react";
import { TimelineEntry, LongitudinalTimelineItem } from "./TimelineEntry";
import { EmptyState, Panel, SectionHeader, Badge } from "@/components/design-system";
import { Activity, Filter, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

interface ClinicalTimelineProps {
  items: LongitudinalTimelineItem[];
  className?: string;
}

const filters = ["ALL", "consultation", "prescription", "referral", "billing"];

export const ClinicalTimeline: React.FC<ClinicalTimelineProps> = ({ items, className }) => {
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [showDrafts, setShowDrafts] = useState(false);

  const draftCount = items.filter((item) => item.is_draft).length;

  const filteredItems = items.filter((item) => {
    // Unfinalized encounters are excluded by default: their vitals and
    // assessment fields are empty, so showing them inline misrepresents the
    // patient's clinical history.
    if (item.is_draft && !showDrafts) return false;
    if (typeFilter === "ALL") return true;
    return item.type === typeFilter.toLowerCase();
  });

  const finalizedCount = items.length - draftCount;

  return (
    <Panel className={cn(className)} padding="md">
      <SectionHeader
        icon={Activity}
        title="Longitudinal Clinical Timeline"
        action={
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap text-xs transition-colors border",
                  typeFilter === f
                    ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                    : "bg-background-elevated text-foreground-subtle border-border hover:border-border-strong"
                )}
              >
                {f === "ALL"
                  ? `All (${showDrafts ? items.length : finalizedCount})`
                  : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        }
      />

      {draftCount > 0 && (
        <button
          type="button"
          onClick={() => setShowDrafts((v) => !v)}
          className="mt-3 flex items-center gap-2 text-xs text-amber-300 hover:text-amber-200 focus-ring rounded-lg px-2 py-1.5 bg-amber-500/10 border border-amber-500/30 transition-colors"
          aria-pressed={showDrafts}
        >
          <EyeOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {showDrafts
            ? `Hide ${draftCount} incomplete ${draftCount === 1 ? "encounter" : "encounters"}`
            : `${draftCount} incomplete ${draftCount === 1 ? "encounter is" : "encounters are"} hidden — show`}
        </button>
      )}

      {filteredItems.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No Timeline Events Recorded"
            description="Longitudinal clinical consultations, prescriptions, SOAP notes, and retention follow-ups will stream here automatically."
            icon={Activity}
          />
        </div>
      ) : (
        <div className="mt-4">
          {filteredItems.map((item) => (
            <TimelineEntry key={item.id} item={item} />
          ))}
        </div>
      )}
    </Panel>
  );
};
