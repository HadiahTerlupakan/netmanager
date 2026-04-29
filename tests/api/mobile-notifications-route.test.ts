import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockFns = vi.hoisted(() => ({
  getMobileAuthPayload: vi.fn(),
  getMobileNotifications: vi.fn(),
  handleMobileNotificationAction: vi.fn(),
  parseMobileNotificationPagination: vi.fn(),
  resolveMobileNotificationSiteId: vi.fn(),
}));

vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileAuthPayload: mockFns.getMobileAuthPayload,
}));

vi.mock("@/modules/notification", () => ({
  getMobileNotifications: mockFns.getMobileNotifications,
  handleMobileNotificationAction: mockFns.handleMobileNotificationAction,
  parseMobileNotificationPagination: mockFns.parseMobileNotificationPagination,
  resolveMobileNotificationSiteId: mockFns.resolveMobileNotificationSiteId,
}));

import { GET, POST } from "@/app/api/mobile/notifications/route";

describe("mobile notifications route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getMobileAuthPayload.mockResolvedValue({
      userId: "user-1",
      permissions: [],
    });
    mockFns.parseMobileNotificationPagination.mockReturnValue({
      limit: 2,
      cursor: 0,
    });
    mockFns.resolveMobileNotificationSiteId.mockReturnValue(undefined);
  });

  it("returns mobile notification data from the route service", async () => {
    mockFns.getMobileNotifications.mockResolvedValueOnce({
      notifications: [{ id: "notif-1" }],
      unreadCount: 4,
      nextCursor: "2",
    });

    const response = await GET(
      new NextRequest("http://localhost/api/mobile/notifications?limit=2"),
    );
    const json = await response.json();

    expect(mockFns.getMobileNotifications).toHaveBeenCalledWith({
      userId: "user-1",
      limit: 2,
      cursor: 0,
      siteId: undefined,
    });
    expect(json.data.unreadCount).toBe(4);
    expect(json.data.nextCursor).toBe("2");
  });

  it("passes site-only restriction to list route service", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValueOnce({
      userId: "user-1",
      permissions: ["site_only"],
      siteId: "site-9",
    });
    mockFns.resolveMobileNotificationSiteId.mockReturnValueOnce("site-9");
    mockFns.getMobileNotifications.mockResolvedValueOnce({
      notifications: [],
      unreadCount: 0,
      nextCursor: null,
    });

    const response = await GET(
      new NextRequest("http://localhost/api/mobile/notifications?limit=10"),
    );

    expect(response.status).toBe(200);
    expect(mockFns.resolveMobileNotificationSiteId).toHaveBeenCalledWith({
      userId: "user-1",
      permissions: ["site_only"],
      siteId: "site-9",
    });
    expect(mockFns.getMobileNotifications).toHaveBeenCalledWith({
      userId: "user-1",
      limit: 2,
      cursor: 0,
      siteId: "site-9",
    });
  });

  it("returns validation error from notification action service", async () => {
    mockFns.handleMobileNotificationAction.mockResolvedValueOnce({
      success: false,
      status: 404,
      error: "Notifikasi tidak ditemukan",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/notifications", {
        method: "POST",
        body: JSON.stringify({
          action: "markRead",
          notificationId: "notif-404",
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Notifikasi tidak ditemukan");
  });

  it("passes site-only restriction to mutation route service", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValueOnce({
      userId: "user-1",
      permissions: ["site_only"],
      siteId: "site-9",
    });
    mockFns.resolveMobileNotificationSiteId.mockReturnValueOnce("site-9");
    mockFns.handleMobileNotificationAction.mockResolvedValueOnce({
      success: true,
      message: "Notifikasi ditandai sudah dibaca",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/notifications", {
        method: "POST",
        body: JSON.stringify({ action: "markRead", notificationId: "notif-9" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockFns.handleMobileNotificationAction).toHaveBeenCalledWith({
      action: "markRead",
      notificationId: "notif-9",
      userId: "user-1",
      siteId: "site-9",
    });
  });
});
