"use client";

import React from "react";
import { MessageSquare, CheckCircle2 } from "lucide-react";
import { Panel, SectionHeader, Badge } from "@/components/design-system";
import { cn } from "@/lib/cn";

export interface RetentionOutreachItem {
  id: string;
  campaign_name: string;
  sent_date: string;
  channel: string;
  response_status: string;
  next_scheduled_outreach: string;
}

interface RetentionCardProps {
  history: RetentionOutreachItem[];
  className?: string;
}

export const RetentionCard: React.FC<RetentionCardProps> = ({ history, className }) => {
  return (
    <Panel className={cn(className)} padding="md">
      <SectionHeader
        icon={MessageSquare}
        title="RetentionRadar History & Outreach"
        action={<Badge variant="orange">Agent 4 (RetentionRadar)</Badge>}
      />

      <div className="mt-4 space-y-2">
        {history.map((item) => (
          <div key={item.id} className="panel p-3 bg-background-elevated/50 border border-border flex items-center justify-between gap-3 text-xs">
            <div>
              <h4 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-orange-400" /> {item.campaign_name}
              </h4>
              <p className="text-[11px] text-foreground-subtle mt-0.5">
                Sent: {item.sent_date} • Channel: {item.channel}
              </p>
            </div>

            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-green-400 font-bold font-mono text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" /> {item.response_status}
              </span>
              <span className="text-[10px] text-foreground-subtle block font-mono">
                Next: {item.next_scheduled_outreach}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
};
