import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { firestore } from "../lib/firebase";
import { useClinicStore } from "../store/clinicStore";

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
}

export function useAppointmentsToday() {
  const clinicId = useClinicStore((state) => state.clinicId);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId) {
      setLoading(false);
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const q = query(
      collection(firestore, "appointments"),
      where("clinic_id", "==", clinicId),
      where("slot_date", "==", todayStr)
    );

    // Real-time snapshot listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
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
          booked_by: d.booked_by || "whatsapp_agent"
        });
      });
      // Sort by queue_number
      docs.sort((a, b) => a.queue_number - b.queue_number);
      setAppointments(docs);
      setLoading(false);
    }, (error) => {
      console.warn("Appointments onSnapshot error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [clinicId]);

  return { appointments, loading };
}
