import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  Auth,
  User
} from "firebase/auth";
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
 * Resolves once Firebase Auth has finished restoring any persisted session and
 * the *initial* auth state is known. Created exactly once per auth instance.
 *
 * WHY THIS EXISTS:
 * `auth.currentUser` is `null` during the brief window between page load and the
 * completion of the IndexedDB persistence restore. Code that reads
 * `auth.currentUser` synchronously on mount therefore sees "not signed in" even
 * for a perfectly valid session. That produced requests with no Authorization
 * header, which the backend correctly rejected with 401, which in turn tripped
 * the axios interceptor into signing the user out and bouncing them to /login.
 *
 * Always await this before concluding that no user is signed in.
 */
let authReadyPromise: Promise<User | null> | null = null;
let persistencePromise: Promise<void> | null = null;

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

    // Explicitly pin persistence to browserLocalPersistence (IndexedDB/localStorage)
    // so a verified session survives a full page reload deterministically instead
    // of depending on the SDK's default persistence resolution order.
    persistencePromise = setPersistence(authInstance, browserLocalPersistence).catch(
      (e) => {
        console.warn("[Firebase] Could not set browserLocalPersistence:", e);
      }
    );

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

/**
 * Wait until Firebase Auth has restored any persisted session, then resolve with
 * the current user (or null if genuinely signed out).
 *
 * This is the ONLY safe way to ask "is someone signed in?" during app startup.
 * Reading `auth.currentUser` directly races the persistence restore.
 *
 * Resolves null immediately during SSR.
 */
export function waitForAuthReady(): Promise<User | null> {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }
  const auth = getFirebaseAuth();
  if (!auth) {
    return Promise.resolve(null);
  }
  if (!authReadyPromise) {
    authReadyPromise = (async () => {
      // Ensure the persistence layer is configured before reading auth state.
      try {
        if (persistencePromise) await persistencePromise;
      } catch {
        /* persistence failures are already logged; continue */
      }
      return await new Promise<User | null>((resolve) => {
        const unsubscribe = onAuthStateChanged(
          auth,
          (user) => {
            unsubscribe();
            resolve(user);
          },
          (err) => {
            console.warn("[Firebase] auth state resolution error:", err);
            unsubscribe();
            resolve(null);
          }
        );
      });
    })();
  }
  return authReadyPromise;
}

/**
 * Returns the signed-in user AFTER waiting for the persistence restore to finish.
 * Prefer this over `getFirebaseAuth()?.currentUser` anywhere correctness matters.
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  await waitForAuthReady();
  return getFirebaseAuth()?.currentUser ?? null;
}

/**
 * Wait until a NON-NULL user is observed on the auth instance, up to `timeoutMs`.
 *
 * Used immediately after a sign-in completes. waitForAuthReady() caches the first
 * observed state (which on the login page is null, pre-sign-in), so it cannot be
 * reused to detect the freshly signed-in user. This subscribes fresh and resolves
 * as soon as the SDK reports a user, which is also the point at which the session
 * has been committed to the persistence layer.
 *
 * Resolves null on timeout rather than hanging the sign-in UI.
 */
export function waitForSignedInUser(timeoutMs: number = 8000): Promise<User | null> {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }
  const auth = getFirebaseAuth();
  if (!auth) {
    return Promise.resolve(null);
  }
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }
  return new Promise<User | null>((resolve) => {
    let settled = false;
    const finish = (user: User | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(user);
    };
    const timer = setTimeout(() => finish(auth.currentUser ?? null), timeoutMs);
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (user) finish(user);
      },
      (err) => {
        console.warn("[Firebase] sign-in state resolution error:", err);
        finish(null);
      }
    );
  });
}

export default firebaseConfig;
