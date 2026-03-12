import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

export function getMissingFirebasePublicEnvVars(): string[] {
  const missing: string[] = [];

  if (!firebaseConfig.apiKey) {
    missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  }
  if (!firebaseConfig.authDomain) {
    missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  }
  if (!firebaseConfig.projectId) {
    missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  }
  if (!firebaseConfig.appId) {
    missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");
  }

  return missing;
}

export function hasFirebaseConfig() {
  return getMissingFirebasePublicEnvVars().length === 0;
}

export function getFirebaseAuthClient(): Auth {
  if (typeof window === "undefined") {
    throw new Error("Firebase Auth is only available in the browser runtime.");
  }

  if (!hasFirebaseConfig()) {
    const missing = getMissingFirebasePublicEnvVars();
    throw new Error(
      `Missing Firebase public env vars: ${missing.join(", ")}. Check deployment environment variables.`,
    );
  }

  if (!cachedApp) {
    cachedApp = initializeApp(firebaseConfig);
  }

  if (!cachedAuth) {
    cachedAuth = getAuth(cachedApp);
  }

  return cachedAuth;
}
