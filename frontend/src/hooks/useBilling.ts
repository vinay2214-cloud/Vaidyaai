import { useEffect, useRef, useState, useCallback } from "react";
import api from "../lib/api";
import { useClinicStore } from "../store/clinicStore";
import { apiErrorMessage } from "../lib/errors";

export interface BillingSummary {
  date: string;
  total_billed_rupees: number;
  total_collected_rupees: number;
  upi_collected_rupees: number;
  cash_collected_rupees: number;
  pending_rupees: number;
  invoice_count: number;
  invoices: any[];
}

/** Healthy cadence. Billing figures change when a payment lands, not constantly. */
const BASE_POLL_MS = 15000;
/** Ceiling for the backoff. A broken endpoint is polled once a minute, not 12×. */
const MAX_POLL_MS = 60000;

export function useBilling() {
  const clinicId = useClinicStore((state) => state.clinicId);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Consecutive failures drive the backoff. Held in a ref so adjusting the
  // cadence never itself triggers a re-render/refetch loop.
  const failuresRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTodayBilling = useCallback(async () => {
    if (!clinicId) return;
    try {
      setLoading(true);
      const res = await api.get(`/billing/today?clinic_id=${clinicId}`);
      setSummary(res.data);
      setError(null);
      failuresRef.current = 0;
    } catch (e) {
      console.warn("Could not fetch today billing:", e);
      failuresRef.current += 1;
      // Only report a failure when there is nothing on screen; otherwise a
      // single dropped poll would flash an error over figures that are still
      // perfectly valid.
      setSummary((current) => {
        if (current === null) {
          setError(apiErrorMessage(e, "load today's billing"));
        }
        return current;
      });
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId) return;

    let cancelled = false;

    // Self-rescheduling timeout rather than a fixed interval, so the delay can
    // grow while the endpoint is failing. A hard 5s interval meant a broken
    // billing endpoint was hit 720 times an hour, filling the console with
    // identical errors and burying whatever the real problem was.
    const scheduleNext = () => {
      if (cancelled) return;
      const delay = Math.min(BASE_POLL_MS * 2 ** failuresRef.current, MAX_POLL_MS);
      timerRef.current = setTimeout(run, delay);
    };

    const run = async () => {
      if (cancelled) return;
      // Skip polling for a hidden tab; resume on the next visible tick.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        scheduleNext();
        return;
      }
      await fetchTodayBilling();
      scheduleNext();
    };

    run();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [clinicId, fetchTodayBilling]);

  /** Manual refresh also clears the backoff — the user asked for it now. */
  const refresh = useCallback(async () => {
    failuresRef.current = 0;
    await fetchTodayBilling();
  }, [fetchTodayBilling]);

  return { summary, loading, error, refresh };
}
