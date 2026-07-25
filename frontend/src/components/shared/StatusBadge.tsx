import React from "react";
import clsx from "clsx";

export type StatusVariant = 
  | "success" 
  | "warning" 
  | "error" 
  | "info" 
  | "neutral" 
  | "pending"
  | "running"
  | "completed";

interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
  size?: "sm" | "md";
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = "neutral",
  size = "sm",
  className
}) => {
  const variantStyles: Record<StatusVariant, string> = {
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    error: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    info: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    running: "bg-teal-500/10 text-teal-400 border-teal-500/30",
    neutral: "bg-slate-700/50 text-slate-300 border-slate-600/40"
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-1 text-xs"
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center font-medium border rounded-full transition-colors",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {label}
    </span>
  );
};
