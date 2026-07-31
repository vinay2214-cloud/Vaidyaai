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

// Singleton initialization for Next.js 14 Fast Refresh resilience
function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }

  if (typeof window !== "undefined" && (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("YOUR_REAL"))) {
    console.error(
      "❌ [Firebase Initialization Error] NEXT_PUBLIC_FIREBASE_API_KEY is unset or unpopulated in frontend/.env.local.\n" +
      "Please set your real Firebase Web App credentials in frontend/.env.local from the Firebase Console."
    );
  }

  return initializeApp(firebaseConfig);
}

const app: FirebaseApp = getFirebaseApp();
export const firebaseAuth: Auth = getAuth(app);
export const firestore: Firestore = getFirestore(app);

// Connect Local Firebase Emulators if explicitly enabled in environment
if (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true"
) {
  const authHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST || "http://127.0.0.1:9099";
  const firestoreHost = process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST || "127.0.0.1";
  const firestorePort = parseInt(process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT || "8181", 10);

  try {
    if (!(firebaseAuth as any)._emulatorConfig) {
      connectAuthEmulator(firebaseAuth, authHost, { disableWarnings: true });
    }
    if (!(firestore as any)._settings?.host) {
      connectFirestoreEmulator(firestore, firestoreHost, firestorePort);
    }
  } catch (e) {
    console.warn("Firebase emulator connection notice:", e);
  }
}

export default app;
