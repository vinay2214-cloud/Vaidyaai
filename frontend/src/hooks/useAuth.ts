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
import { DevBootstrapService, NO_CLINIC_MAPPING } from "../services/devBootstrap";

/**
 * Upper bound on any single startup dependency (Firestore read, ID-token
 * refresh). Firestore's getDoc does not reject when the SDK cannot reach the
 * backend — it simply never settles — and every await here sits between the
 * user landing on the app and `loading` being cleared. Without a bound, one
 * unreachable dependency pins the whole workspace on its loading spinner.
 */
const STARTUP_DEPENDENCY_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${STARTUP_DEPENDENCY_TIMEOUT_MS}ms`)),
        STARTUP_DEPENDENCY_TIMEOUT_MS
      )
    )
  ]);
}

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

      try {
        if (currentUser) {
          try {
            const db = getFirestoreDb();
            if (!db) {
              throw new Error("Firestore not initialized");
            }

            const userDocRef = doc(db, "clinic_users", currentUser.uid);
            const userDoc = await withTimeout(getDoc(userDocRef), "clinic_users read");

            if (userDoc.exists() && userDoc.data()?.clinic_id) {
              const data = userDoc.data();

              // A server-side mapping exists. If the ID token this browser holds does
              // not yet carry the matching clinic_id custom claim (claims set by the
              // Admin SDK never retro-update an issued token), force a refresh.
              // Firestore security rules compare resource.data.clinic_id against
              // request.auth.token.clinic_id, so a stale token silently breaks every
              // realtime listener even though REST calls still work.
              try {
                const tokenResult = await withTimeout(
                  currentUser.getIdTokenResult(),
                  "ID token read"
                );
                if (tokenResult?.claims?.clinic_id !== data.clinic_id) {
                  await withTimeout(currentUser.getIdToken(true), "ID token refresh");
                }
              } catch (tokenErr) {
                console.warn("[useAuth] Claim reconciliation notice:", tokenErr);
              }

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
                await withTimeout(currentUser.getIdToken(true), "ID token refresh");
              } catch (tokenErr) {
                console.warn("[useAuth] ID token refresh notice:", tokenErr);
              }
              if (!mapping.clinic_id) {
                // Authenticated but no clinic mapping -> authorization error, not a
                // silent dev-clinic grant. Preserve the Firebase session.
                clearClinic();
                setError("no_clinic");
              } else {
                setClinic(mapping.clinic_id, mapping.doctor_name, mapping.clinic_name, mapping.role);
                setSessionCookie();
                setError(null);
              }
            }
          } catch (e: any) {
            console.group("AUTH NOTICE");
            console.warn("Resolving clinic mapping fallback:", e?.message || e);
            console.groupEnd();

            try {
              const mapping = await DevBootstrapService.ensureClinicMapping(currentUser.uid);
              try {
                await withTimeout(currentUser.getIdToken(true), "ID token refresh");
              } catch (tokenErr) {
                console.warn("[useAuth] ID token refresh notice:", tokenErr);
              }
              if (!mapping.clinic_id) {
                clearClinic();
                setError("no_clinic");
              } else {
                setClinic(mapping.clinic_id, mapping.doctor_name, mapping.clinic_name, mapping.role);
                setSessionCookie();
                setError(null);
              }
            } catch (bootstrapErr) {
              clearClinic();
              setError("no_clinic");
            }
          }
        } else {
          clearClinic();
          clearSessionCookie();
        }
      } finally {
        // Unconditional: `loading` gates the workspace's spinner, so leaving it
        // set on any unexpected path is the difference between a visible error
        // and an app that appears to hang forever.
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setClinic, clearClinic]);

  return { user, loading, error };
}
