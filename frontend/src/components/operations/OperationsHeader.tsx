import React from "react";
import { Cpu, Server, Activity, ShieldCheck, RefreshCw } from "lucide-react";
import { KPICard } from "../shared/KPICard";

interface OperationsHeaderProps {
  platformHealthScore: number;
  uptimePct: string;
  version: string;
  environment: string;
  lastSync: string;
  onRefresh: () => void;
  className?: string;
}

export const OperationsHeader: React.FC<OperationsHeaderProps> = ({
  platformHealthScore,
  uptimePct,
  version,
  environment,
  lastSync,
  onRefresh,
  className
}) => {
  return (
    <div className={`space-y-4 ${className || ""}`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-teal-400" />
            <h2 className="text-lg font-bold text-white">AI Operations Center</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise AI System Control Room • Managed by Agent 6 (InsightEngine) & Cloud Monitoring
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <RefreshCw className="w-4 h-4 text-teal-400" /> Refresh Operations State
        </button>
      </div>

      {/* Top System Metadata Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard title="Platform Health" value={`${platformHealthScore}/100`} subtitle="All systems nominal" icon={Activity} color="teal" />
        <KPICard title="System Uptime" value={uptimePct} subtitle="GCP asia-south1 Cloud Run" icon={Server} color="emerald" />
        <KPICard title="Environment" value={environment} subtitle={`Version ${version}`} icon={ShieldCheck} color="blue" />
        <KPICard title="Last Health Sync" value={lastSync} subtitle="Real-time heartbeat active" icon={Cpu} color="purple" />
      </div>
    </div>
  );
};
