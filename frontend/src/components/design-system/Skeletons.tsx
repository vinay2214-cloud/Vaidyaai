"use client";

import React from "react";
import { cn } from "@/lib/cn";

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background-elevated/50 p-4 animate-pulse space-y-3",
        className
      )}
      role="status"
      aria-label="Loading content"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-background-input border border-border shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-4 w-1/3 bg-background-input rounded" />
          <div className="h-3 w-1/2 bg-background-input/60 rounded" />
        </div>
      </div>
      <div className="h-10 w-full bg-background-input/40 rounded" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2 animate-pulse", className)} role="status" aria-label="Loading table data">
      <div className="h-8 w-full bg-background-elevated/60 rounded-lg" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 w-full bg-background-elevated/30 rounded-lg flex items-center px-4 gap-4">
          <div className="h-4 w-1/4 bg-background-input rounded" />
          <div className="h-4 w-1/6 bg-background-input/60 rounded" />
          <div className="h-4 w-1/5 bg-background-input/40 rounded" />
          <div className="h-4 w-1/4 bg-background-input rounded ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-background-elevated/50 p-4 animate-pulse space-y-4", className)} role="status" aria-label="Loading chart data">
      <div className="h-5 w-1/3 bg-background-input rounded" />
      <div className="h-44 w-full flex items-end gap-3 pt-6 px-2">
        {[40, 65, 30, 85, 55, 70, 45].map((h, i) => (
          <div key={i} className="flex-1 bg-teal-500/20 rounded-t-lg" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

/**
 * Queue-row placeholder. Deliberately mirrors QueuePatientRow's geometry —
 * avatar, two text lines, trailing action — so the layout does not jump when
 * real appointments arrive.
 */
export function SkeletonQueueRow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl bg-background-elevated/50 border border-border animate-pulse",
        className
      )}
      role="status"
      aria-label="Loading patient"
    >
      <div className="w-10 h-10 rounded-full bg-background-input border border-border shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-32 bg-background-input rounded" />
          <div className="h-4 w-8 bg-background-input/60 rounded" />
          <div className="h-4 w-16 bg-background-input/40 rounded" />
        </div>
        <div className="h-3 w-2/3 bg-background-input/50 rounded" />
      </div>
      <div className="h-8 w-20 bg-background-input/60 rounded-lg shrink-0" />
    </div>
  );
}

/** Grouped queue placeholder: a section shell wrapping several rows. */
export function SkeletonQueueSection({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("panel p-4 border-l-4 border-border", className)} role="status" aria-label="Loading queue">
      <div className="flex items-center justify-between mb-4 animate-pulse">
        <div className="h-4 w-28 bg-background-input rounded" />
        <div className="h-5 w-20 bg-background-input/60 rounded-full" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonQueueRow key={i} />
        ))}
      </div>
    </div>
  );
}

/** KPI / stat tile placeholder for dashboards and analytics headers. */
export function SkeletonStatTile({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl bg-background-elevated/50 border border-border p-3.5 space-y-2 animate-pulse",
        className
      )}
      role="status"
      aria-label="Loading metric"
    >
      <div className="flex items-center justify-between">
        <div className="h-7 w-16 bg-background-input rounded" />
        <div className="w-7 h-7 rounded-lg bg-background-input/60" />
      </div>
      <div className="h-3 w-20 bg-background-input/40 rounded" />
    </div>
  );
}

/** Activity/log feed placeholder. */
export function SkeletonFeed({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3 animate-pulse", className)} role="status" aria-label="Loading activity">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-background-input mt-1.5 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-3/4 bg-background-input/70 rounded" />
            <div className="h-3 w-1/3 bg-background-input/40 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
