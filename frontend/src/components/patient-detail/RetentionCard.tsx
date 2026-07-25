import React from "react";
import { Activity, MessageSquare, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import clsx from "clsx";

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
    <div className={clsx("bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4.5 space-y-3 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            RetentionRadar History & Outreach
            <span className="text-[10px] font-mono font-normal bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
              Agent 4 (RetentionRadar)
            </span>
          </h3>
        </div>
      </div>

      <div className="space-y-2">
        {history.map((item) => (
          <div key={item.id} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
            <div>
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" /> {item.campaign_name}
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Sent: {item.sent_date} • Channel: {item.channel}
              </p>
            </div>

            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-emerald-400 font-bold font-mono text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" /> {item.response_status}
              </span>
              <span className="text-[10px] text-slate-500 block font-mono">
                Next: {item.next_scheduled_outreach}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
