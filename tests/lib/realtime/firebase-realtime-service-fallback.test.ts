import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/admin", () => ({
  db: null,
  realtimeDb: null,
  messaging: null,
}));

describe("FirebaseRealtimeService fallback", () => {
  it("returns an envelope without writing to Firestore when db is unavailable", async () => {
    const { firebaseRealtimeService } = await import("@/lib/realtime");

    await expect(
      firebaseRealtimeService.publish({
        type: "notification.new",
        scope: { kind: "user", id: "user-1" },
        payload: { title: "Hello" },
      }),
    ).resolves.toMatchObject({
      type: "notification.new",
      scope: { kind: "user", id: "user-1" },
      payload: { title: "Hello" },
      version: 1,
    });
  });

  it("returns a presence snapshot without writing to Realtime Database when realtimeDb is unavailable", async () => {
    const { firebaseRealtimeService } = await import("@/lib/realtime");

    await expect(
      firebaseRealtimeService.setPresence({
        userId: "user-1",
        isOnline: true,
        source: "web",
      }),
    ).resolves.toMatchObject({
      userId: "user-1",
      isOnline: true,
      source: "web",
    });
  });

  it("returns null for background push delivery when messaging is unavailable", async () => {
    const { firebaseRealtimeService } = await import("@/lib/realtime");

    await expect(
      firebaseRealtimeService.sendPush({
        tokens: ["token-1"],
        title: "Hello",
        body: "World",
        data: { notificationId: "notif-1" },
      }),
    ).resolves.toBeNull();
  });
});
