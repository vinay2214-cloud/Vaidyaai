"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorState } from "@/components/shared/ErrorState";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { Activity, UserX, AlertTriangle, RefreshCw, LogOut } from "lucide-react";
import { logout } from "@/lib/auth";
import { waitForAuthReady, getFirebaseAuth } from "@/lib/firebase";
import { BACKEND_URL } from "@/lib/constants";

/**
 * How long startup may sit in the indeterminate "resolving session" state before
 * we stop showing a spinner and start showing a diagnosis.
 *
 * WHY THIS EXISTS: `useAuth` only clears `loading` at the very end of its
 * onAuthStateChanged handler, after a Firestore read, up to two ID-token
 * refreshes and a clinic-mapping lookup. Any one of those hanging — Firestore
 * rules denying the read, the backend unreachable, an offline tab — left the
 * user on "Loading VaidyaAI Workspace..." forever with nothing in the UI to say
 * why. A spinner that never resolves is indistinguishable from a dead build.
 */
const INIT_TIMEOUT_MS = 8000;

/** How long the reachability probe may take before we call the API down. */
const PROBE_TIMEOUT_MS = 5000;

type ProbeResult = "pending" | "reachable" | "unreachable";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, error } = useAuth();
  const router = useRouter();

  // True while startup has not yet produced either a user or a definite error.
  const isSettling = loading || (!user && !error);

  const [initTimedOut, setInitTimedOut] = useState(false);
  const [apiReachable, setApiReachable] = useState<ProbeResult>("pending");

  useEffect(() => {
    if (loading || user || error) return;

    // Defence in depth: only redirect once Firebase itself confirms there is no
    // restored session. useAuth already waits for onAuthStateChanged, but this
    // guarantees we never bounce a user whose session is merely mid-rehydration.
    let cancelled = false;
    waitForAuthReady().then((restoredUser) => {
      if (cancelled) return;
      if (restoredUser || getFirebaseAuth()?.currentUser) {
        // A valid session exists after all; useAuth will settle the clinic state.
        return;
      }
      console.info("[DashboardLayout] No authenticated Firebase session. Redirecting to /login.");
      router.replace("/login");
    });

    return () => {
      cancelled = true;
    };
  }, [loading, user, error, router]);

  // Arm the watchdog only while startup is actually indeterminate, and disarm it
  // the moment startup settles so a slow-but-successful load never shows an error.
  useEffect(() => {
    if (!isSettling) {
      setInitTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setInitTimedOut(true), INIT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isSettling]);

  // Once we have given up, work out *which* dependency is down so the error
  // message is actionable instead of generic.
  useEffect(() => {
    if (!initTimedOut) return;

    let cancelled = false;
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    fetch(`${BACKEND_URL}/livez`, { signal: controller.signal, cache: "no-store" })
      .then((res) => {
        if (!cancelled) setApiReachable(res.ok ? "reachable" : "unreachable");
      })
      .catch(() => {
        if (!cancelled) setApiReachable("unreachable");
      })
      .finally(() => clearTimeout(abortTimer));

    return () => {
      cancelled = true;
      clearTimeout(abortTimer);
      controller.abort();
    };
  }, [initTimedOut]);

  if (isSettling && initTimedOut) {
    const diagnosis =
      apiReachable === "unreachable"
        ? "The VaidyaAI API could not be reached from this browser. This is usually a network problem, or the API rejecting this origin."
        : apiReachable === "reachable"
        ? "The API is responding, so this is an authentication or clinic-permissions problem rather than a connectivity one. The browser console has the underlying error."
        : "Checking which service is unavailable...";

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 antialiased">
        <div
          role="alert"
          aria-live="assertive"
          className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-bold text-white">Unable to connect to VaidyaAI services</h2>

          <p className="text-xs text-slate-400 leading-relaxed">
            Please check your connection or try again. {diagnosis}
          </p>

          <dl className="text-[11px] text-left bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 space-y-1 font-mono">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">API</dt>
              <dd className="text-slate-300 truncate" title={BACKEND_URL}>
                {BACKEND_URL}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Status</dt>
              <dd
                className={
                  apiReachable === "reachable"
                    ? "text-emerald-400"
                    : apiReachable === "unreachable"
                    ? "text-rose-400"
                    : "text-slate-400"
                }
              >
                {apiReachable}
              </dd>
            </div>
          </dl>

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-teal-300"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
            <button
              onClick={() => logout()}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isSettling) {
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
