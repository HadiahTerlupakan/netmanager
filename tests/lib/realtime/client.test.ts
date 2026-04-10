import { beforeEach, describe, expect, it, vi } from "vitest";

const getFirestoreMock = vi.fn();
const getDatabaseMock = vi.fn();

describe("getRealtimeClientServices", () => {
  beforeEach(() => {
    vi.resetModules();
    getFirestoreMock.mockReset();
    getDatabaseMock.mockReset();
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
});
