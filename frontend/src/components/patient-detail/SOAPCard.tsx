import React, { useState } from "react";
import { FileText, Cpu, CheckCircle2, ChevronDown, ChevronUp, User, Sparkles } from "lucide-react";
import clsx from "clsx";

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
  className?: string;
}

export const SOAPCard: React.FC<SOAPCardProps> = ({ soap, className }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={clsx("bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4.5 space-y-3.5 shadow-sm", className)}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            SOAP Clinical Note
            <span className="text-[10px] font-mono font-normal bg-purple-500/10 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
              Agent 2 (ClinicalScribe)
            </span>
          </h3>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <span>Dr. {soap.clinician || "Sharma"}</span>
          <button onClick={() => setExpanded(!expanded)} className="text-slate-400 hover:text-white">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Diagnoses & ICD-10 Badges */}
      {soap.diagnoses && soap.diagnoses.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ICD-10 Diagnoses:</span>
          {soap.diagnoses.map((d, i) => (
            <span key={i} className="bg-purple-500/10 border border-purple-500/30 text-purple-300 px-2.5 py-0.5 rounded-lg font-mono font-medium">
              {d.code} — {d.description} ({Math.round(d.confidence * 100)}%)
            </span>
          ))}
        </div>
      )}

      {/* Expanded SOAP Content */}
      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-1">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">S — Subjective (Patient History)</span>
            <p className="text-slate-200 leading-relaxed">{soap.subjective}</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-1">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">O — Objective (Vitals & Exam)</span>
            <p className="text-slate-200 leading-relaxed">{soap.objective}</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-1">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">A — Assessment (Diagnosis & Risk)</span>
            <p className="text-slate-200 leading-relaxed">{soap.assessment}</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-1">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">P — Plan (Treatment & Rx)</span>
            <p className="text-slate-200 leading-relaxed">{soap.plan}</p>
          </div>
        </div>
      )}
    </div>
  );
};
