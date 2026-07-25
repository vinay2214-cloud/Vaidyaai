import React from "react";
import { StatusBadge } from "../shared/StatusBadge";
import { CheckCircle2, MessageSquare, CreditCard, Sparkles, Database, Server } from "lucide-react";

export interface IntegrationHealth {
  name: string;
  provider: string;
  status: "connected" | "disconnected" | "syncing";
  lastSync: string;
  healthPct: number;
}

export const IntegrationCard: React.FC = () => {
  const integrations: IntegrationHealth[] = [
    { name: "WhatsApp Cloud API", provider: "Meta Business", status: "connected", lastSync: "1 min ago", healthPct: 100 },
    { name: "Razorpay Payment Gateway", provider: "Razorpay India", status: "connected", lastSync: "2 mins ago", healthPct: 100 },
    { name: "Google Vertex AI Gemini 1.5", provider: "Google Cloud Platform", status: "connected", lastSync: "Just now", healthPct: 99 },
    { name: "Firestore Realtime DB", provider: "Google Firebase", status: "connected", lastSync: "Just now", healthPct: 100 },
    { name: "Cloud SQL PostgreSQL 15", provider: "GCP Cloud SQL", status: "connected", lastSync: "5 mins ago", healthPct: 100 },
    { name: "GCP Cloud Tasks Queues", provider: "Google Cloud", status: "connected", lastSync: "Just now", healthPct: 100 }
  ];

  return (
    <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4.5 space-y-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Third-Party & Healthcare Integrations</h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">All 6 Active</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
        {integrations.map((item, idx) => (
          <div key={idx} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-xs">{item.name}</h4>
              <StatusBadge label={item.status} variant="success" size="sm" />
            </div>

            <p className="text-[11px] text-slate-400 font-mono">Provider: {item.provider}</p>

            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
              <span>Sync: {item.lastSync}</span>
              <span className="text-teal-400 font-bold">{item.healthPct}% Health</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
