"use client";

import React from "react";
import { Pill, ShieldCheck, AlertTriangle, ShieldAlert } from "lucide-react";
import { Panel, SectionHeader, Badge } from "@/components/design-system";
import { cn } from "@/lib/cn";

export interface MedicationItem {
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  prescribed_by?: string;
  is_active: boolean;
  interaction_warning?: string;
}

interface MedicationCardProps {
  medications: MedicationItem[];
  className?: string;
}

export const MedicationCard: React.FC<MedicationCardProps> = ({ medications, className }) => {
  const activeMeds = medications.filter((m) => m.is_active);
  const pastMeds = medications.filter((m) => !m.is_active);
  const hasWarnings = medications.some((m) => m.interaction_warning);

  return (
    <Panel className={cn(className)} padding="md">
      <SectionHeader
        icon={Pill}
        title="Medications & Safety Audit"
        action={
          hasWarnings ? (
            <Badge variant="red" dot>Interaction Warning</Badge>
          ) : (
            <Badge variant="green" dot>0 Critical Conflicts</Badge>
          )
        }
      />

      <div className="mt-4 space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle block">Active Regimen ({activeMeds.length})</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {activeMeds.map((med, idx) => (
            <div key={idx} className="panel p-3 bg-background-elevated/50 border border-border space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-sm">{med.drug_name}</span>
                <Badge variant="green">{med.dosage}</Badge>
              </div>
              <p className="text-foreground-muted font-mono text-[11px]">
                {med.frequency} • Duration: {med.duration}
              </p>
              <p className="text-foreground-subtle italic text-[11px]">&quot;{med.instructions}&quot;</p>

              {med.interaction_warning && (
                <div className="mt-1 panel p-2 bg-red-500/10 border border-red-500/30 text-red-300 text-[11px] flex items-start gap-1 font-mono">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <span>{med.interaction_warning}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
};
