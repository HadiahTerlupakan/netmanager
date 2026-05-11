import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../../setup";

vi.mock("@/modules/notification/services/ExpoPushService", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(true),
  sendPushToDepartment: vi.fn().mockResolvedValue(0),
}));

const firebaseMessagingMocks = vi.hoisted(() => ({
  sendFCMNotification: vi.fn().mockResolvedValue(undefined),
  getAdminTokens: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/firebase/messaging", () => ({
  sendFCMNotification: firebaseMessagingMocks.sendFCMNotification,
  getAdminTokens: firebaseMessagingMocks.getAdminTokens,
}));

vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: vi.fn(),
}));

import {
  createNotification,
  getNotificationsForUser,
  getReadableNotificationForUser,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
  notifyNewPointClaim,
} from "@/modules/notification/services/NotificationService";
import { sendPushNotification as sendExpoPush } from "@/modules/notification/services/ExpoPushService";
import { getAdminTokens, sendFCMNotification } from "@/lib/firebase/messaging";
import { getTenantIdFromContext } from "@/lib/tenant-context";

describe("NotificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: null,
      isSuperAdmin: true,
    });
  });

  describe("getReadableNotificationForUser", () => {
    it("allows direct notifications for the current user", async () => {
      prismaMock.notifications.findFirst.mockResolvedValueOnce({
        id: "notif-1",
        userId: "user-1",
      } as unknown as { id: string });

      const result = await getReadableNotificationForUser("notif-1", "user-1", {
        departmentId: "dept-1",
        siteId: "site-1",
      });

      expect(result?.id).toBe("notif-1");
      expect(prismaMock.notifications.findFirst).toHaveBeenCalledWith({
        where: {
          id: "notif-1",
          OR: [
            { userId: "user-1" },
            {
              AND: [
                { departmentId: "dept-1" },
                { OR: [{ siteId: "site-1" }, { siteId: null }] },
              ],
            },
          ],
        },
      });
    });

    it("loads the user department when it is not provided", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        departmentId: "dept-2",
      });
      prismaMock.notifications.findFirst.mockResolvedValueOnce({
        id: "notif-2",
      } as unknown as { id: string });

      await getReadableNotificationForUser("notif-2", "user-2");

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-2" },
        select: { departmentId: true },
      });
      expect(prismaMock.notifications.findFirst).toHaveBeenCalledWith({
        where: {
          id: "notif-2",
          OR: [
            { userId: "user-2" },
            {
              AND: [{ departmentId: "dept-2" }],
            },
          ],
        },
      });
    });

    it("returns null when the notification is outside user scope", async () => {
      prismaMock.notifications.findFirst.mockResolvedValueOnce(null);

      const result = await getReadableNotificationForUser("notif-3", "user-3", {
        departmentId: "dept-3",
      });

      expect(result).toBeNull();
    });
  });

  describe("createNotification", () => {
    it("uses request tenant context when no explicit tenant is provided", async () => {
      vi.mocked(getTenantIdFromContext).mockResolvedValueOnce({
        tenantId: "tenant-context-1",
        isSuperAdmin: false,
      });
      prismaMock.notifications.create.mockResolvedValueOnce({
        id: "notif-tenant-1",
        type: "SYSTEM",
        priority: "NORMAL",
        title: "Tenant scoped",
        message: "Tenant body",
        link: null,
        sourceType: "SYSTEM",
        sourceId: "src-tenant-1",
        createdAt: new Date("2026-04-25T00:00:00.000Z"),
      } as unknown as { id: string });

      await createNotification({
        type: "SYSTEM",
        title: "Tenant scoped",
        message: "Tenant body",
        userId: "user-tenant-1",
        sourceType: "SYSTEM",
        sourceId: "src-tenant-1",
        skipExpoPush: true,
      });

      expect(prismaMock.notifications.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-context-1",
        }),
      });
    });

    it("can skip expo push while still creating in-app notification", async () => {
      prismaMock.notifications.create.mockResolvedValueOnce({
        id: "notif-web-2",
        type: "SYSTEM",
        priority: "NORMAL",
        title: "No Expo",
        message: "Still persisted",
        link: null,
        sourceType: "SYSTEM",
        sourceId: "src-2",
        createdAt: new Date("2026-03-08T12:10:00.000Z"),
      } as unknown as { id: string });

      await createNotification({
        type: "SYSTEM",
        title: "No Expo",
        message: "Still persisted",
        userId: "user-no-expo",
        sourceType: "SYSTEM",
        sourceId: "src-2",
        skipExpoPush: true,
      });

      expect(sendExpoPush).not.toHaveBeenCalledWith(
        "user-no-expo",
        "No Expo",
        "Still persisted",
        expect.anything(),
      );
    });

    it("fans out direct notifications through Firebase messaging for user fcm tokens", async () => {
      prismaMock.notifications.create.mockResolvedValueOnce({
        id: "notif-fcm-1",
        type: "SYSTEM",
        priority: "NORMAL",
        title: "Firebase Title",
        message: "Firebase Body",
        link: "/admin/notifications",
        sourceType: "SYSTEM",
        sourceId: "src-fcm-1",
        createdAt: new Date("2026-03-08T12:20:00.000Z"),
      } as unknown as { id: string });
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: "user-fcm-1",
        fcmTokens: ["fcm-token-1", "fcm-token-2"],
      });

      await createNotification({
        type: "SYSTEM",
        title: "Firebase Title",
        message: "Firebase Body",
        userId: "user-fcm-1",
        link: "/admin/notifications",
        sourceType: "SYSTEM",
        sourceId: "src-fcm-1",
        skipExpoPush: true,
      });

      expect(sendFCMNotification).toHaveBeenCalledWith(
        ["fcm-token-1", "fcm-token-2"],
        "Firebase Title",
        "Firebase Body",
        {
          notificationId: "notif-fcm-1",
          url: "/admin/notifications",
          sourceType: "SYSTEM",
          sourceId: "src-fcm-1",
        },
      );
    });

    it("fans out department notifications through Firebase messaging for scoped user tokens", async () => {
      prismaMock.notifications.create.mockResolvedValueOnce({
        id: "notif-fcm-dept-1",
        type: "SYSTEM",
        priority: "NORMAL",
        title: "Department Firebase",
        message: "Department Body",
        link: null,
        sourceType: "SYSTEM",
        sourceId: "src-fcm-dept-1",
        createdAt: new Date("2026-03-08T12:30:00.000Z"),
      } as unknown as { id: string });
      prismaMock.user.findMany.mockResolvedValueOnce([
        { id: "dept-user-1", fcmTokens: ["dept-token-1"] },
        { id: "dept-user-2", fcmTokens: ["dept-token-2", "dept-token-3"] },
      ]);

      await createNotification({
        type: "SYSTEM",
        title: "Department Firebase",
        message: "Department Body",
        departmentId: "dept-1",
        siteId: "site-1",
        sourceType: "SYSTEM",
        sourceId: "src-fcm-dept-1",
        skipExpoPush: true,
      });

      expect(sendFCMNotification).toHaveBeenCalledWith(
        ["dept-token-1", "dept-token-2", "dept-token-3"],
        "Department Firebase",
        "Department Body",
        {
          notificationId: "notif-fcm-dept-1",
          url: "/employee/notifications",
          sourceType: "SYSTEM",
          sourceId: "src-fcm-dept-1",
        },
      );
    });

    it("fans out high priority notifications to admin firebase tokens", async () => {
      prismaMock.notifications.create.mockResolvedValueOnce({
        id: "notif-fcm-admin-1",
        type: "SYSTEM",
        priority: "HIGH",
        title: "Admin Firebase",
        message: "Admin Body",
        link: "/admin/notifications",
        sourceType: "SYSTEM",
        sourceId: "src-fcm-admin-1",
        createdAt: new Date("2026-03-08T12:40:00.000Z"),
      } as unknown as { id: string });
      firebaseMessagingMocks.getAdminTokens.mockResolvedValueOnce([
        "admin-token-1",
        "admin-token-2",
      ]);

      await createNotification({
        type: "SYSTEM",
        priority: "HIGH",
        title: "Admin Firebase",
        message: "Admin Body",
        link: "/admin/notifications",
        sourceType: "SYSTEM",
        sourceId: "src-fcm-admin-1",
        skipExpoPush: true,
      });

      expect(getAdminTokens).toHaveBeenCalledTimes(1);
      expect(sendFCMNotification).toHaveBeenCalledWith(
        ["admin-token-1", "admin-token-2"],
        "Admin Firebase",
        "Admin Body",
        {
          notificationId: "notif-fcm-admin-1",
          url: "/admin/notifications",
          sourceType: "SYSTEM",
          sourceId: "src-fcm-admin-1",
        },
      );
    });
  });

  describe("notifyNewPointClaim", () => {
    it("creates one user-targeted notification per verifier and excludes the submitter", async () => {
      prismaMock.user.findMany.mockResolvedValueOnce([
        { id: "verifier-1", name: "Verifier 1" },
        { id: "sales-1", name: "Sales 1" },
        { id: "verifier-2", name: "Verifier 2" },
      ]);
      prismaMock.notifications.create
        .mockResolvedValueOnce({
          id: "notif-1",
          createdAt: new Date(),
        } as unknown as { id: string })
        .mockResolvedValueOnce({
          id: "notif-2",
          createdAt: new Date(),
        } as unknown as { id: string });

      const result = await notifyNewPointClaim({
        claimId: "claim-1",
        canvasingId: "canvasing-1",
        customerName: "PT Maju",
        salesId: "sales-1",
        salesName: "Budi",
        pointValue: 50,
        siteId: "site-1",
      });

      expect(result).toEqual({ count: 2 });
      expect(prismaMock.notifications.create).toHaveBeenCalledTimes(2);
      expect(prismaMock.notifications.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "verifier-1",
            siteId: "site-1",
            sourceType: "POINT_CLAIM",
            sourceId: "claim-1",
          }),
        }),
      );
      expect(prismaMock.notifications.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "verifier-2",
            siteId: "site-1",
            sourceType: "POINT_CLAIM",
            sourceId: "claim-1",
          }),
        }),
      );
    });
  });

  describe("getNotificationsForUser", () => {
    it("includes site scope parity for site-only inbox queries", async () => {
      vi.mocked(getTenantIdFromContext).mockResolvedValueOnce({
        tenantId: "tenant-1",
        isSuperAdmin: false,
      });
      prismaMock.user.findUnique.mockResolvedValueOnce({
        departmentId: "dept-1",
      });
      prismaMock.notifications.findMany.mockResolvedValueOnce([]);
      prismaMock.notifications.count.mockResolvedValueOnce(0);

      await getNotificationsForUser("user-1", {
        limit: 10,
        offset: 5,
        siteId: "site-9",
      });

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: { departmentId: true },
      });
      expect(prismaMock.notifications.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          OR: [
            { userId: "user-1" },
            {
              AND: [
                { departmentId: "dept-1" },
                { OR: [{ siteId: "site-9" }, { siteId: null }] },
              ],
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        skip: 5,
      });
      expect(prismaMock.notifications.count).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          OR: [
            { userId: "user-1" },
            {
              AND: [
                { departmentId: "dept-1" },
                { OR: [{ siteId: "site-9" }, { siteId: null }] },
              ],
            },
          ],
        },
      });
    });

    it("falls back to NONE department when the user has no department", async () => {
      vi.mocked(getTenantIdFromContext).mockResolvedValueOnce({
        tenantId: "tenant-1",
        isSuperAdmin: false,
      });
      prismaMock.user.findUnique.mockResolvedValueOnce({
        departmentId: null,
      });
      prismaMock.notifications.findMany.mockResolvedValueOnce([]);
      prismaMock.notifications.count.mockResolvedValueOnce(0);

      await getNotificationsForUser("user-no-dept", {
        limit: 20,
      });

      expect(prismaMock.notifications.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          OR: [
            { userId: "user-no-dept" },
            {
              AND: [{ departmentId: "NONE" }],
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        skip: 0,
      });
      expect(prismaMock.notifications.count).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          OR: [
            { userId: "user-no-dept" },
            {
              AND: [{ departmentId: "NONE" }],
            },
          ],
        },
      });
    });

    it("skips total count when lightweight notification queries do not need pagination metadata", async () => {
      vi.mocked(getTenantIdFromContext).mockResolvedValueOnce({
        tenantId: "tenant-1",
        isSuperAdmin: false,
      });
      prismaMock.user.findUnique.mockResolvedValueOnce({
        departmentId: "dept-1",
      });
      prismaMock.notifications.findMany.mockResolvedValueOnce([]);

      const result = await getNotificationsForUser("user-1", {
        limit: 5,
        siteId: "site-9",
        includeTotal: false,
      });

      expect(prismaMock.notifications.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          OR: [
            { userId: "user-1" },
            {
              AND: [
                { departmentId: "dept-1" },
                { OR: [{ siteId: "site-9" }, { siteId: null }] },
              ],
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        skip: 0,
      });
      expect(prismaMock.notifications.count).not.toHaveBeenCalled();
      expect(result).toEqual({ notifications: [], total: undefined });
    });
  });

  describe("getUnreadCount", () => {
    it("passes site scope parity into the unread raw query for site-only users", async () => {
      vi.mocked(getTenantIdFromContext).mockResolvedValueOnce({
        tenantId: "tenant-1",
        isSuperAdmin: false,
      });
      prismaMock.$queryRaw.mockResolvedValueOnce([{ count: BigInt(2) }]);

      const count = await getUnreadCount(
        "user-1",
        undefined,
        "site-9",
        "dept-1",
      );

      expect(count).toBe(2);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);

      const unreadRawCall = prismaMock.$queryRaw.mock.calls[0];
      expect(unreadRawCall[2]).toMatchObject({
        strings: ['AND n."tenantId" = ', ""],
        values: ["tenant-1"],
      });
      expect(unreadRawCall[3]).toBe("user-1");
      expect(unreadRawCall[4]).toBe("dept-1");
      expect(unreadRawCall[5]).toMatchObject({
        strings: ['AND ("siteId" = ', ' OR "siteId" IS NULL)'],
        values: ["site-9"],
      });
    });
  });

  describe("markAllAsRead", () => {
    it("keeps site scope parity for site-only bulk read updates", async () => {
      vi.mocked(getTenantIdFromContext).mockResolvedValueOnce({
        tenantId: "tenant-1",
        isSuperAdmin: false,
      });
      prismaMock.user.findUnique.mockResolvedValueOnce({
        departmentId: "dept-1",
      });
      prismaMock.notifications.updateMany.mockResolvedValueOnce({
        count: 3,
      });

      const result = await markAllAsRead("user-1", undefined, "site-9");

      expect(result).toEqual({ count: 3 });
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: { departmentId: true },
      });
      expect(prismaMock.notifications.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          isRead: false,
          OR: [
            { userId: "user-1" },
            {
              AND: [
                { departmentId: "dept-1" },
                { OR: [{ siteId: "site-9" }, { siteId: null }] },
              ],
            },
          ],
        },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
    });

    it("falls back to NONE department for users without a department", async () => {
      vi.mocked(getTenantIdFromContext).mockResolvedValueOnce({
        tenantId: "tenant-1",
        isSuperAdmin: false,
      });
      prismaMock.user.findUnique.mockResolvedValueOnce({
        departmentId: null,
      });
      prismaMock.notifications.updateMany.mockResolvedValueOnce({
        count: 0,
      });

      const result = await markAllAsRead("user-no-dept");

      expect(result).toEqual({ count: 0 });
      expect(prismaMock.notifications.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          isRead: false,
          OR: [
            { userId: "user-no-dept" },
            {
              AND: [{ departmentId: "NONE" }],
            },
          ],
        },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
    });
  });

  describe("markAsRead", () => {
    it("updates the notification read state", async () => {
      prismaMock.notifications.update.mockResolvedValueOnce({
        id: "notif-1",
        isRead: true,
      } as unknown as { id: string });

      const result = await markAsRead("notif-1");

      expect(result.isRead).toBe(true);
      expect(prismaMock.notifications.update).toHaveBeenCalledWith({
        where: { id: "notif-1" },
        data: expect.objectContaining({ isRead: true }),
      });
    });
  });
});
