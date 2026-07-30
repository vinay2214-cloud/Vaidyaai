"use client";

import React from "react";
import { Share2 } from "lucide-react";
import { Panel, SectionHeader, Badge } from "@/components/design-system";
import { StatusBadge } from "../shared/StatusBadge";
import { cn } from "@/lib/cn";

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
    <Panel className={cn(className)} padding="md">
      <SectionHeader
        icon={Share2}
        title="Specialist & Lab Referrals"
        action={<Badge variant="blue">Agent 7 (ReferralCoordinator)</Badge>}
      />

      <div className="mt-4 space-y-2">
        {referrals.map((ref) => (
          <div key={ref.id} className="panel p-3 bg-background-elevated/50 border border-border flex items-center justify-between gap-3 text-xs">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-foreground text-xs">{ref.speciality}</h4>
                <StatusBadge label={ref.status} variant={ref.status === "completed" ? "success" : "pending"} size="sm" />
              </div>
              <p className="text-foreground-muted mt-1 italic">&quot;{ref.reason}&quot;</p>
              <p className="text-[10px] text-foreground-subtle mt-0.5 font-mono">Referred to: {ref.target_doctor || "Dr. Mehta (Cardiology)"}</p>
            </div>

            <span className="text-[10px] font-mono text-foreground-subtle shrink-0">{ref.created_at}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
};
