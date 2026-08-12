"use client";

import React from "react";
import { Activity } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3">
        <Activity className="w-10 h-10 text-teal-400 animate-pulse" />
        <p className="text-slate-400 text-xs font-mono">Initializing VaidyaAI Outpatient Operating System...</p>
      </div>
    </div>
  );
}
