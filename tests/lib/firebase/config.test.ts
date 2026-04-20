import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const initializeAppMock = vi.fn();
const getAppsMock = vi.fn();
const getAppMock = vi.fn();
const getMessagingMock = vi.fn();

vi.mock("firebase/app", () => ({
  initializeApp: (...args: unknown[]) => initializeAppMock(...args),
  getApps: (...args: unknown[]) => getAppsMock(...args),
  getApp: (...args: unknown[]) => getAppMock(...args),
}));

vi.mock("firebase/messaging", () => ({
  getMessaging: (...args: unknown[]) => getMessagingMock(...args),
}));

describe("firebase browser config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    initializeAppMock.mockReset();
    getAppsMock.mockReset();
    getAppMock.mockReset();
    getMessagingMock.mockReset();
    getAppsMock.mockReturnValue([]);
    initializeAppMock.mockReturnValue({ name: "firebase-app" });
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("falls back to bundled firebase web config when env values are null-like", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "null";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "undefined";
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL = "   ";
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "null";
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "";
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "undefined";
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "public-vapid-key";

    const firebaseConfigModule = await import("@/lib/firebase/config");

    expect(firebaseConfigModule.isFirebaseMessagingConfigured).toBe(true);
    expect(initializeAppMock).toHaveBeenCalledWith({
      apiKey: "AIzaSyDihrl023fOQnXf8oZ7A2rU7YxzJzQN5Lc",
      authDomain: "netmanager-96742.firebaseapp.com",
      databaseURL:
        "https://netmanager-96742-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "netmanager-96742",
      storageBucket: "netmanager-96742.firebasestorage.app",
      messagingSenderId: "43187781340",
      appId: "1:43187781340:web:461fc10875b35538e67e19",
    });
  });
});
