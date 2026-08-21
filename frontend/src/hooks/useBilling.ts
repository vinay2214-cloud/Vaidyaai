import { useEffect, useState, useCallback } from "react";
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

export function useBilling() {
  const clinicId = useClinicStore((state) => state.clinicId);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTodayBilling = useCallback(async () => {
    if (!clinicId) return;
    try {
      setLoading(true);
      const res = await api.get(`/billing/today?clinic_id=${clinicId}`);
      setSummary(res.data);
      setError(null);
    } catch (e) {
      console.warn("Could not fetch today billing:", e);
      // This hook polls every 5s. Only report a failure when there is nothing
      // on screen; otherwise a single dropped poll would flash an error over
      // figures that are still perfectly valid.
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
    fetchTodayBilling();
    const interval = setInterval(() => {
      fetchTodayBilling();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchTodayBilling]);

  return { summary, loading, error, refresh: fetchTodayBilling };
}
