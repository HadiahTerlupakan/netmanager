import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const unreadCountRouteMocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUnreadCount: vi.fn(),
  getUserPermissions: vi.fn(),
  isSuperAdmin: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: unreadCountRouteMocks.getServerSession,
}));

vi.mock("@/modules/notification/api", () => ({
  getUnreadCount: unreadCountRouteMocks.getUnreadCount,
}));

vi.mock("@/lib/auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    getUserPermissions: unreadCountRouteMocks.getUserPermissions,
    isSuperAdmin: unreadCountRouteMocks.isSuperAdmin,
  };
});

import { GET } from "@/app/api/notifications/unread-count/route";

describe("notifications unread-count route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unreadCountRouteMocks.getServerSession.mockResolvedValue({
      user: {
        id: "user-1",
        role: "ADMIN",
        siteId: "site-1",
        departmentId: "dept-1",
        permissions: [],
      },
    });
    unreadCountRouteMocks.getUnreadCount.mockResolvedValue(4);
    unreadCountRouteMocks.isSuperAdmin.mockReturnValue(false);
  });

  it("reuses session permissions and forwards scope to unread count service", async () => {
    unreadCountRouteMocks.getServerSession.mockResolvedValueOnce({
      user: {
        id: "user-1",
        role: "ADMIN",
        siteId: "site-1",
        departmentId: "dept-1",
        permissions: ["site_only"],
      },
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/notifications/unread-count?excludeTypes=WORK_ORDER,ANNOUNCEMENT",
      ),
      { params: Promise.resolve({}) },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(unreadCountRouteMocks.getUserPermissions).not.toHaveBeenCalled();
    expect(unreadCountRouteMocks.getUnreadCount).toHaveBeenCalledWith(
      "user-1",
      ["WORK_ORDER", "ANNOUNCEMENT"],
      "site-1",
      "dept-1",
    );
    expect(json.data.count).toBe(4);
  });
});
