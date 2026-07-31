"use client";

import React from "react";
import { Clock, CheckCircle2, FileCheck } from "lucide-react";
import { Panel, SectionHeader, Badge } from "@/components/design-system";
import { cn } from "@/lib/cn";

export interface LabItem {
  test_name: string;
  category: string;
  ordered_date: string;
  status: "completed" | "pending" | "critical";
  result_value?: string;
  normal_range?: string;
}

interface LabCardProps {
  labs: LabItem[];
  className?: string;
}

export const LabCard: React.FC<LabCardProps> = ({ labs, className }) => {
  return (
    <Panel className={cn(className)} padding="md">
      <SectionHeader
        icon={FileCheck}
        title="Labs & Diagnostic Investigations"
        action={<Badge variant="neutral">Total Tests: {labs.length}</Badge>}
      />

      <div className="mt-4 space-y-2">
        {labs.map((lab, i) => (
          <div key={i} className="panel p-3 bg-background-elevated/50 border border-border flex items-center justify-between gap-3 text-xs">
            <div>
              <h4 className="font-semibold text-foreground text-xs">{lab.test_name}</h4>
              <p className="text-[11px] text-foreground-subtle mt-0.5">
                {lab.category} • Ordered: {lab.ordered_date}
              </p>
            </div>

            <div className="text-right">
              {lab.status === "completed" ? (
                <div>
                  <span className="inline-flex items-center gap-1 text-green-400 font-bold font-mono text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {lab.result_value}
                  </span>
                  <span className="text-[10px] text-foreground-subtle block">Normal ({lab.normal_range})</span>
                </div>
              ) : lab.status === "critical" ? (
                <Badge variant="red" dot>Critical</Badge>
              ) : (
                <Badge variant="orange" dot>Pending</Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
};
