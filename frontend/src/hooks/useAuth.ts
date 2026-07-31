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
  DEV_CLINIC_DATA
} from "../lib/auth";
import { DevBootstrapService } from "../services/devBootstrap";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setClinic = useClinicStore((state) => state.setClinic);
  const clearClinic = useClinicStore((state) => state.clearClinic);

  useEffect(() => {
    // 1. Development Auth Bypass Mode (NEXT_PUBLIC_DEV_AUTH_BYPASS === true)
    if (isDevAuthBypassEnabled()) {
      setUser(DEV_DOCTOR_USER as unknown as User);
      DevBootstrapService.ensureClinicMapping(DEV_DOCTOR_USER.uid)
        .then((mapping) => {
          setClinic(mapping.clinic_id, mapping.doctor_name, mapping.clinic_name, mapping.role);
          setSessionCookie();
          setError(null);
          setLoading(false);
        })
        .catch(() => {
          setClinic(
            DEV_CLINIC_DATA.clinicId,
            DEV_CLINIC_DATA.doctorName,
            DEV_CLINIC_DATA.clinicName,
            DEV_CLINIC_DATA.role
          );
          setSessionCookie();
          setError(null);
          setLoading(false);
        });
      return;
    }

    // 2. Production / Real Firebase Auth State Listener
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      setUser(currentUser);
      setError(null);

      if (currentUser) {
        try {
          // Fetch clinic mapping from clinic_users/{uid}
          const userDoc = await getDoc(doc(firestore, "clinic_users", currentUser.uid));
          if (userDoc.exists() && userDoc.data()?.clinic_id) {
            const data = userDoc.data();
            setClinic(
              data.clinic_id,
              data.doctor_name || "Doctor",
              data.clinic_name || "VaidyaAI Clinic",
              data.role || "doctor"
            );
            setSessionCookie();
            setError(null);
          } else if (isDevAuthBypassEnabled()) {
            // Feature flag enabled: Auto-provision Firestore document via DevBootstrapService
            const mapping = await DevBootstrapService.ensureClinicMapping(currentUser.uid);
            setClinic(mapping.clinic_id, mapping.doctor_name, mapping.clinic_name, mapping.role);
            setSessionCookie();
            setError(null);
          } else {
            // Production behavior (NEXT_PUBLIC_DEV_AUTH_BYPASS=false):
            // Un-onboarded users are directed to complete clinic setup
            clearClinic();
            clearSessionCookie();
            setError("no_clinic");
          }
        } catch (e) {
          console.warn("Could not fetch user clinic mapping:", e);
          if (isDevAuthBypassEnabled()) {
            const mapping = await DevBootstrapService.ensureClinicMapping(currentUser.uid);
            setClinic(mapping.clinic_id, mapping.doctor_name, mapping.clinic_name, mapping.role);
            setSessionCookie();
            setError(null);
          } else {
            clearClinic();
            clearSessionCookie();
            setError("mapping_error");
          }
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
