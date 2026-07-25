import React from "react";
import clsx from "clsx";
import { Zap } from "lucide-react";

interface LatencyBadgeProps {
  latencyMs?: number;
  className?: string;
}

export const LatencyBadge: React.FC<LatencyBadgeProps> = ({
  latencyMs = 850,
  className
}) => {
  let colorStyle = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  if (latencyMs > 1500) {
    colorStyle = "bg-rose-500/10 text-rose-400 border-rose-500/30";
  } else if (latencyMs > 800) {
    colorStyle = "bg-amber-500/10 text-amber-400 border-amber-500/30";
  }

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono border rounded-md font-medium",
        colorStyle,
        className
      )}
    >
      <Zap className="w-3 h-3 shrink-0" />
      {latencyMs}ms
    </span>
  );
};
