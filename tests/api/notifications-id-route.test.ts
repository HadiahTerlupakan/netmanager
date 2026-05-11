import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockFns = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getReadableNotificationForUser: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  getUserPermissions: vi.fn(),
  isSuperAdmin: vi.fn(),
  updateNotificationCount: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireAuth: mockFns.requireAuth,
}));

vi.mock("@/modules/notification/api", () => ({
  getReadableNotificationForUser: mockFns.getReadableNotificationForUser,
  getUnreadCount: mockFns.getUnreadCount,
  markAsRead: mockFns.markAsRead,
}));

vi.mock("@/lib/auth", () => ({
  getUserPermissions: mockFns.getUserPermissions,
  isSuperAdmin: mockFns.isSuperAdmin,
}));

vi.mock("@/lib/websocket/emitter", () => ({
  socketEmitter: {
    updateNotificationCount: mockFns.updateNotificationCount,
  },
}));

import { PATCH } from "@/app/api/notifications/[id]/route";

describe("web notifications id route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.requireAuth.mockResolvedValue({
      user: {
        id: "user-1",
        departmentId: "dept-1",
        siteId: "site-1",
        role: "USER",
        permissions: [],
      },
    });
    mockFns.getUserPermissions.mockResolvedValue([]);
    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.getUnreadCount.mockResolvedValue(4);
  });

  it("marks a readable notification as read", async () => {
    mockFns.getReadableNotificationForUser.mockResolvedValueOnce({
      id: "notif-1",
    });

    const response = await PATCH(
      new NextRequest("http://localhost/api/notifications/notif-1", {
        method: "PATCH",
      }),
      { params: Promise.resolve({ id: "notif-1" }) },
    );
    const json = await response.json();

    expect(mockFns.getReadableNotificationForUser).toHaveBeenCalledWith(
      "notif-1",
      "user-1",
      {
        departmentId: "dept-1",
        siteId: undefined,
      },
    );
    expect(mockFns.markAsRead).toHaveBeenCalledWith("notif-1");
    expect(mockFns.getUnreadCount).toHaveBeenCalledWith(
      "user-1",
      undefined,
      undefined,
      "dept-1",
    );
    expect(mockFns.updateNotificationCount).toHaveBeenCalledWith("user-1", 4);
    expect(json.success).toBe(true);
  });

  it("reuses session permissions for site-only users after mark read", async () => {
    mockFns.requireAuth.mockResolvedValueOnce({
      user: {
        id: "user-1",
        departmentId: "dept-1",
        siteId: "site-1",
        role: "USER",
        permissions: ["site_only"],
      },
    });
    mockFns.getReadableNotificationForUser.mockResolvedValueOnce({
      id: "notif-site-1",
    });

    const response = await PATCH(
      new NextRequest("http://localhost/api/notifications/notif-site-1", {
        method: "PATCH",
      }),
      { params: Promise.resolve({ id: "notif-site-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockFns.getUserPermissions).not.toHaveBeenCalled();
    expect(mockFns.getReadableNotificationForUser).toHaveBeenCalledWith(
      "notif-site-1",
      "user-1",
      {
        departmentId: "dept-1",
        siteId: "site-1",
      },
    );
    expect(mockFns.getUnreadCount).toHaveBeenCalledWith(
      "user-1",
      undefined,
      "site-1",
      "dept-1",
    );
    expect(mockFns.updateNotificationCount).toHaveBeenCalledWith("user-1", 4);
  });

  it("returns 404 when the notification is hidden from the user", async () => {
    mockFns.getReadableNotificationForUser.mockResolvedValueOnce(null);

    const response = await PATCH(
      new NextRequest("http://localhost/api/notifications/notif-2", {
        method: "PATCH",
      }),
      { params: Promise.resolve({ id: "notif-2" }) },
    );

    expect(response.status).toBe(404);
    expect(mockFns.markAsRead).not.toHaveBeenCalled();
  });
});
