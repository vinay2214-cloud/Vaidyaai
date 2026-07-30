"use client";

import React from "react";
import { cn } from "@/lib/cn";
import { Cpu, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

type AIStatusState = "thinking" | "running" | "completed" | "warning" | "needs_review" | "pending";

interface AIStatusProps {
  state: AIStatusState;
  label: string;
  className?: string;
  pulse?: boolean;
}

const config: Record<AIStatusState, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  pending: {
    icon: <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />,
    color: "text-foreground-subtle",
    bg: "bg-gray-500/10",
    border: "border-gray-500/30",
  },
  thinking: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    border: "border-teal-500/30",
  },
  running: {
    icon: <div className="flex gap-0.5"><span className="ai-thinking-dot" /><span className="ai-thinking-dot animation-delay-150" /><span className="ai-thinking-dot animation-delay-300" /></div>,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  completed: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
  },
  warning: {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
  },
  needs_review: {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
  },
};

export function AIStatus({ state, label, className, pulse = true }: AIStatusProps) {
  const c = config[state] || config.pending;
  return (
    <div className={cn("inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border", c.bg, c.color, c.border, className)}>
      <span className={cn("flex items-center", pulse && state === "thinking" && "animate-pulse-subtle")}>
        {c.icon}
      </span>
      {label}
    </div>
  );
}
