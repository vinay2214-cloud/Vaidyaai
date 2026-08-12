"use client";

import React from "react";
import { Sparkles, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { Panel, SectionHeader, Badge } from "@/components/design-system";
import { cn } from "@/lib/cn";

function buildProvenanceSubtitle(summary: AISummaryContent): string {
  const p = summary.provenance;
  if (!p) {
    return `Compiled ${summary.generated_at || "on load"} from patient record (system-generated)`;
  }
  const parts: string[] = [];
  if (p.generated_by && p.generated_by !== "system") {
    parts.push(p.generated_by);
  } else {
    parts.push("system-generated");
  }
  if (p.model) {
    parts.push(p.model);
  }
  if (p.source) {
    parts.push(`source: ${p.source}`);
  }
  const when = p.created_at || summary.generated_at || "on load";
  return `Compiled ${when} — ${parts.join(" • ")}`;
}

export interface AIProvenance {
  source: string;
  generated_by: string;
  model?: string | null;
  execution_id?: string | null;
  created_at?: string;
  evidence?: string | null;
  status: string;
}

export interface AISummaryContent {
  generated_at: string;
  patient_overview: string;
  clinical_history: string;
  risk_assessment: string;
  care_gaps: string[];
  missed_followups: string[];
  recommended_next_steps: string[];
  important_observations: string[];
  provenance?: AIProvenance;
}

interface AISummaryCardProps {
  summary: AISummaryContent;
  onRefresh?: () => void;
  className?: string;
}

export const AISummaryCard: React.FC<AISummaryCardProps> = ({ summary, onRefresh, className }) => {
  return (
    <Panel className={cn("relative overflow-hidden border-teal-500/30", className)} padding="md">
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />

      <SectionHeader
        icon={Sparkles}
        title="Patient Longitudinal Summary"
        subtitle={buildProvenanceSubtitle(summary)}
        action={
          onRefresh && (
            <button
              onClick={onRefresh}
              className="btn-ghost text-xs text-teal-400 border border-teal-500/30"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Re-Analyze
            </button>
          )
        }
      />

      {(() => {
        const p = summary.provenance;
        const isRealAI = !!p && !!p.model && p.generated_by !== "system";
        return (
          <div className={cn(
            "mt-3 flex flex-wrap items-center gap-2 text-[11px]",
            isRealAI ? "text-teal-400" : "text-slate-400"
          )}>
            <Badge variant={isRealAI ? "green" : "neutral"}>
              {isRealAI ? "AI-Generated" : "System-Generated"}
            </Badge>
            <span className="font-mono">
              {p ? `generated_by=${p.generated_by}` : "generated_by=system"}
              {p?.model ? ` · model=${p.model}` : ""}
              {p?.execution_id ? ` · exec=${p.execution_id.slice(0, 12)}` : ""}
              {p ? ` · status=${p.status}` : " · status=deterministic"}
            </span>
          </div>
        );
      })()}

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="panel p-3.5 bg-background-elevated/50 border border-border">
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-400 block mb-1">Patient Overview</span>
          <p className="text-foreground leading-relaxed">{summary.patient_overview}</p>
        </div>

        <div className="panel p-3.5 bg-background-elevated/50 border border-border">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 block mb-1">Clinical History</span>
          <p className="text-foreground leading-relaxed">{summary.clinical_history}</p>
        </div>

        <div className="panel p-3.5 bg-background-elevated/50 border border-border">
          <span className="text-xs font-semibold uppercase tracking-wider text-red-400 block mb-1">Risk Assessment</span>
          <p className="text-foreground leading-relaxed">{summary.risk_assessment}</p>
        </div>

        {summary.care_gaps.length > 0 && (
          <div className="panel p-3.5 bg-background-elevated/50 border border-orange-500/30">
            <span className="text-xs font-semibold uppercase tracking-wider text-orange-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Care Gaps ({summary.care_gaps.length})
            </span>
            <ul className="mt-1 space-y-1 text-foreground list-disc list-inside">
              {summary.care_gaps.map((gap, i) => (
                <li key={i}>{gap}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4 panel p-3.5 bg-teal-950/20 border border-teal-500/20">
        <span className="text-xs font-semibold uppercase tracking-wider text-teal-300 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" /> Recommended Action Plan
        </span>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {summary.recommended_next_steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-1.5 panel p-2 bg-background-elevated/50 border border-border">
              <span className="text-teal-400 font-bold font-mono">{idx + 1}.</span>
              <span className="text-sm text-foreground">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
};
