import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";
import type { Messaging } from "firebase/messaging";

import { getFirebaseBrowserConfig } from "@/lib/firebase/browserConfig";

const firebaseConfig = getFirebaseBrowserConfig();

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
