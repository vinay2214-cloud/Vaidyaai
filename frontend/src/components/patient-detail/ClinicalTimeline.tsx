"use client";

import React, { useState } from "react";
import { TimelineEntry, LongitudinalTimelineItem } from "./TimelineEntry";
import { EmptyState, Panel, SectionHeader, Badge } from "@/components/design-system";
import { Activity, Filter } from "lucide-react";
import { cn } from "@/lib/cn";

interface ClinicalTimelineProps {
  items: LongitudinalTimelineItem[];
  className?: string;
}

const filters = ["ALL", "consultation", "prescription", "referral", "billing"];

export const ClinicalTimeline: React.FC<ClinicalTimelineProps> = ({ items, className }) => {
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const filteredItems = items.filter((item) => {
    if (typeFilter === "ALL") return true;
    return item.type === typeFilter.toLowerCase();
  });

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
                {f === "ALL" ? `All (${items.length})` : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        }
      />

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
