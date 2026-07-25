import React from "react";
import clsx from "clsx";
import { ShieldAlert, ShieldCheck } from "lucide-react";

interface RiskBadgeProps {
  level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  flagCount?: number;
  className?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, flagCount = 0, className }) => {
  const isHigh = level === "CRITICAL" || level === "HIGH";

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border rounded-md font-mono",
        isHigh
          ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
          : level === "MEDIUM"
          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        className
      )}
    >
      {isHigh ? <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" /> : <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />}
      {level} RISK {flagCount > 0 ? `(${flagCount})` : ""}
    </span>
  );
};
