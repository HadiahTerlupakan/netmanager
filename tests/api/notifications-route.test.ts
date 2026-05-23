import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const routeMocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getNotificationsForUser: vi.fn(),
  getUnreadCount: vi.fn(),
  markAllAsRead: vi.fn(),
  getUserPermissions: vi.fn(),
  isSuperAdmin: vi.fn(),
  updateNotificationCount: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: routeMocks.getServerSession,
}));

vi.mock("@/modules/notification/api", () => ({
  getNotificationsForUser: routeMocks.getNotificationsForUser,
  getUnreadCount: routeMocks.getUnreadCount,
  markAllAsRead: routeMocks.markAllAsRead,
}));

vi.mock("@/lib/auth", () => ({
  getUserPermissions: routeMocks.getUserPermissions,
  isSuperAdmin: routeMocks.isSuperAdmin,
  authOptions: {},
}));

vi.mock("@/lib/websocket/emitter", () => ({
  socketEmitter: {
    updateNotificationCount: routeMocks.updateNotificationCount,
  },
}));

import { GET, PATCH } from "@/app/api/notifications/route";

const emptyRouteContext = { params: Promise.resolve({}) };

const buildSession = (overrides: Record<string, unknown> = {}) => ({
  user: {
    id: "user-1",
    departmentId: "dept-1",
    siteId: "site-1",
    role: "ADMIN",
    permissions: [] as string[],
    ...overrides,
  },
});

describe("notifications route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.getServerSession.mockResolvedValue(buildSession());
    routeMocks.getUserPermissions.mockResolvedValue([]);
    routeMocks.isSuperAdmin.mockReturnValue(false);
    routeMocks.getUnreadCount.mockResolvedValue(3);
  });

  it("returns notifications and reuses permissions from session for GET", async () => {
    routeMocks.getServerSession.mockResolvedValueOnce(
      buildSession({ permissions: ["site_only"] }),
    );
    routeMocks.getNotificationsForUser.mockResolvedValueOnce({
      notifications: [{ id: "notif-1" }],
      total: 1,
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/notifications?limit=5&excludeTypes=WORK_ORDER",
      ),
      emptyRouteContext,
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(routeMocks.getNotificationsForUser).toHaveBeenCalledWith("user-1", {
      unreadOnly: false,
      limit: 5,
      offset: 0,
      excludeTypes: ["WORK_ORDER"],
      siteId: "site-1",
      departmentId: "dept-1",
    });
    expect(routeMocks.getUnreadCount).toHaveBeenCalledWith(
      "user-1",
      ["WORK_ORDER"],
      "site-1",
      "dept-1",
    );
    expect(json.data.notifications).toEqual([{ id: "notif-1" }]);
    expect(json.data.unreadCount).toBe(3);
  });

  it("skips total count for lightweight GET requests", async () => {
    routeMocks.getServerSession.mockResolvedValueOnce(
      buildSession({ permissions: ["site_only"] }),
    );
    routeMocks.getNotificationsForUser.mockResolvedValueOnce({
      notifications: [{ id: "notif-1" }],
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/notifications?limit=5&excludeTypes=WORK_ORDER&includeTotal=false",
      ),
      emptyRouteContext,
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(routeMocks.getNotificationsForUser).toHaveBeenCalledWith("user-1", {
      unreadOnly: false,
      limit: 5,
      offset: 0,
      excludeTypes: ["WORK_ORDER"],
      siteId: "site-1",
      departmentId: "dept-1",
      includeTotal: false,
    });
    expect(json.data.notifications).toEqual([{ id: "notif-1" }]);
    expect(json.data.unreadCount).toBe(3);
    expect(json.data).not.toHaveProperty("total");
  });

  it("emits the latest unread count after marking all notifications as read", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ markAllRead: true }),
      }),
      emptyRouteContext,
    );

    expect(response.status).toBe(200);
    expect(routeMocks.markAllAsRead).toHaveBeenCalledWith(
      "user-1",
      undefined,
      undefined,
    );
    expect(routeMocks.getUnreadCount).toHaveBeenCalledWith(
      "user-1",
      undefined,
      undefined,
      "dept-1",
    );
    expect(routeMocks.updateNotificationCount).toHaveBeenCalledWith(
      "user-1",
      3,
    );
  });

  it("emits site-scoped unread count for site-only users after mark all read", async () => {
    routeMocks.getServerSession.mockResolvedValueOnce(
      buildSession({ permissions: ["site_only"] }),
    );

    const response = await PATCH(
      new NextRequest("http://localhost/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ markAllRead: true }),
      }),
      emptyRouteContext,
    );

    expect(response.status).toBe(200);
    expect(routeMocks.markAllAsRead).toHaveBeenCalledWith(
      "user-1",
      undefined,
      "site-1",
    );
    expect(routeMocks.getUnreadCount).toHaveBeenCalledWith(
      "user-1",
      undefined,
      "site-1",
      "dept-1",
    );
    expect(routeMocks.updateNotificationCount).toHaveBeenCalledWith(
      "user-1",
      3,
    );
  });
});
