import React from "react";
import { StatusBadge } from "../shared/StatusBadge";
import { Server, Database, ShieldCheck, MessageSquare, HardDrive, Cpu, Zap } from "lucide-react";

export interface SystemServiceHealth {
  service_name: string;
  category: string;
  status: "operational" | "degraded" | "down";
  latency_ms: number;
  uptime_pct: number;
  icon: React.ComponentType<{ className?: string }>;
}

export const SystemHealthCard: React.FC = () => {
  const services: SystemServiceHealth[] = [
    { service_name: "FastAPI Backend Services", category: "API Gateway", status: "operational", latency_ms: 120, uptime_pct: 99.99, icon: Server },
    { service_name: "Cloud SQL PostgreSQL 15", category: "Relational DB", status: "operational", latency_ms: 45, uptime_pct: 99.98, icon: Database },
    { service_name: "Firestore Native Database", category: "NoSQL DB", status: "operational", latency_ms: 32, uptime_pct: 99.99, icon: Database },
    { service_name: "Firebase Auth Engine", category: "Authentication", status: "operational", latency_ms: 85, uptime_pct: 100.0, icon: ShieldCheck },
    { service_name: "WhatsApp Cloud API", category: "Notifications", status: "operational", latency_ms: 310, uptime_pct: 99.95, icon: MessageSquare },
    { service_name: "Cloud Storage Bucket", category: "PDF Storage", status: "operational", latency_ms: 110, uptime_pct: 99.99, icon: HardDrive },
    { service_name: "GCP Cloud Tasks", category: "Task Queue", status: "operational", latency_ms: 15, uptime_pct: 99.99, icon: Cpu }
  ];

  return (
    <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4.5 space-y-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-teal-400" />
          <h3 className="text-sm font-bold text-white">Infrastructure & Core Services Health</h3>
        </div>
        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-mono">
          System Score: 99/100
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
        {services.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-slate-800 rounded-lg text-teal-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-white text-xs">{s.service_name}</span>
                </div>
                <StatusBadge label={s.status} variant="success" size="sm" />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                <span>{s.category}</span>
                <span>Latency: {s.latency_ms}ms</span>
                <span className="text-emerald-400 font-bold">{s.uptime_pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
