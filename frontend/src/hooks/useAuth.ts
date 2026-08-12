import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirestoreDb } from "../lib/firebase";
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
      
      let isMounted = true;
      const timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn("[useAuth] Dev bootstrap timed out, applying immediate local fallback.");
          setClinic(
            DEV_CLINIC_DATA.clinicId,
            DEV_CLINIC_DATA.doctorName,
            DEV_CLINIC_DATA.clinicName,
            DEV_CLINIC_DATA.role
          );
          setSessionCookie();
          setError(null);
          setLoading(false);
        }
      }, 2500);

      DevBootstrapService.ensureClinicMapping(DEV_DOCTOR_USER.uid)
        .then((mapping) => {
          if (!isMounted) return;
          clearTimeout(timeoutId);
          setClinic(mapping.clinic_id, mapping.doctor_name, mapping.clinic_name, mapping.role);
          setSessionCookie();
          setError(null);
          setLoading(false);
        })
        .catch((err) => {
          if (!isMounted) return;
          clearTimeout(timeoutId);
          console.warn("[useAuth] Dev auth provision warning:", err?.message || err);

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

      return () => {
        isMounted = false;
        clearTimeout(timeoutId);
      };
    }

    // 2. Production / Real Firebase Auth State Listener
    const auth = getFirebaseAuth();
    if (!auth) {
      console.warn("[useAuth] Firebase Auth not initialized (SSR context). Skipping listener.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setError(null);

      if (currentUser) {
        try {
          const db = getFirestoreDb();
          if (!db) {
            throw new Error("Firestore not initialized");
          }

          const userDocRef = doc(db, "clinic_users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);

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
          } else {
            const mapping = await DevBootstrapService.ensureClinicMapping(currentUser.uid);
            try {
              await currentUser.getIdToken(true);
            } catch (tokenErr) {
              console.warn("[useAuth] ID token refresh notice:", tokenErr);
            }
            setClinic(mapping.clinic_id, mapping.doctor_name, mapping.clinic_name, mapping.role);
            setSessionCookie();
            setError(null);
          }
        } catch (e: any) {
          console.group("AUTH NOTICE");
          console.warn("Resolving clinic mapping fallback:", e?.message || e);
          console.groupEnd();

          try {
            const mapping = await DevBootstrapService.ensureClinicMapping(currentUser.uid);
            try {
              await currentUser.getIdToken(true);
            } catch (tokenErr) {
              console.warn("[useAuth] ID token refresh notice:", tokenErr);
            }
            setClinic(mapping.clinic_id, mapping.doctor_name, mapping.clinic_name, mapping.role);
            setSessionCookie();
            setError(null);
          } catch (bootstrapErr) {
            setSessionCookie();
            setError("no_clinic");
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
