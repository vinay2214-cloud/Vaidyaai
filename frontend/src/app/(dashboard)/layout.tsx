"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useClinicStore } from "@/store/clinicStore";
import { Calendar, Cpu, CreditCard, Users, Settings, Activity, PlusCircle } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { AgentStatusBar } from "@/components/AgentStatusBar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const pathname = usePathname();
  const clinicName = useClinicStore((state) => state.clinicName);
  const doctorName = useClinicStore((state) => state.doctorName);
  const setWalkInModalOpen = useUIStore((state) => state.setWalkInModalOpen);

  const navItems = [
    { label: "Today Queue", href: "/", icon: Calendar },
    { label: "Agent Logs", href: "/logs", icon: Cpu },
    { label: "Billing", href: "/billing", icon: CreditCard },
    { label: "Patients", href: "/patients", icon: Users },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Activity className="w-10 h-10 text-teal-400 animate-pulse" />
          <p className="text-slate-400 text-sm font-medium">Loading VaidyaAI Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col pb-20 md:pb-0">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-500/10 border border-teal-500/30 rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">{clinicName || "VaidyaAI Clinic"}</h1>
            <p className="text-xs text-slate-400 mt-1">Dr. {doctorName || "Doctor"}</p>
          </div>
        </div>

        <button
          onClick={() => setWalkInModalOpen(true)}
          className="px-3.5 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-lg shadow-teal-500/10"
        >
          <PlusCircle className="w-4 h-4" /> Walk-In Patient
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-5xl w-full mx-auto space-y-4">
        {/* Global AI Workforce Status Bar */}
        <AgentStatusBar />
        {children}
      </main>

      {/* Bottom Navigation for Mobile / PWA */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 flex justify-around py-2.5 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? "text-teal-400 bg-teal-500/10 border border-teal-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
