import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";
import type { Messaging } from "firebase/messaging";

import { getFirebaseBrowserConfig } from "@/lib/firebase/browserConfig";

const isBrowserRuntime = typeof window !== "undefined";

const firebaseConfig = isBrowserRuntime
  ? getFirebaseBrowserConfig()
  : undefined;

export const isFirebaseMessagingConfigured = Boolean(
  firebaseConfig?.apiKey &&
  firebaseConfig?.projectId &&
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
);

const app =
  isBrowserRuntime && isFirebaseMessagingConfigured
    ? !getApps().length
      ? initializeApp(firebaseConfig)
      : getApp()
    : undefined;

let messaging: Messaging | undefined = undefined;

if (app && "Notification" in window) {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.error("Firebase Messaging Initialization Error:", error);
  }
}

export { app, messaging };
