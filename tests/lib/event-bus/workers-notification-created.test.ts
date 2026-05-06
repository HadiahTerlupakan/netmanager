import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  notifyUser: vi.fn(),
  notifyDepartment: vi.fn(),
  notifyAdmins: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn(),
    name: "mock-worker",
    closing: false,
  })),
}));

class RedisMock {
  on = vi.fn();
  once = vi.fn((event: string, callback: () => void) => {
    if (event === "ready") {
      setTimeout(callback, 0);
    }
  });
  duplicate = vi.fn(() => ({ on: vi.fn(), once: vi.fn() }));
}

vi.mock("ioredis", () => ({
  default: RedisMock,
}));

vi.mock("@/lib/websocket/emitter", () => ({
  socketEmitter: {
    notifyUser: mockFns.notifyUser,
    notifyDepartment: mockFns.notifyDepartment,
    notifyAdmins: mockFns.notifyAdmins,
  },
}));

describe("event-bus notification.created handler", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("fans out notification.created through the realtime facade", async () => {
    const workers = await import("@/lib/event-bus/workers");

    await workers.dispatchEventForTest("notification:created", {
      notificationId: "notif-1",
      userId: "user-1",
      departmentId: "dept-1",
      type: "WORK_ORDER",
      priority: "URGENT",
      title: "Hello",
      message: "World",
      link: "/admin/workorders/wo-1",
      timestamp: "2026-04-10T00:00:00.000Z",
    });

    expect(mockFns.notifyUser).toHaveBeenCalledWith("user-1", {
      id: "notif-1",
      type: "WORK_ORDER",
      priority: "URGENT",
      title: "Hello",
      message: "World",
      link: "/admin/workorders/wo-1",
      createdAt: "2026-04-10T00:00:00.000Z",
    });

    expect(mockFns.notifyDepartment).toHaveBeenCalledWith("dept-1", {
      id: "notif-1",
      type: "WORK_ORDER",
      priority: "URGENT",
      title: "Hello",
      message: "World",
      link: "/admin/workorders/wo-1",
      createdAt: "2026-04-10T00:00:00.000Z",
    });

    expect(mockFns.notifyAdmins).toHaveBeenCalledWith({
      id: "notif-1",
      type: "WORK_ORDER",
      priority: "URGENT",
      title: "Hello",
      message: "World",
      link: "/admin/workorders/wo-1",
      createdAt: "2026-04-10T00:00:00.000Z",
    });
  }, 20000);
});
