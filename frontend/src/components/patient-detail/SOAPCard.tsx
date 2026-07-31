"use client";

import React from "react";
import { Panel, SectionHeader, Badge } from "@/components/design-system";
import { FileText } from "lucide-react";

export interface SOAPNoteData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  diagnoses?: Array<{ code: string; description: string; confidence: number }>;
  clinician?: string;
  generated_at?: string;
}

interface SOAPCardProps {
  soap: SOAPNoteData;
}

export const SOAPCard: React.FC<SOAPCardProps> = ({ soap }) => {
  const sections: { key: keyof SOAPNoteData; label: string }[] = [
    { key: "subjective", label: "Subjective" },
    { key: "objective", label: "Objective" },
    { key: "assessment", label: "Assessment" },
    { key: "plan", label: "Plan" },
  ];

  return (
    <Panel padding="md">
      <SectionHeader
        icon={FileText}
        title="Latest SOAP Note"
        subtitle={soap.generated_at ? `Generated ${soap.generated_at}` : undefined}
      />

      <div className="mt-4 space-y-4">
        {sections.map(({ key, label }) => (
          <div key={label}>
            <h4 className="text-xs font-semibold uppercase text-foreground-subtle mb-1.5">{label}</h4>
            <div className="panel p-3 bg-background-elevated/50 border border-border">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{soap[key] as string}</p>
            </div>
          </div>
        ))}

        {soap.diagnoses && soap.diagnoses.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase text-foreground-subtle mb-1.5">ICD-10 Diagnoses</h4>
            <div className="flex flex-wrap gap-2">
              {soap.diagnoses.map((d, idx) => (
                <Badge key={idx} variant="teal">
                  {d.code} — {d.description}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
};
