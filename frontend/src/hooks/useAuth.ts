import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { firebaseAuth, firestore } from "../lib/firebase";
import { useClinicStore } from "../store/clinicStore";
import {
  setSessionCookie,
  clearSessionCookie,
  isDevAuthBypassEnabled,
  DEV_DOCTOR_USER,
  DEV_CLINIC_DATA,
  SESSION_COOKIE
} from "../lib/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setClinic = useClinicStore((state) => state.setClinic);
  const clearClinic = useClinicStore((state) => state.clearClinic);

  useEffect(() => {
    // Development-only Auth Bypass Mode
    if (isDevAuthBypassEnabled()) {
      const hasCookie = typeof document !== "undefined" && document.cookie.includes(SESSION_COOKIE);
      if (hasCookie) {
        setUser(DEV_DOCTOR_USER as unknown as User);
        setClinic(
          DEV_CLINIC_DATA.clinicId,
          DEV_CLINIC_DATA.doctorName,
          DEV_CLINIC_DATA.clinicName,
          DEV_CLINIC_DATA.role
        );
        setError(null);
      } else {
        setUser(null);
        clearClinic();
      }
      setLoading(false);
      return;
    }

    // Production Firebase Auth State Listener
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      setUser(currentUser);
      setError(null);
      if (currentUser) {
        try {
          // Fetch clinic mapping from clinic_users/{uid}
          const userDoc = await getDoc(doc(firestore, "clinic_users", currentUser.uid));
          if (userDoc.exists() && userDoc.data().clinic_id) {
            const data = userDoc.data();
            setClinic(
              data.clinic_id,
              data.doctor_name || "Doctor",
              data.clinic_name || "VaidyaAI Clinic",
              data.role || "doctor"
            );
            setSessionCookie();
          } else {
            // No clinic mapping found
            clearClinic();
            clearSessionCookie();
            setError("no_clinic");
          }
        } catch (e) {
          console.warn("Could not fetch user clinic mapping:", e);
          clearClinic();
          clearSessionCookie();
          setError("mapping_error");
        }
      } else {
        clearClinic();
        clearSessionCookie();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setClinic, clearClinic]);

  return { user, loading, error };
}
