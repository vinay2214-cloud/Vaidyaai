"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorState } from "@/components/shared/ErrorState";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { Activity, UserX } from "lucide-react";
import { logout } from "@/lib/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && !error) {
      router.replace("/login");
    }
  }, [loading, user, error, router]);

  if (loading || (!user && !error)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Activity className="w-10 h-10 text-teal-400 animate-pulse" />
          <p className="text-foreground-muted text-sm font-medium">Loading VaidyaAI Workspace...</p>
        </div>
      </div>
    );
  }

  if (error === "no_clinic") {
    const isStaff = user?.email?.includes("staff") || false;

    if (isStaff) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <UserX className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">Pending Clinic Assignment</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your account has been authenticated, but you have not yet been assigned to an active clinic workspace. Please contact your healthcare administrator.
            </p>
            <button
              onClick={() => logout()}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
            >
              Sign Out & Return to Login
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <OnboardingWizard onComplete={() => window.location.reload()} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <ErrorState
          title="Authentication Exception"
          description="Could not resolve clinic credentials. Please sign in again."
          onRetry={() => logout()}
        />
      </div>
    );
  }

  return (
    <AppShell>
      {children}
    </AppShell>
  );
}
