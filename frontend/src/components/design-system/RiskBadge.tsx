"use client";

import React from "react";
import { cn } from "@/lib/cn";

type RiskLevel = "low" | "medium" | "high" | "critical";

interface RiskBadgeProps {
  level: RiskLevel;
  label?: string;
  className?: string;
}

export function RiskBadge({ level, label, className }: RiskBadgeProps) {
  const config: Record<RiskLevel, { color: string; text: string }> = {
    low: { color: "bg-green-500", text: "text-green-400" },
    medium: { color: "bg-orange-500", text: "text-orange-400" },
    high: { color: "bg-red-500", text: "text-red-400" },
    critical: { color: "bg-red-600", text: "text-red-400" },
  };

  const c = config[level];
  const text = label || level.charAt(0).toUpperCase() + level.slice(1);

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-background-elevated border border-border", className)}>
      <span className={cn("w-2 h-2 rounded-full", c.color)} />
      <span className={c.text}>{text}</span>
    </span>
  );
}
