import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getAppsMock = vi.fn(() => []);
const getAppMock = vi.fn();
const initializeAppMock = vi.fn();
const getAuthMock = vi.fn(() => ({ kind: "auth" }));
const getMessagingMock = vi.fn(() => ({ kind: "messaging" }));
const getFirestoreMock = vi.fn(() => ({ kind: "firestore" }));
const getDatabaseMock = vi.fn(() => ({ kind: "database" }));
const certMock = vi.fn();

vi.mock("firebase-admin/app", () => ({
  getApps: getAppsMock,
  getApp: getAppMock,
  initializeApp: initializeAppMock,
  cert: certMock,
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: getAuthMock,
}));

vi.mock("firebase-admin/messaging", () => ({
  getMessaging: getMessagingMock,
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: getFirestoreMock,
}));

vi.mock("firebase-admin/database", () => ({
  getDatabase: getDatabaseMock,
}));

describe("firebase admin bootstrap", () => {
  const envBackup = { ...process.env };
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getAppsMock.mockReturnValue([]);
    process.env = { ...envBackup };
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    delete process.env.FIREBASE_DATABASE_URL;
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("does not initialize firebase admin when config is missing", async () => {
    await import("@/lib/firebase/admin");

    expect(certMock).not.toHaveBeenCalled();
    expect(initializeAppMock).not.toHaveBeenCalled();
    expect(getAppMock).not.toHaveBeenCalled();
    expect(getAuthMock).not.toHaveBeenCalled();
    expect(getMessagingMock).not.toHaveBeenCalled();
    expect(getFirestoreMock).not.toHaveBeenCalled();
    expect(getDatabaseMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("does not call getApp when initializeApp throws because config is invalid", async () => {
    process.env.FIREBASE_PROJECT_ID = "demo-project";
    process.env.FIREBASE_CLIENT_EMAIL = "firebase-adminsdk@example.com";
    process.env.FIREBASE_PRIVATE_KEY = "private-key";
    initializeAppMock.mockImplementation(() => {
      throw new Error("invalid credential");
    });

    await import("@/lib/firebase/admin");

    expect(certMock).toHaveBeenCalledWith({
      projectId: "demo-project",
      clientEmail: "firebase-adminsdk@example.com",
      privateKey: "private-key",
    });
    expect(initializeAppMock).toHaveBeenCalledTimes(1);
    expect(getAppMock).not.toHaveBeenCalled();
    expect(getAuthMock).not.toHaveBeenCalled();
    expect(getMessagingMock).not.toHaveBeenCalled();
    expect(getFirestoreMock).not.toHaveBeenCalled();
    expect(getDatabaseMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Firebase admin initialization error",
      expect.any(Error),
    );
  });

  it("skips realtime database bootstrap when database url is missing", async () => {
    process.env.FIREBASE_PROJECT_ID = "demo-project";
    process.env.FIREBASE_CLIENT_EMAIL = "firebase-adminsdk@example.com";
    process.env.FIREBASE_PRIVATE_KEY = "private-key";
    const existingApp = { name: "[DEFAULT]" };
    initializeAppMock.mockReturnValue(existingApp);

    const firebaseAdminModule = await import("@/lib/firebase/admin");

    expect(certMock).toHaveBeenCalledWith({
      projectId: "demo-project",
      clientEmail: "firebase-adminsdk@example.com",
      privateKey: "private-key",
    });
    expect(initializeAppMock).toHaveBeenCalledTimes(1);
    expect(firebaseAdminModule.firebaseAdminApp).toBe(existingApp);
    expect(getAuthMock).toHaveBeenCalledWith(existingApp);
    expect(getMessagingMock).toHaveBeenCalledWith(existingApp);
    expect(getFirestoreMock).toHaveBeenCalledWith(existingApp);
    expect(getDatabaseMock).not.toHaveBeenCalled();
    expect(firebaseAdminModule.realtimeDb).toBeNull();
  });

  it("reuses an existing firebase app when one is already initialized", async () => {
    const existingApp = { name: "[DEFAULT]" };
    getAppsMock.mockReturnValue([existingApp]);
    getAppMock.mockReturnValue(existingApp);
    process.env.FIREBASE_DATABASE_URL =
      "https://demo-project-default-rtdb.firebaseio.com";

    const firebaseAdminModule = await import("@/lib/firebase/admin");

    expect(getAppsMock).toHaveBeenCalledTimes(1);
    expect(getAppMock).toHaveBeenCalledTimes(1);
    expect(initializeAppMock).not.toHaveBeenCalled();
    expect(firebaseAdminModule.firebaseAdminApp).toBe(existingApp);
    expect(getAuthMock).toHaveBeenCalledWith(existingApp);
    expect(getMessagingMock).toHaveBeenCalledWith(existingApp);
    expect(getFirestoreMock).toHaveBeenCalledWith(existingApp);
    expect(getDatabaseMock).toHaveBeenCalledWith(existingApp);
  });
});
