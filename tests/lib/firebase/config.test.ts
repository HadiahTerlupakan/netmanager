import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const initializeAppMock = vi.fn();
const getAppsMock = vi.fn();
const getAppMock = vi.fn();
const getMessagingMock = vi.fn();
const consoleWarnMock = vi.fn();

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
    consoleWarnMock.mockReset();
    vi.stubGlobal("console", {
      ...console,
      warn: consoleWarnMock,
    });
    getAppsMock.mockReturnValue([]);
    initializeAppMock.mockReturnValue({ name: "firebase-app" });
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("falls back to bundled firebase web config when env values are null-like", async () => {
    vi.stubGlobal("window", { Notification: {} });
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

  it("prefers explicit database URL from env over the bundled default", async () => {
    vi.stubGlobal("window", { Notification: {} });
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "env-api-key";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "env-auth-domain";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "env-project-id";
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL =
      "https://env-project-default-rtdb.firebaseio.com";
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "env-storage-bucket";
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "env-sender-id";
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "env-app-id";
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "public-vapid-key";

    await import("@/lib/firebase/config");

    expect(initializeAppMock).toHaveBeenCalledWith({
      apiKey: "env-api-key",
      authDomain: "env-auth-domain",
      databaseURL: "https://env-project-default-rtdb.firebaseio.com",
      projectId: "env-project-id",
      storageBucket: "env-storage-bucket",
      messagingSenderId: "env-sender-id",
      appId: "env-app-id",
    });
  });

  it("warns when browser runtime in production uses bundled firebase defaults", async () => {
    vi.stubGlobal("window", { Notification: {} });
    process.env = {
      ...process.env,
      NODE_ENV: "production",
    };
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "";
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL = "";
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "";
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "";
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "";
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "public-vapid-key";

    await import("@/lib/firebase/config");

    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringContaining("Using bundled Firebase browser config defaults"),
    );
  });

  it("does not initialize browser firebase config on server runtime", async () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
    };
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "";
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL = "";
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "";
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "";
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "";
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "public-vapid-key";

    const firebaseConfigModule = await import("@/lib/firebase/config");

    expect(firebaseConfigModule.isFirebaseMessagingConfigured).toBe(false);
    expect(initializeAppMock).not.toHaveBeenCalled();
    expect(consoleWarnMock).not.toHaveBeenCalled();
  });
});
