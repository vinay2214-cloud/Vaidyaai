import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "./firebase";
import { useClinicStore } from "../store/clinicStore";

export const SESSION_COOKIE = "vaidyaai_session";

/**
 * Feature flag check for development-only authentication bypass.
 * STRICTLY disabled in production builds (NODE_ENV === "production").
 */
export const isDevAuthBypassEnabled = (): boolean => {
  const isDev = process.env.NODE_ENV !== "production";
  const isLocalhost = typeof window !== "undefined" && window.location.hostname === "localhost";
  const flag = String(process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS || "").toLowerCase().trim();
  return isDev && isLocalhost && (flag === "true" || flag === "1" || flag === "yes");
};

export const DEV_DOCTOR_USER = {
  uid: "dev_doctor_001",
  phoneNumber: "+919876543210",
  displayName: "Dr. Ramesh (Dev)",
  email: "dr.ramesh.dev@vaidyaai.local",
  isAnonymous: false,
  emailVerified: true,
  metadata: {},
  providerData: [],
  refreshToken: "dev_token",
  tenantId: null,
  delete: async () => {},
  getIdToken: async () => "dev_mock_id_token",
  getIdTokenResult: async () => ({} as any),
  reload: async () => {},
  toJSON: () => ({})
};

export const DEV_CLINIC_DATA = {
  clinicId: "cln_e2e_test_clinic",
  doctorName: "Dr. Ramesh",
  clinicName: "Tirupati General Clinic",
  role: "doctor"
};

function cookieAttributes(): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  return `; path=/; SameSite=Lax${secure}`;
}

export function setSessionCookie() {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 7; // 7 days in seconds
  document.cookie = `${SESSION_COOKIE}=1; Max-Age=${maxAge}${cookieAttributes()}`;
}

export function clearSessionCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=; path=/; Max-Age=0${cookieAttributes()}`;
}

export async function logout(redirectTo: string = "/login") {
  try {
    if (!isDevAuthBypassEnabled()) {
      const auth = getFirebaseAuth();
      if (auth) await signOut(auth);
    }
  } catch (e) {
    console.warn("Sign-out error:", e);
  }
  useClinicStore.getState().clearClinic();
  clearSessionCookie();
  if (typeof window !== "undefined") {
    window.location.assign(redirectTo);
  }
}
