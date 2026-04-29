import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getNotificationsForUser: vi.fn(),
  getUnreadCount: vi.fn(),
  getReadableNotificationForUser: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
}));

vi.mock("@/modules/notification/services/NotificationService", () => ({
  getNotificationsForUser: mockFns.getNotificationsForUser,
  getUnreadCount: mockFns.getUnreadCount,
  getReadableNotificationForUser: mockFns.getReadableNotificationForUser,
  markAsRead: mockFns.markAsRead,
  markAllAsRead: mockFns.markAllAsRead,
}));

import {
  getMobileNotifications,
  handleMobileNotificationAction,
} from "@/modules/notification/services/MobileNotificationRouteService";

describe("MobileNotificationRouteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps notifications to mobile links and next cursor", async () => {
    mockFns.getNotificationsForUser.mockResolvedValueOnce({
      notifications: [
        {
          id: "notif-wo-mobile-1",
          type: "WORK_ORDER",
          title: "📝 WO Request Baru",
          message: "Teknisi Mobile mengajukan: Request Dismantle",
          link: "/admin/workorders/list?status=REQUESTED",
          isRead: false,
          sourceType: "WORK_ORDER",
          sourceId: "wo-mobile-1",
          createdAt: new Date("2026-04-15T10:00:00.000Z"),
        },
        {
          id: "notif-canv-1",
          type: "ANNOUNCEMENT",
          title: "Canvasing Disetujui",
          message: "WO baru sudah dibuat",
          link: "/admin/marketing/canvasing/canv-1",
          isRead: false,
          sourceType: "CANVASING",
          sourceId: "canv-1",
          createdAt: new Date("2026-03-08T08:30:00.000Z"),
        },
      ],
      total: 3,
    });
    mockFns.getUnreadCount.mockResolvedValueOnce(4);

    const result = await getMobileNotifications({
      userId: "user-1",
      limit: 2,
      cursor: 0,
    });

    expect(result.unreadCount).toBe(4);
    expect(result.nextCursor).toBe("2");
    expect(result.notifications[0]).toMatchObject({
      title: "Work Order Baru",
      message: "Request Dismantle",
      link: "/(app)/work-order-detail/wo-mobile-1",
    });
    expect(result.notifications[1].link).toBe(
      "/(app)/marketing/canvasing/canv-1",
    );
  });

  it("passes site-only restrictions to notification actions", async () => {
    mockFns.getReadableNotificationForUser.mockResolvedValueOnce({
      id: "notif-9",
    });

    const result = await handleMobileNotificationAction({
      action: "markRead",
      notificationId: "notif-9",
      userId: "user-1",
      siteId: "site-9",
    });

    expect(result.success).toBe(true);
    expect(mockFns.getReadableNotificationForUser).toHaveBeenCalledWith(
      "notif-9",
      "user-1",
      { siteId: "site-9" },
    );
    expect(mockFns.markAsRead).toHaveBeenCalledWith("notif-9");
  });

  it("returns not found when notification is not readable by user", async () => {
    mockFns.getReadableNotificationForUser.mockResolvedValueOnce(null);

    const result = await handleMobileNotificationAction({
      action: "markRead",
      notificationId: "notif-404",
      userId: "user-1",
    });

    expect(result).toEqual({
      success: false,
      status: 404,
      error: "Notifikasi tidak ditemukan",
    });
    expect(mockFns.markAsRead).not.toHaveBeenCalled();
  });
});
