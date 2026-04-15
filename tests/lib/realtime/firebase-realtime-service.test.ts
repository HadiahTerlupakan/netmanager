import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/realtime/channel-map", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/realtime/channel-map")
  >("@/lib/realtime/channel-map");

  return {
    ...actual,
    buildScopeChannel: vi.fn(actual.buildScopeChannel),
  };
});

vi.unmock("@/lib/websocket/emitter");

const addMock = vi.fn();
const setMock = vi.fn();
const sendEachForMulticastMock = vi.fn();
const refMock = vi.fn(() => ({ set: setMock }));
const collectionMock = vi.fn(() => ({ add: addMock }));

vi.mock("@/lib/firebase/admin", () => ({
  db: {
    collection: collectionMock,
  },
  realtimeDb: {
    ref: refMock,
  },
  messaging: {
    sendEachForMulticast: sendEachForMulticastMock,
  },
}));

describe("FirebaseRealtimeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve("ok"),
        } as Response),
      ),
    );
  });

  it("publishes a normalized envelope to the mapped Firestore stream", async () => {
    const { firebaseRealtimeService } = await import("@/lib/realtime");

    await firebaseRealtimeService.publish({
      type: "notification.new",
      scope: { kind: "user", id: "user-1" },
      payload: { title: "Hello" },
    });

    expect(collectionMock).toHaveBeenCalledWith("users/user-1/events");
    expect(addMock).toHaveBeenCalledTimes(1);
    expect(addMock.mock.calls[0]?.[0]).toMatchObject({
      type: "notification.new",
      scope: { kind: "user", id: "user-1" },
      payload: { title: "Hello" },
      version: 1,
    });
    expect(addMock.mock.calls[0]?.[0].id).toEqual(expect.any(String));
    expect(addMock.mock.calls[0]?.[0].createdAt).toEqual(expect.any(String));
  });

  it("routes socketEmitter notifyUser through Firebase publishing instead of HTTP fallback", async () => {
    const realtime = await import("@/lib/realtime");
    const publishSpy = vi.spyOn(realtime.firebaseRealtimeService, "publish");
    const { socketEmitter } = await import("@/lib/websocket/emitter");

    socketEmitter.notifyUser("user-1", {
      id: "notif-1",
      type: "INFO",
      priority: "HIGH",
      title: "Hello",
      message: "World",
      createdAt: "2026-04-09T00:00:00.000Z",
    });

    expect(publishSpy).toHaveBeenCalledWith({
      type: "notification.new",
      scope: { kind: "user", id: "user-1" },
      payload: {
        id: "notif-1",
        type: "INFO",
        priority: "HIGH",
        title: "Hello",
        message: "World",
        createdAt: "2026-04-09T00:00:00.000Z",
      },
    });
  });

  it("publishes admin scopes to a valid Firestore collection path", async () => {
    const { firebaseRealtimeService } = await import("@/lib/realtime");

    await firebaseRealtimeService.publish({
      type: "attendance.checkin",
      scope: { kind: "admin", id: "notifications" },
      payload: { attendanceId: "att-1" },
    });

    expect(collectionMock).toHaveBeenCalledWith("admins/notifications/events");
    expect(addMock).toHaveBeenCalledTimes(1);
  });

  it("throws before writing when the mapped Firestore collection path is invalid", async () => {
    const realtimeChannelMap = await import("@/lib/realtime/channel-map");
    const { firebaseRealtimeService } = await import("@/lib/realtime");

    vi.mocked(realtimeChannelMap.buildScopeChannel).mockReturnValueOnce(
      "admin/streams/notifications/events",
    );

    await expect(
      firebaseRealtimeService.publish({
        type: "attendance.checkin",
        scope: { kind: "admin", id: "notifications" },
        payload: { attendanceId: "att-2" },
      }),
    ).rejects.toThrow("Invalid Firestore collection path");

    expect(addMock).not.toHaveBeenCalled();
  });

  it("writes online presence snapshots into Realtime Database", async () => {
    const { firebaseRealtimeService } = await import("@/lib/realtime");

    await firebaseRealtimeService.setPresence({
      userId: "user-1",
      isOnline: true,
      source: "web",
    });

    expect(refMock).toHaveBeenCalledWith("presence/users/user-1");
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        isOnline: true,
        source: "web",
      }),
    );
  });

  it("delegates background push delivery through Firebase messaging", async () => {
    const { firebaseRealtimeService } = await import("@/lib/realtime");

    await firebaseRealtimeService.sendPush({
      tokens: ["token-1", "token-2"],
      title: "Hello",
      body: "World",
      data: { notificationId: "notif-1" },
    });

    expect(sendEachForMulticastMock).toHaveBeenCalledWith({
      tokens: ["token-1", "token-2"],
      notification: {
        title: "Hello",
        body: "World",
      },
      data: { notificationId: "notif-1" },
    });
  });
});
