import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  publish: vi.fn().mockResolvedValue(undefined),
  processors: [] as Array<{
    queueName: string;
    processor: (job: unknown) => Promise<void>;
  }>,
}));

vi.mock("bullmq", () => {
  class WorkerMock {
    name: string;
    closing = false;
    on = vi.fn();
    close = vi.fn();

    constructor(queueName: string, processor: (job: unknown) => Promise<void>) {
      this.name = String(queueName);
      mockFns.processors.push({
        queueName,
        processor,
      });
    }
  }

  return {
    Worker: WorkerMock,
  };
});

class RedisMock {
  on = vi.fn();
  duplicate = vi.fn(() => ({ on: vi.fn() }));
}

vi.mock("ioredis", () => ({
  default: RedisMock,
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

describe("event-bus attendance realtime publishing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFns.processors.length = 0;
  });

  it("publishes attendance check-ins to the admin notifications Firebase stream", async () => {
    const workers = await import("@/lib/event-bus/workers");

    await workers.dispatchEventForTest("attendance:checkin", {
      userId: "user-1",
      attendanceId: "att-1",
      timestamp: "2026-04-10T00:00:00.000Z",
    });

    expect(mockFns.publish).toHaveBeenCalledWith({
      type: "attendance.checkin",
      scope: { kind: "admin", id: "notifications" },
      payload: {
        userId: "user-1",
        attendanceId: "att-1",
        timestamp: "2026-04-10T00:00:00.000Z",
      },
    });
  });

  it("publishes websocket attendance notifications through Firebase instead of Socket.IO", async () => {
    const workers = await import("@/lib/event-bus/workers");

    await workers.dispatchEventForTest("attendance:absent", {
      userId: "user-2",
      attendanceId: "att-2",
      timestamp: "2026-04-10T01:00:00.000Z",
    });

    expect(mockFns.publish).toHaveBeenCalledWith({
      type: "attendance.absent",
      scope: { kind: "admin", id: "notifications" },
      payload: {
        userId: "user-2",
        attendanceId: "att-2",
        timestamp: "2026-04-10T01:00:00.000Z",
      },
    });
  });
});
