"use client";

import React from "react";
import { DecisionEntry, LogData } from "../timeline/DecisionEntry";
import { ShieldCheck } from "lucide-react";
import { Panel, SectionHeader, Badge } from "@/components/design-system";
import { cn } from "@/lib/cn";

interface AuditCardProps {
  logs: LogData[];
  className?: string;
}

export const AuditCard: React.FC<AuditCardProps> = ({ logs, className }) => {
  return (
    <Panel className={cn(className)} padding="md">
      <SectionHeader
        icon={ShieldCheck}
        title="Compliance & AI Agent Audit Trail"
        action={<Badge variant="teal">DPDP Act 2023 Audited</Badge>}
      />
      <div className="mt-4 space-y-3">
        {logs.slice(0, 5).map((log) => (
          <DecisionEntry key={log.id} log={log} />
        ))}
      </div>
    </Panel>
  );
};
