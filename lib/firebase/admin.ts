import type { App } from "firebase-admin/app";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function hasServiceAccountConfig(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY,
  );
}

function initializeFirebaseAdmin(): App | null {
  if (getApps().length > 0) {
    return getApp();
  }

  if (!hasServiceAccountConfig()) {
    return null;
  }

  try {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  } catch (error) {
    console.error("Firebase admin initialization error", error);
    return null;
  }
}

export const firebaseAdminApp = initializeFirebaseAdmin();
export const auth = firebaseAdminApp ? getAuth(firebaseAdminApp) : null;
export const messaging = firebaseAdminApp
  ? getMessaging(firebaseAdminApp)
  : null;
export const db = firebaseAdminApp ? getFirestore(firebaseAdminApp) : null;
export const realtimeDb =
  firebaseAdminApp && process.env.FIREBASE_DATABASE_URL
    ? getDatabase(firebaseAdminApp)
    : null;
