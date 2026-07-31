"use client";

import React from "react";
import { cn } from "@/lib/cn";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatTimeAgo } from "@/lib/time";

export interface ActivityItem {
  id: string;
  time: string;
  agent: string;
  agentColor?: "teal" | "blue" | "orange" | "red" | "green" | "gray";
  message: string;
  status: "completed" | "running" | "pending" | "failed";
  details?: string;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  loading?: boolean;
  className?: string;
  emptyMessage?: string;
}

const agentColors: Record<string, string> = {
  teal: "bg-teal-500/10 text-teal-400 border-teal-500/30",
  blue: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  orange: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  red: "bg-red-500/10 text-red-400 border-red-500/30",
  green: "bg-green-500/10 text-green-400 border-green-500/30",
  gray: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

const statusIcons = {
  completed: <CheckCircle2 className="w-4 h-4 text-green-400" />,
  running: <div className="w-4 h-4 flex items-center justify-center"><span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" /></div>,
  pending: <Clock className="w-4 h-4 text-orange-400" />,
  failed: <XCircle className="w-4 h-4 text-red-400" />,
};

export function ActivityFeed({ items, loading, className, emptyMessage = "No activity yet" }: ActivityFeedProps) {
  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-background-elevated/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={cn("text-sm text-foreground-subtle py-6 text-center", className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {items.map((item, idx) => (
        <div
          key={item.id}
          className={cn(
            "group flex items-start gap-3 p-3 rounded-xl transition-all duration-250 hover:bg-background-hover",
            idx !== items.length - 1 && "border-b border-border/50"
          )}
        >
          <div className="flex flex-col items-center gap-1 pt-0.5">
            <span className="text-xs font-mono text-foreground-subtle whitespace-nowrap">
              {item.time}
            </span>
            <span className="w-px h-full bg-border group-last:hidden" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("px-2 py-0.5 rounded-md text-[11px] font-semibold border", agentColors[item.agentColor || "gray"])}>
                {item.agent}
              </span>
              {statusIcons[item.status]}
            </div>
            <p className="text-sm text-foreground mt-1.5">{item.message}</p>
            {item.details && (
              <p className="text-xs text-foreground-subtle mt-1">{item.details}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
