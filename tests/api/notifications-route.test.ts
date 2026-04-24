import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const routeMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getNotificationsForUser: vi.fn(),
  getUnreadCount: vi.fn(),
  markAllAsRead: vi.fn(),
  getUserPermissions: vi.fn(),
  isSuperAdmin: vi.fn(),
  updateNotificationCount: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireAuth: routeMocks.requireAuth,
}));

vi.mock("@/modules/notification", () => ({
  getNotificationsForUser: routeMocks.getNotificationsForUser,
  getUnreadCount: routeMocks.getUnreadCount,
  markAllAsRead: routeMocks.markAllAsRead,
}));

vi.mock("@/lib/auth", () => ({
  getUserPermissions: routeMocks.getUserPermissions,
  isSuperAdmin: routeMocks.isSuperAdmin,
}));

vi.mock("@/lib/websocket/emitter", () => ({
  socketEmitter: {
    updateNotificationCount: routeMocks.updateNotificationCount,
  },
}));

import { PATCH } from "@/app/api/notifications/route";

describe("notifications route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.requireAuth.mockResolvedValue({
      user: {
        id: "user-1",
        departmentId: "dept-1",
        siteId: "site-1",
        role: "ADMIN",
      },
    });
    routeMocks.getUserPermissions.mockResolvedValue([]);
    routeMocks.isSuperAdmin.mockReturnValue(false);
    routeMocks.getUnreadCount.mockResolvedValue(3);
  });

  it("emits the latest unread count after marking all notifications as read", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ markAllRead: true }),
      }),
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
    );
    expect(routeMocks.updateNotificationCount).toHaveBeenCalledWith(
      "user-1",
      3,
    );
  });

  it("emits site-scoped unread count for site-only users after mark all read", async () => {
    routeMocks.getUserPermissions.mockResolvedValueOnce(["site_only"]);

    const response = await PATCH(
      new NextRequest("http://localhost/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ markAllRead: true }),
      }),
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
    );
    expect(routeMocks.updateNotificationCount).toHaveBeenCalledWith(
      "user-1",
      3,
    );
  });
});
