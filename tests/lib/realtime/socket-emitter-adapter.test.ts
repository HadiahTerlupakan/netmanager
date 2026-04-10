import { beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("@/lib/websocket/emitter");

const mockFns = vi.hoisted(() => ({
  publish: vi.fn().mockResolvedValue(undefined),
  getSocketServer: vi.fn(() => null),
}));

vi.mock("@/lib/realtime", () => ({
  firebaseRealtimeService: {
    publish: mockFns.publish,
  },
  LEGACY_TO_REALTIME_EVENT: {
    "notification:new": "notification.new",
    "notification:count": "notification.count",
    "ticket:new": "ticket.new",
    "ticket:update": "ticket.update",
    "ticket:reply": "ticket.reply",
    "ticket:message": "ticket.message",
    "ticket:count": "ticket.count",
    "workorder:new": "workorder.new",
    "workorder:update": "workorder.update",
    "workorder:assigned": "workorder.assigned",
    "workorder:activity": "workorder.activity",
    "inventory:update": "inventory.update",
    "chat:message": "chat.message",
    "profile:refresh": "profile.refresh",
    "partner:invitation": "partner.invitation",
    "partner:response": "partner.response",
    "session:forceLogout": "session.force_logout",
    "user:status": "user.status",
    "user:permissions_update": "user.permissions_update",
    "admin:location:update": "admin.location.update",
  },
}));

vi.mock("@/lib/websocket/server", () => ({
  getSocketServer: mockFns.getSocketServer,
}));

describe("socketEmitter Firebase adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes notifyUser through FirebaseRealtimeService", async () => {
    const { socketEmitter } = await import("@/lib/websocket/emitter");

    socketEmitter.notifyUser("user-1", {
      id: "notif-1",
      type: "INFO",
      priority: "HIGH",
      title: "Hello",
      message: "World",
      createdAt: "2026-04-09T00:00:00.000Z",
    });

    expect(mockFns.publish).toHaveBeenCalledWith({
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

  it("publishes notifyAdmins into the site-scoped admin stream", async () => {
    const { socketEmitter } = await import("@/lib/websocket/emitter");

    socketEmitter.notifyAdmins(
      {
        id: "notif-2",
        type: "INFO",
        priority: "LOW",
        title: "Admin hello",
        message: "For site admins",
        createdAt: "2026-04-09T00:00:00.000Z",
      },
      "site-1",
    );

    expect(mockFns.publish).toHaveBeenCalledWith({
      type: "notification.new",
      scope: { kind: "admin", id: "notifications.site.site-1" },
      payload: {
        id: "notif-2",
        type: "INFO",
        priority: "LOW",
        title: "Admin hello",
        message: "For site admins",
        createdAt: "2026-04-09T00:00:00.000Z",
      },
    });
  });

  it("fans out ticketReply to admin and target user scopes", async () => {
    const { socketEmitter } = await import("@/lib/websocket/emitter");

    socketEmitter.ticketReply(
      {
        id: "ticket-1",
        ticketNumber: "TCK-001",
        subject: "Need help",
        status: "OPEN",
        priority: "HIGH",
        createdAt: "2026-04-09T00:00:00.000Z",
      },
      "site-1",
      "user-2",
    );

    expect(mockFns.publish).toHaveBeenNthCalledWith(1, {
      type: "ticket.reply",
      scope: { kind: "admin", id: "tickets.site.site-1" },
      payload: {
        id: "ticket-1",
        ticketNumber: "TCK-001",
        subject: "Need help",
        status: "OPEN",
        priority: "HIGH",
        createdAt: "2026-04-09T00:00:00.000Z",
      },
    });
    expect(mockFns.publish).toHaveBeenNthCalledWith(2, {
      type: "ticket.reply",
      scope: { kind: "user", id: "user-2" },
      payload: {
        id: "ticket-1",
        ticketNumber: "TCK-001",
        subject: "Need help",
        status: "OPEN",
        priority: "HIGH",
        createdAt: "2026-04-09T00:00:00.000Z",
      },
    });
  });

  it("fans out updateWorkOrder to admin, assigned user, and workorder scopes", async () => {
    const { socketEmitter } = await import("@/lib/websocket/emitter");

    socketEmitter.updateWorkOrder(
      {
        id: "wo-1",
        workOrderNumber: "WO-001",
        title: "Replace modem",
        type: "INSTALLATION",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assignedToId: "user-3",
        createdAt: "2026-04-09T00:00:00.000Z",
      },
      "site-2",
    );

    expect(mockFns.publish).toHaveBeenNthCalledWith(1, {
      type: "workorder.update",
      scope: { kind: "admin", id: "workorders.site.site-2" },
      payload: {
        id: "wo-1",
        workOrderNumber: "WO-001",
        title: "Replace modem",
        type: "INSTALLATION",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assignedToId: "user-3",
        createdAt: "2026-04-09T00:00:00.000Z",
      },
    });
    expect(mockFns.publish).toHaveBeenNthCalledWith(2, {
      type: "workorder.update",
      scope: { kind: "user", id: "user-3" },
      payload: {
        id: "wo-1",
        workOrderNumber: "WO-001",
        title: "Replace modem",
        type: "INSTALLATION",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assignedToId: "user-3",
        createdAt: "2026-04-09T00:00:00.000Z",
      },
    });
    expect(mockFns.publish).toHaveBeenNthCalledWith(3, {
      type: "workorder.update",
      scope: { kind: "workorder", id: "wo-1" },
      payload: {
        id: "wo-1",
        workOrderNumber: "WO-001",
        title: "Replace modem",
        type: "INSTALLATION",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assignedToId: "user-3",
        createdAt: "2026-04-09T00:00:00.000Z",
      },
    });
  });

  it("publishes chatMessage through the user-scoped Firebase stream", async () => {
    const { socketEmitter } = await import("@/lib/websocket/emitter");

    socketEmitter.chatMessage("user-7", {
      id: "msg-1",
      content: "Halo",
      conversationId: "conv-1",
      senderId: "user-1",
      senderName: "Admin",
      createdAt: "2026-04-09T00:00:00.000Z",
      isOwn: false,
    });

    expect(mockFns.publish).toHaveBeenCalledWith({
      type: "chat.message",
      scope: { kind: "user", id: "user-7" },
      payload: {
        id: "msg-1",
        content: "Halo",
        conversationId: "conv-1",
        senderId: "user-1",
        senderName: "Admin",
        createdAt: "2026-04-09T00:00:00.000Z",
        isOwn: false,
      },
    });
  });
});
