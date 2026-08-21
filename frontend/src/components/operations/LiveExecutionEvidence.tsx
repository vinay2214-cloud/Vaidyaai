"use client";

import React from "react";
import { cn } from "@/lib/cn";
import { AILiveStatus } from "@/hooks/useAILiveStatus";
import { ShieldCheck, ShieldAlert, Cpu, MapPin, Timer, Loader2 } from "lucide-react";

interface LiveExecutionEvidenceProps {
  status: AILiveStatus | null;
  loading: boolean;
  error: string | null;
  isLiveVerified: boolean;
  isConfigured: boolean;
  onRetry?: () => void;
  className?: string;
}

function Row({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="flex items-center gap-1.5 text-foreground-subtle shrink-0">
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        {label}
      </span>
      <span className={cn("font-mono text-foreground truncate text-right", valueClassName)} title={value}>
        {value}
      </span>
    </div>
  );
}

/**
 * The single strongest piece of evidence that clinical AI is real: which model
 * actually answered, where it ran, and how fast. Rendered persistently rather
 * than behind a disclosure, because this is the first thing a reviewer looks
 * for and the last thing that should require digging.
 *
 * The verified/unverified distinction is load-bearing. "Live & Verified" is
 * claimed only after a successful Vertex execution has actually been observed;
 * anything short of that reports the weaker, truthful state.
 */
export function LiveExecutionEvidence({
  status,
  loading,
  error,
  isLiveVerified,
  isConfigured,
  onRetry,
  className,
}: LiveExecutionEvidenceProps) {
  if (loading && !status) {
    return (
      <div
        className={cn("rounded-xl border border-border bg-background-elevated p-3 space-y-2.5 animate-pulse", className)}
        role="status"
        aria-label="Loading AI execution telemetry"
      >
        <div className="h-5 w-32 bg-background-input rounded" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-3 w-20 bg-background-input/60 rounded" />
            <div className="h-3 w-24 bg-background-input/40 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className={cn("rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2", className)} role="alert">
        <div className="flex items-center gap-1.5 text-amber-300">
          <ShieldAlert className="w-4 h-4" aria-hidden="true" />
          <span className="text-xs font-bold">AI telemetry unavailable</span>
        </div>
        <p className="text-xs text-amber-200/90 leading-relaxed">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs font-bold text-amber-200 underline underline-offset-2 hover:text-amber-100 focus-ring rounded"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!status) return null;

  const executedModel = status.last_live_model || status.reasoning_model;
  const executedRegion = status.last_live_location || status.reasoning_location;
  const latency =
    status.last_live_latency_ms != null ? `${Math.round(status.last_live_latency_ms)}ms` : "awaiting first call";

  const badgeLabel = isLiveVerified
    ? "Live & Verified"
    : isConfigured
    ? "Live — awaiting first execution"
    : "Mock fallback permitted";

  const badgeTone = isLiveVerified
    ? "bg-teal-500/10 text-teal-300 border-teal-500/30"
    : isConfigured
    ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
    : "bg-red-500/10 text-red-300 border-red-500/30";

  return (
    <div className={cn("rounded-xl border border-border bg-background-elevated p-3 space-y-2.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-foreground-subtle">AI Execution</span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap",
            badgeTone
          )}
        >
          {isLiveVerified ? (
            <ShieldCheck className="w-3 h-3" aria-hidden="true" />
          ) : isConfigured ? (
            <Loader2 className="w-3 h-3" aria-hidden="true" />
          ) : (
            <ShieldAlert className="w-3 h-3" aria-hidden="true" />
          )}
          {badgeLabel}
        </span>
      </div>

      <div className="space-y-1.5 pt-0.5">
        <Row icon={Cpu} label="Model" value={executedModel} />
        <Row icon={MapPin} label="Region" value={executedRegion} />
        <Row
          icon={Timer}
          label="Last latency"
          value={latency}
          valueClassName={status.last_live_latency_ms != null ? undefined : "text-foreground-subtle"}
        />
      </div>

      <p className="text-[10px] text-foreground-subtle leading-relaxed border-t border-border/60 pt-2">
        {isLiveVerified
          ? "Reported by the backend after a completed Vertex AI call. Mock fallback is disabled, so clinical output cannot be synthetic."
          : isConfigured
          ? "Live clinical AI is enabled and mock fallback is disabled. These figures populate after the first clinical AI call of this session."
          : "Mock fallback is currently permitted. Clinical output may not come from a live model."}
      </p>
    </div>
  );
}
