import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import clsx from "clsx";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Unable to Load Module Data",
  description = "A network or server error occurred while retrieving clinical operations data. Please try again.",
  onRetry,
  className
}) => {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={clsx(
        "bg-rose-950/20 border border-rose-500/30 rounded-2xl p-6 text-center space-y-3 max-w-md mx-auto my-6 shadow-lg",
        className
      )}
    >
      <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center text-rose-400 mx-auto">
        <AlertTriangle className="w-6 h-6" />
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
        <p className="text-xs text-slate-300 leading-relaxed">{description}</p>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-bold rounded-xl inline-flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-400"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry Action
        </button>
      )}
    </div>
  );
};
