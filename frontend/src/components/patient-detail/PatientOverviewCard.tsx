"use client";

import React from "react";
import { Activity, Calendar, User, Pill, Share2, CreditCard } from "lucide-react";
import { Panel, SectionHeader, Badge } from "@/components/design-system";
import { cn } from "@/lib/cn";

export interface LongitudinalOverview {
  last_visit: string;
  primary_physician: string;
  visit_count: number;
  active_problems: string[];
  current_medications_count: number;
  upcoming_followup: string;
  active_referrals_count: number;
  /** null when no balance has been computed — never claim "Fully Paid". */
  outstanding_bills_rupees: number | null;
}

interface PatientOverviewCardProps {
  overview: LongitudinalOverview;
  className?: string;
}

export const PatientOverviewCard: React.FC<PatientOverviewCardProps> = ({ overview, className }) => {
  const items = [
    { icon: Calendar, label: "Last Visit", value: overview.last_visit, sub: overview.primary_physician, color: "text-foreground" as const },
    { icon: Calendar, label: "Follow-Up", value: overview.upcoming_followup, sub: "RetentionRadar active", color: "text-orange-400" as const },
    { icon: Pill, label: "Current Rx & Referrals", value: `${overview.current_medications_count} Active • ${overview.active_referrals_count} Ref`, sub: "PrescriptionSafe Verified", color: "text-green-400" as const },
    {
      icon: CreditCard,
      label: "Balance",
      value:
        overview.outstanding_bills_rupees === null
          ? "See Billing"
          : overview.outstanding_bills_rupees === 0
            ? "Fully Paid (₹0)"
            : `₹${overview.outstanding_bills_rupees} Pending`,
      sub: "BillingPulse UPI",
      color:
        overview.outstanding_bills_rupees === null
          ? ("text-foreground-muted" as const)
          : overview.outstanding_bills_rupees === 0
            ? ("text-green-400" as const)
            : ("text-red-400" as const),
    },
  ];

  return (
    <Panel className={cn(className)} padding="md">
      <SectionHeader
        icon={Activity}
        title="Longitudinal Summary & Overview"
        action={<Badge variant="teal">Total Visits: {overview.visit_count}</Badge>}
      />

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="panel p-3 bg-background-elevated/50 border border-border">
              <div className="flex items-center gap-1.5 text-foreground-subtle mb-1">
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase font-semibold">{item.label}</span>
              </div>
              <div className={cn("text-sm font-semibold", item.color)}>{item.value}</div>
              <div className="text-[10px] text-foreground-subtle mt-0.5">{item.sub}</div>
            </div>
          );
        })}
      </div>

      {overview.active_problems.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {overview.active_problems.map((prob, idx) => (
            <Badge key={idx} variant="blue" dot>
              {prob}
            </Badge>
          ))}
        </div>
      )}
    </Panel>
  );
};
