"use client";

import React, { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The Speech-to-Text + Gemini SOAP generation window is genuinely ~8-10s.
 *
 * A single static spinner over that long a wait is indistinguishable from a
 * hung request, and it hides the fact that several distinct things are
 * happening. Naming the stages turns real latency into a legible process.
 *
 * These stages are advisory, not instrumented: the backend performs the work in
 * one call, so this is an honest description of the pipeline rather than live
 * per-stage telemetry. The final stage therefore never self-completes — it
 * stays in progress until the actual response arrives and this unmounts.
 */
const STAGES = [
  { label: "Transcribing audio", ms: 2600 },
  { label: "Extracting clinical facts", ms: 2400 },
  { label: "Validating against transcript", ms: 2200 },
  { label: "Structuring SOAP note", ms: Infinity },
] as const;

export function TranscriptionProgress({ className }: { className?: string }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (stage >= STAGES.length - 1) return;
    const timer = setTimeout(() => setStage((s) => s + 1), STAGES[stage].ms);
    return () => clearTimeout(timer);
  }, [stage]);

  return (
    <div
      className={cn("w-full flex flex-col items-center gap-3 py-4", className)}
      role="status"
      aria-live="polite"
      aria-label={`Processing consultation audio: ${STAGES[stage].label}`}
    >
      <Loader2 className="w-7 h-7 animate-spin text-teal-400" aria-hidden="true" />

      <ol className="w-full max-w-xs space-y-1.5">
        {STAGES.map((s, i) => {
          const done = i < stage;
          const active = i === stage;
          return (
            <li
              key={s.label}
              className={cn(
                "flex items-center gap-2 text-xs transition-colors duration-300",
                done && "text-foreground-subtle",
                active && "text-teal-300 font-semibold",
                !done && !active && "text-foreground-subtle/50"
              )}
            >
              <span className="w-4 h-4 flex items-center justify-center shrink-0" aria-hidden="true">
                {done ? (
                  <Check className="w-3.5 h-3.5 text-teal-400" />
                ) : active ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-breathe" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
                )}
              </span>
              {s.label}
              {active && <span className="sr-only"> — in progress</span>}
            </li>
          );
        })}
      </ol>

      <p className="text-[11px] text-foreground-subtle text-center max-w-xs leading-relaxed">
        Clinical AI is drafting the note. This usually takes under ten seconds.
      </p>
    </div>
  );
}
