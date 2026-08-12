import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ""
};

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;

/**
 * Returns FirebaseApp instance ONLY on client-side (`typeof window !== 'undefined'`).
 * Returns null during server-side static rendering (SSG / SSR) to prevent premature Firebase initialization.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (!appInstance) {
    if (getApps().length > 0) {
      appInstance = getApp();
    } else {
      if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("YOUR_REAL")) {
        console.warn(
          "⚠️ [Firebase Notice] NEXT_PUBLIC_FIREBASE_API_KEY is unpopulated. Client authentication requires configured environment variables."
        );
      }
      appInstance = initializeApp(firebaseConfig);
    }
  }
  return appInstance;
}

/**
 * Returns Auth instance ONLY on client-side.
 * Returns null during SSG / SSR build prerendering.
 *
 * IMPORTANT: This returns a genuine Auth instance, not a Proxy.
 * Firebase Modular SDK v9+ functions (onAuthStateChanged, signInWithPhoneNumber)
 * perform internal instanceof checks. A Proxy wrapper fails these checks.
 */
export function getFirebaseAuth(): Auth | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (!authInstance) {
    const app = getFirebaseApp();
    if (!app) return null;
    authInstance = getAuth(app);

    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true") {
      const authHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST || "http://127.0.0.1:9099";
      try {
        if (!(authInstance as any)._emulatorConfig) {
          connectAuthEmulator(authInstance, authHost, { disableWarnings: true });
        }
      } catch (e) {
        console.warn("Firebase Auth emulator connection notice:", e);
      }
    }
  }
  return authInstance;
}

/**
 * Returns Firestore instance ONLY on client-side.
 * Returns null during SSG / SSR build prerendering.
 *
 * IMPORTANT: This returns a genuine Firestore instance, not a Proxy.
 * Firebase Modular SDK v9+ functions (doc, collection, getDoc, onSnapshot)
 * perform internal instanceof checks. A Proxy wrapper fails these checks.
 */
export function getFirestoreDb(): Firestore | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (!firestoreInstance) {
    const app = getFirebaseApp();
    if (!app) return null;
    firestoreInstance = getFirestore(app);

    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true") {
      const firestoreHost = process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST || "127.0.0.1";
      const firestorePort = parseInt(process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT || "8181", 10);
      try {
        if (!(firestoreInstance as any)._settings?.host) {
          connectFirestoreEmulator(firestoreInstance, firestoreHost, firestorePort);
        }
      } catch (e) {
        console.warn("Firestore emulator connection notice:", e);
      }
    }
  }
  return firestoreInstance;
}

/**
 * DEPRECATED convenience aliases.
 *
 * These exist solely for backwards-compatible import syntax:
 *   import { firebaseAuth, firestore } from "../lib/firebase";
 *
 * They are evaluated at module load time. During SSR (typeof window === "undefined")
 * they will be null. During client-side hydration they will be genuine instances.
 *
 * All consumer code MUST guard against null by calling getFirebaseAuth() / getFirestoreDb()
 * at the point of use instead of relying on these module-level values.
 */
export const firebaseAuth = (typeof window !== "undefined" ? getFirebaseAuth() : null) as Auth;
export const firestore = (typeof window !== "undefined" ? getFirestoreDb() : null) as Firestore;

export default firebaseConfig;
