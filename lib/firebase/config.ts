import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";
import type { Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseMessagingConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
);

const app = isFirebaseMessagingConfigured
  ? !getApps().length
    ? initializeApp(firebaseConfig)
    : getApp()
  : undefined;

let messaging: Messaging | undefined = undefined;

if (app && typeof window !== "undefined" && "Notification" in window) {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.error("Firebase Messaging Initialization Error:", error);
  }
}

export { app, messaging };
