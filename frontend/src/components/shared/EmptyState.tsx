import React from "react";
import { LucideIcon, Inbox } from "lucide-react";
import clsx from "clsx";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = Inbox,
  actionLabel,
  onAction,
  className
}) => {
  return (
    <div
      className={clsx(
        "bg-slate-800/40 border border-slate-800/80 rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-3",
        className
      )}
    >
      <div className="w-12 h-12 bg-slate-800 border border-slate-700/60 rounded-2xl flex items-center justify-center text-teal-400">
        <Icon className="w-6 h-6" />
      </div>

      <div className="max-w-md space-y-1">
        <h4 className="text-sm font-bold text-slate-200">{title}</h4>
        <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
      </div>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-2 px-3.5 py-1.5 bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold rounded-xl transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
