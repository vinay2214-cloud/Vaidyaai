import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { firebaseAuth, firestore } from "../lib/firebase";
import { useClinicStore } from "../store/clinicStore";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const setClinic = useClinicStore((state) => state.setClinic);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          // Fetch clinic mapping from clinic_users/{uid}
          const userDoc = await getDoc(doc(firestore, "clinic_users", currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setClinic(
              data.clinic_id,
              data.doctor_name || "Doctor",
              data.clinic_name || "VaidyaAI Clinic",
              data.role || "doctor"
            );
          } else {
            // Demo fallback clinic for testing if user mapping not created yet
            setClinic("demo_clinic_id", "Dr. Ramesh", "Tirupati General Clinic", "doctor");
          }
        } catch (e) {
          console.warn("Could not fetch user clinic mapping:", e);
          setClinic("demo_clinic_id", "Dr. Ramesh", "Tirupati General Clinic", "doctor");
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setClinic]);

  return { user, loading };
}
