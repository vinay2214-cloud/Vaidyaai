import React from "react";
import clsx from "clsx";
import { AGENT_COLOR_MAP } from "@/lib/constants";
import { Bot } from "lucide-react";

interface AgentChipProps {
  agentName: string;
  size?: "sm" | "md";
  className?: string;
}

export const AgentChip: React.FC<AgentChipProps> = ({
  agentName,
  size = "sm",
  className
}) => {
  // Normalize agent ID lookup key
  const normalizedKey = agentName.toLowerCase().replace(/[^a-z0-9]/g, "_");
  
  let agentId = "appointment_flow";
  if (normalizedKey.includes("scribe")) agentId = "clinical_scribe";
  else if (normalizedKey.includes("billing")) agentId = "billing_pulse";
  else if (normalizedKey.includes("retention")) agentId = "retention_radar";
  else if (normalizedKey.includes("prescription") || normalizedKey.includes("safety")) agentId = "prescription_safe";
  else if (normalizedKey.includes("insight")) agentId = "insight_engine";
  else if (normalizedKey.includes("referral")) agentId = "referral_coordinator";

  const colorConfig = AGENT_COLOR_MAP[agentId] || {
    bg: "bg-teal-500/10",
    text: "text-teal-400",
    border: "border-teal-500/30"
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5"
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center font-bold border rounded-lg transition-colors font-mono",
        colorConfig.bg,
        colorConfig.text,
        colorConfig.border,
        sizeStyles[size],
        className
      )}
    >
      <Bot className="w-3 h-3 shrink-0" />
      <span className="truncate">{agentName}</span>
    </span>
  );
};
