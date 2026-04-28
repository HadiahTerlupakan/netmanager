import { clientLogger } from "@/lib/client-logger";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import type { Auth } from "firebase/auth";
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

const hasFirebaseBrowserConfig = Boolean(
  firebaseConfig?.apiKey && firebaseConfig?.projectId,
);

const app =
  isBrowserRuntime && hasFirebaseBrowserConfig
    ? !getApps().length
      ? initializeApp(firebaseConfig)
      : getApp()
    : undefined;

let auth: Auth | undefined = undefined;
let messaging: Messaging | undefined = undefined;

if (app) {
  try {
    auth = getAuth(app);
  } catch (error) {
    clientLogger.error("Firebase Auth Initialization Error:", error);
  }
}

if (app && "Notification" in window) {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    clientLogger.error("Firebase Messaging Initialization Error:", error);
  }
}

export { app, auth, messaging };
