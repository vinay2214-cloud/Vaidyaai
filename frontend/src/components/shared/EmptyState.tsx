import React from "react";
import { LucideIcon, Inbox, Sparkles } from "lucide-react";
import clsx from "clsx";

interface EmptyStateProps {
  title: string;
  description: string;
  howItWorks?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  howItWorks,
  icon: Icon = Inbox,
  actionLabel,
  onAction,
  className
}) => {
  return (
    <div
      className={clsx(
        "bg-slate-800/40 border border-slate-800/80 rounded-2xl p-6 text-center flex flex-col items-center justify-center space-y-3 shadow-sm",
        className
      )}
    >
      <div className="w-11 h-11 bg-slate-800 border border-slate-700/60 rounded-2xl flex items-center justify-center text-teal-400">
        <Icon className="w-5 h-5" />
      </div>

      <div className="max-w-md space-y-1">
        <h4 className="text-sm font-bold text-slate-200">{title}</h4>
        <p className="text-xs text-slate-400 leading-relaxed">{description}</p>

        {howItWorks && (
          <div className="mt-2 p-2.5 bg-slate-900/60 border border-slate-700/50 rounded-xl text-[11px] text-teal-300 flex items-start gap-2 text-left font-mono">
            <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
            <span>{howItWorks}</span>
          </div>
        )}
      </div>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-1 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold rounded-xl transition-colors focus:ring-2 focus:ring-teal-400 focus:outline-none shadow-md shadow-teal-500/10"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
