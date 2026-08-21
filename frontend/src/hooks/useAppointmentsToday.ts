import { useEffect, useState, useCallback } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { getFirestoreDb } from "../lib/firebase";
import { useClinicStore } from "../store/clinicStore";
import api from "../lib/api";
import { apiErrorMessage } from "../lib/errors";

export interface Appointment {
  appointment_id: string;
  patient_id: string;
  patient_name?: string;
  patient_phone_masked: string;
  slot_time_str: string;
  slot_date: string;
  complaint_summary?: string;
  status: "booked" | "arrived" | "in_progress" | "completed" | "no_show" | "cancelled";
  consultation_type: string;
  queue_number: number;
  booked_by: string;
  risk_level?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  /** When the patient physically arrived. Drives the real waiting-room clock. */
  arrived_at?: string | null;
  /** When the doctor started seeing them, which ends the wait. */
  consultation_started_at?: string | null;
}

/** Firestore returns Timestamps; the REST API returns ISO strings. */
function toIso(value: any): string | null {
  if (!value) return null;
  try {
    if (typeof value === "string") return value;
    if (value.toDate) return value.toDate().toISOString();
    if (value.seconds) return new Date(value.seconds * 1000).toISOString();
    if (value instanceof Date) return value.toISOString();
  } catch {
    /* fall through */
  }
  return null;
}

export function useAppointmentsToday() {
  const clinicId = useClinicStore((state) => state.clinicId);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFromApi = useCallback(async () => {
    if (!clinicId) return;
    try {
      const res = await api.get(`/appointments/today?clinic_id=${clinicId}`);
      setError(null);
      if (Array.isArray(res.data) && res.data.length > 0) {
        const docs: Appointment[] = res.data.map((d: any) => ({
          appointment_id: d.appointment_id || d.id,
          patient_id: d.patient_id,
          patient_name: d.patient_name || d.name || "Patient",
          patient_phone_masked: d.patient_phone_masked || d.phone_masked || "XXXX",
          slot_time_str: d.slot_time_str || "10:00 AM",
          slot_date: d.slot_date,
          complaint_summary: d.complaint_summary || "Consultation",
          status: d.status || "booked",
          consultation_type: d.consultation_type || "new",
          queue_number: d.queue_number || 1,
          booked_by: d.booked_by || "walk_in",
          risk_level: d.risk_level || undefined,
          arrived_at: toIso(d.arrived_at) || toIso(d.created_at),
          consultation_started_at: toIso(d.consultation_started_at),
        }));
        docs.sort((a, b) => a.queue_number - b.queue_number);
        setAppointments(docs);
      }
    } catch (e) {
      console.warn("useAppointmentsToday API fallback warning:", e);
      setError(apiErrorMessage(e, "load today's queue"));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId) {
      setLoading(false);
      return;
    }

    // Initial REST API fetch to ensure instant display
    fetchFromApi();

    const db = getFirestoreDb();
    if (!db) {
      console.warn("[useAppointmentsToday] Firestore not initialized.");
      setLoading(false);
      return;
    }

    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    const q = query(
      collection(db, "appointments"),
      where("clinic_id", "==", clinicId),
      where("slot_date", "==", todayStr)
    );

    // Real-time snapshot listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // A live snapshot supersedes any earlier REST failure.
      setError(null);
      const docs: Appointment[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        docs.push({
          appointment_id: doc.id,
          patient_id: d.patient_id,
          patient_name: d.patient_name || "Patient",
          patient_phone_masked: d.patient_phone_masked || "XXXX",
          slot_time_str: d.slot_time_str || "10:00 AM",
          slot_date: d.slot_date,
          complaint_summary: d.complaint_summary || "Consultation",
          status: d.status || "booked",
          consultation_type: d.consultation_type || "new",
          queue_number: d.queue_number || 1,
          booked_by: d.booked_by || "walk_in",
          risk_level: d.risk_level || undefined,
          arrived_at: toIso(d.arrived_at) || toIso(d.created_at),
          consultation_started_at: toIso(d.consultation_started_at),
        });
      });
      // Sort by queue_number
      docs.sort((a, b) => a.queue_number - b.queue_number);
      if (docs.length > 0) {
        setAppointments(docs);
      }
      setLoading(false);
    }, (err) => {
      console.warn("Appointments onSnapshot error:", err);
      // Only surface this if the REST fetch did not already populate the queue;
      // a dropped realtime listener with data on screen is not worth alarming
      // the doctor mid-consultation over.
      setAppointments((current) => {
        if (current.length === 0) {
          setError("Live queue updates are unavailable. Showing the last known state.");
        }
        return current;
      });
      setLoading(false);
    });

    const handleCreatedEvent = () => {
      fetchFromApi();
    };
    window.addEventListener("vaidyaai_appointment_created", handleCreatedEvent);

    return () => {
      unsubscribe();
      window.removeEventListener("vaidyaai_appointment_created", handleCreatedEvent);
    };
  }, [clinicId, fetchFromApi]);

  return { appointments, loading, error, refresh: fetchFromApi };
}
