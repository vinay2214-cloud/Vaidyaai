import React, { useState } from "react";
import { AgentChip } from "../timeline/AgentChip";
import { StatusBadge, StatusVariant } from "../shared/StatusBadge";
import { Calendar, ChevronDown, ChevronUp, User, Stethoscope, Pill, FileText, Share2, CreditCard, Clock } from "lucide-react";
import clsx from "clsx";

export type LongitudinalItemType =
  | "consultation"
  | "diagnosis"
  | "prescription"
  | "soap"
  | "investigation"
  | "referral"
  | "followup"
  | "retention"
  | "billing";

export interface LongitudinalTimelineItem {
  id: string;
  type: LongitudinalItemType;
  /** Human-readable date shown in the UI (localized at render time). */
  date: string;
  /** Canonical ISO timestamp used for chronological sorting. */
  timestamp?: string;
  title: string;
  summary: string;
  clinician: string;
  agents_involved: string[];
  status_variant: StatusVariant;
  status_label: string;
  /**
   * True for an encounter that was started but never signed off. Such records
   * have empty vitals/assessment fields, so presenting them alongside finalized
   * visits made an abandoned consultation look like a completed one with
   * missing data. Hidden from the default timeline view unless opted in.
   */
  is_draft?: boolean;
  details?: Record<string, any>;
}

interface TimelineEntryProps {
  item: LongitudinalTimelineItem;
  className?: string;
}

export const TimelineEntry: React.FC<TimelineEntryProps> = ({ item, className }) => {
  const [expanded, setExpanded] = useState(false);

  const iconMap: Record<LongitudinalItemType, any> = {
    consultation: Stethoscope,
    diagnosis: Calendar,
    prescription: Pill,
    soap: FileText,
    investigation: Clock,
    referral: Share2,
    followup: Calendar,
    retention: Clock,
    billing: CreditCard
  };

  const IconComponent = iconMap[item.type] || Stethoscope;

  return (
    <div className={clsx("relative pl-6 pb-6 border-l-2 border-slate-700/60 transition-all", className)}>
      {/* Node bullet */}
      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-teal-400 bg-slate-900 flex items-center justify-center text-teal-400">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
      </div>

      {/* Card Container */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-2.5 hover:border-slate-600 transition-colors shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-1 bg-slate-900 border border-slate-700 rounded-lg text-teal-400">
              <IconComponent className="w-3.5 h-3.5" />
            </div>
            <h4 className="font-bold text-white text-sm">{item.title}</h4>
            <StatusBadge label={item.status_label} variant={item.status_variant} size="sm" />
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" /> {item.date}
            </span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-slate-400 hover:text-white p-1"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-300 font-medium leading-relaxed">{item.summary}</p>

        {/* Agents & Clinician Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700/40 text-[11px] text-slate-400 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500">AI Agents:</span>
            {item.agents_involved.map((agent, i) => (
              <AgentChip key={i} agentName={agent} size="sm" />
            ))}
          </div>

          <span className="font-mono text-slate-400 flex items-center gap-1">
            <User className="w-3 h-3 text-slate-500" /> {item.clinician}
          </span>
        </div>

        {/* Expandable Details Panel */}
        {expanded && item.details && (
          <div className="mt-3 pt-3 border-t border-slate-700/60 bg-slate-900/60 p-3 rounded-xl space-y-1.5 text-xs text-slate-300 font-mono">
            {Object.entries(item.details).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-slate-800/60 pb-1">
                <span className="text-slate-400 capitalize">{k.replace(/_/g, " ")}:</span>
                <span className="text-teal-300 font-semibold">{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
