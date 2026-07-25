import React from "react";
import clsx from "clsx";
import { AlertCircle, HeartPulse, Sparkles, FileText, Activity } from "lucide-react";

interface ClinicalIndicatorProps {
  allergies?: string[];
  chronicDiseases?: string[];
  hasAiSummary?: boolean;
  hasScribeNote?: boolean;
  hasRetentionRadar?: boolean;
  className?: string;
}

export const ClinicalIndicator: React.FC<ClinicalIndicatorProps> = ({
  allergies = [],
  chronicDiseases = [],
  hasAiSummary = true,
  hasScribeNote = true,
  hasRetentionRadar = false,
  className
}) => {
  return (
    <div className={clsx("flex items-center gap-1.5 flex-wrap text-[11px]", className)}>
      {/* Allergies Badge */}
      {allergies.length > 0 ? (
        <span className="inline-flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 text-rose-300 px-2 py-0.5 rounded-md font-medium">
          <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
          Allergies: {allergies.join(", ")}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 bg-slate-900 border border-slate-700/60 text-slate-400 px-2 py-0.5 rounded-md font-mono">
          NKDA (No Known Drug Allergies)
        </span>
      )}

      {/* Chronic Diseases */}
      {chronicDiseases.map((disease, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 bg-purple-500/10 border border-purple-500/30 text-purple-300 px-2 py-0.5 rounded-md font-medium"
        >
          <HeartPulse className="w-3 h-3 text-purple-400 shrink-0" />
          {disease}
        </span>
      ))}

      {/* AI Indicators */}
      {hasAiSummary && (
        <span className="inline-flex items-center gap-1 bg-teal-500/10 border border-teal-500/30 text-teal-300 px-2 py-0.5 rounded-md font-medium">
          <Sparkles className="w-3 h-3 text-teal-400 shrink-0" /> AI Summary Ready
        </span>
      )}

      {hasScribeNote && (
        <span className="inline-flex items-center gap-1 bg-blue-500/10 border border-blue-500/30 text-blue-300 px-2 py-0.5 rounded-md font-medium">
          <FileText className="w-3 h-3 text-blue-400 shrink-0" /> ClinicalScribe Note
        </span>
      )}

      {hasRetentionRadar && (
        <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-md font-medium">
          <Activity className="w-3 h-3 text-amber-400 shrink-0" /> RetentionRadar Active
        </span>
      )}
    </div>
  );
};
