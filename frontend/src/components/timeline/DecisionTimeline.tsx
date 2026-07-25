import React from "react";
import { DecisionEntry, LogData } from "./DecisionEntry";
import { EmptyState } from "../shared/EmptyState";
import { Bot, RefreshCw } from "lucide-react";

interface DecisionTimelineProps {
  logs: LogData[];
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export const DecisionTimeline: React.FC<DecisionTimelineProps> = ({
  logs,
  loading = false,
  onRefresh,
  className
}) => {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-slate-800/40 border border-slate-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <EmptyState
        title="No Agent Decisions Streaming"
        description="Real-time agent decisions will stream here as incoming WhatsApp messages, voice scribes, and billing events occur."
        icon={Bot}
        actionLabel={onRefresh ? "Refresh Feed" : undefined}
        onAction={onRefresh}
      />
    );
  }

  return (
    <div className={`mt-4 ${className || ""}`}>
      {logs.map((log) => (
        <DecisionEntry key={log.id} log={log} />
      ))}
    </div>
  );
};
