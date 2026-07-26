import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { firebaseAuth, firestore } from "../lib/firebase";
import { useClinicStore } from "../store/clinicStore";
import { setSessionCookie, clearSessionCookie } from "../lib/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setClinic = useClinicStore((state) => state.setClinic);
  const clearClinic = useClinicStore((state) => state.clearClinic);

  useEffect(() => {
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
            // No clinic mapping: do NOT fall back to a shared demo tenant.
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
