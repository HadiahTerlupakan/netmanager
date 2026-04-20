import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getFirestoreMock = vi.fn();
const getDatabaseMock = vi.fn();
const consoleWarnMock = vi.fn();

describe("getRealtimeClientServices", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    getFirestoreMock.mockReset();
    getDatabaseMock.mockReset();
    consoleWarnMock.mockReset();
    vi.stubGlobal("console", {
      ...console,
      warn: consoleWarnMock,
    });
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("returns null services when the shared Firebase app is unavailable", async () => {
    vi.doMock("@/lib/firebase/config", () => ({
      app: undefined,
    }));

    vi.doMock("firebase/firestore", () => ({
      getFirestore: getFirestoreMock,
    }));

    vi.doMock("firebase/database", () => ({
      getDatabase: getDatabaseMock,
    }));

    const { getRealtimeClientServices } = await import("@/lib/realtime/client");

    expect(getRealtimeClientServices()).toEqual({
      firebaseApp: undefined,
      firestore: null,
      realtimeDatabase: null,
    });
    expect(getFirestoreMock).not.toHaveBeenCalled();
    expect(getDatabaseMock).not.toHaveBeenCalled();
  });

  it("builds Firestore and Realtime Database clients from the shared Firebase app", async () => {
    const firebaseApp = { name: "shared-app" };
    const firestore = { kind: "firestore" };
    const realtimeDatabase = { kind: "database" };

    getFirestoreMock.mockReturnValue(firestore);
    getDatabaseMock.mockReturnValue(realtimeDatabase);

    vi.doMock("@/lib/firebase/config", () => ({
      app: firebaseApp,
    }));

    vi.doMock("firebase/firestore", () => ({
      getFirestore: getFirestoreMock,
    }));

    vi.doMock("firebase/database", () => ({
      getDatabase: getDatabaseMock,
    }));

    const { getRealtimeClientServices } = await import("@/lib/realtime/client");

    expect(getRealtimeClientServices()).toEqual({
      firebaseApp,
      firestore,
      realtimeDatabase,
    });
    expect(getFirestoreMock).toHaveBeenCalledWith(firebaseApp);
    expect(getDatabaseMock).toHaveBeenCalledWith(firebaseApp);
  });

  it("does not trigger Firebase browser warning when imported on server runtime", async () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      NEXT_PUBLIC_FIREBASE_API_KEY: "",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "",
      NEXT_PUBLIC_FIREBASE_DATABASE_URL: "",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "",
      NEXT_PUBLIC_FIREBASE_APP_ID: "",
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-vapid-key",
    };

    vi.doUnmock("@/lib/firebase/config");
    vi.doMock("firebase/firestore", () => ({
      getFirestore: getFirestoreMock,
    }));
    vi.doMock("firebase/database", () => ({
      getDatabase: getDatabaseMock,
    }));

    const { getRealtimeClientServices } = await import("@/lib/realtime/client");

    expect(getRealtimeClientServices()).toEqual({
      firebaseApp: undefined,
      firestore: null,
      realtimeDatabase: null,
    });
    expect(consoleWarnMock).not.toHaveBeenCalled();
    expect(getFirestoreMock).not.toHaveBeenCalled();
    expect(getDatabaseMock).not.toHaveBeenCalled();
  });
});
