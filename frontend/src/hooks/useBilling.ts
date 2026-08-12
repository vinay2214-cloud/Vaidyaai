import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { useClinicStore } from "../store/clinicStore";

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

  const fetchTodayBilling = useCallback(async () => {
    if (!clinicId) return;
    try {
      setLoading(true);
      const res = await api.get(`/billing/today?clinic_id=${clinicId}`);
      setSummary(res.data);
    } catch (e) {
      console.warn("Could not fetch today billing:", e);
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

  return { summary, loading, refresh: fetchTodayBilling };
}
