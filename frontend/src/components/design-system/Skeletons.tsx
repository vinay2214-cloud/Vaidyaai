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
