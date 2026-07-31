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
 * Side-effect-free Proxies for backwards compatibility with existing imports.
 * Accessing properties on firebaseAuth or firestore lazily invokes getFirebaseAuth() / getFirestoreDb().
 * On the server side (typeof window === 'undefined'), returns undefined to ensure ZERO Firebase SDK calls occur during SSG.
 */
export const firebaseAuth = new Proxy({} as Auth, {
  get(_target, prop, receiver) {
    if (typeof window === "undefined") {
      return undefined;
    }
    const instance = getFirebaseAuth();
    if (!instance) return undefined;
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  }
});

export const firestore = new Proxy({} as Firestore, {
  get(_target, prop, receiver) {
    if (typeof window === "undefined") {
      return undefined;
    }
    const instance = getFirestoreDb();
    if (!instance) return undefined;
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  }
});

export default firebaseConfig;
