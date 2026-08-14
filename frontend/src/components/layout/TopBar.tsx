"use client";

import React from "react";
import Link from "next/link";
import { useClinicStore } from "@/store/clinicStore";
import { useUIStore } from "@/store/uiStore";
import { usePathname } from "next/navigation";
import { useToast } from "@/components/design-system";
import { Search, Bell, Command, Activity, LogOut, User } from "lucide-react";
import { logout } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/design-system";

interface TopBarProps {
  onSearchOpen: () => void;
  notificationCount?: number;
}

export function TopBar({ onSearchOpen, notificationCount = 0 }: TopBarProps) {
  const clinicName = useClinicStore((state) => state.clinicName);
  const doctorName = useClinicStore((state) => state.doctorName);
  const currentPatientId = useClinicStore((state) => state.currentPatientId);
  const pathname = usePathname();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      toast("Logout failed", "error");
    }
  };

  return (
    <header className="h-14 bg-background-panel border-b border-border flex items-center justify-between px-4 shrink-0 z-40">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
            <Activity className="w-4 h-4 text-teal-400" />
          </div>
          <div className="hidden md:block">
            <h1 className="text-sm font-bold text-foreground leading-none">{clinicName || "VaidyaAI Clinic"}</h1>
            <p className="text-[10px] text-foreground-muted mt-0.5">AI-native clinic operating system</p>
          </div>
        </Link>

        <div className="hidden lg:flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-background-elevated rounded-lg border border-border">
            <User className="w-3.5 h-3.5 text-foreground-muted" />
            <span className="text-foreground font-medium">{doctorName ? (doctorName.trim().toLowerCase().startsWith("dr") ? doctorName : `Dr. ${doctorName}`) : "Doctor"}</span>
          </div>
          {currentPatientId && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-500/10 rounded-lg border border-teal-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-teal-400 font-medium">In Consultation</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onSearchOpen}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-background-elevated hover:bg-background-hover border border-border rounded-lg text-xs text-foreground-muted transition-colors focus-ring"
          aria-label="Open universal search"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="font-medium">Search</span>
          <kbd className="ml-2 px-1.5 py-0.5 bg-background-panel border border-border rounded text-[10px] font-mono">⌘K</kbd>
        </button>

        <button
          className="relative p-2 text-foreground-muted hover:text-foreground hover:bg-background-hover rounded-lg transition-colors focus-ring"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          {notificationCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>

        <button
          onClick={handleLogout}
          className="p-2 text-foreground-muted hover:text-foreground hover:bg-background-hover rounded-lg transition-colors focus-ring"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
