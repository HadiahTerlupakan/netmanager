import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Notifications } from "@prisma/client";
import { prismaMock } from "../../setup";

vi.mock("@/modules/notification/services/ExpoPushService", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(true),
  sendPushToDepartment: vi.fn().mockResolvedValue(0),
}));

const browserPushMocks = vi.hoisted(() => ({
  sendPushNotifications: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/modules/notification/services/PushNotificationService", () => ({
  sendPushNotifications: browserPushMocks.sendPushNotifications,
}));

const firebaseMessagingMocks = vi.hoisted(() => ({
  sendFCMNotification: vi.fn().mockResolvedValue(undefined),
  getAdminTokens: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/firebase/messaging", () => ({
  sendFCMNotification: firebaseMessagingMocks.sendFCMNotification,
  getAdminTokens: firebaseMessagingMocks.getAdminTokens,
}));

import {
  createNotification,
  getReadableNotificationForUser,
  markAsRead,
  notifyNewPointClaim,
} from "@/modules/notification/services/NotificationService";
import { sendPushNotification as sendExpoPush } from "@/modules/notification/services/ExpoPushService";
import { getAdminTokens, sendFCMNotification } from "@/lib/firebase/messaging";

describe("NotificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.pushSubscriptions.findMany.mockResolvedValue([]);
  });

  describe("getReadableNotificationForUser", () => {
    it("allows direct notifications for the current user", async () => {
      prismaMock.notifications.findFirst.mockResolvedValueOnce({
        id: "notif-1",
        userId: "user-1",
      } as Notifications);

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
      } as Notifications);

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
              AND: [{ departmentId: "dept-2" }, {}],
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
    it("sends browser push to active user subscriptions for direct notifications", async () => {
      prismaMock.notifications.create.mockResolvedValueOnce({
        id: "notif-web-1",
        type: "SYSTEM",
        priority: "NORMAL",
        title: "Web Push Title",
        message: "Web Push Body",
        link: "/employee/notifications",
        sourceType: "SYSTEM",
        sourceId: "src-1",
        createdAt: new Date("2026-03-08T12:00:00.000Z"),
      } as Notifications);
      prismaMock.pushSubscriptions.findMany.mockResolvedValueOnce([
        {
          endpoint: "https://push.example/sub-1",
          p256dh: "p256dh-key",
          auth: "auth-key",
        },
      ]);

      await createNotification({
        type: "SYSTEM",
        title: "Web Push Title",
        message: "Web Push Body",
        userId: "user-web-1",
        link: "/employee/notifications",
        sourceType: "SYSTEM",
        sourceId: "src-1",
      });

      expect(prismaMock.pushSubscriptions.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          userId: { in: ["user-web-1"] },
        },
        select: {
          endpoint: true,
          p256dh: true,
          auth: true,
        },
      });
      expect(browserPushMocks.sendPushNotifications).toHaveBeenCalledWith(
        [
          {
            endpoint: "https://push.example/sub-1",
            keys: {
              p256dh: "p256dh-key",
              auth: "auth-key",
            },
          },
        ],
        expect.objectContaining({
          title: "Web Push Title",
          body: "Web Push Body",
          tag: "notification-notif-web-1",
        }),
      );
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
      } as Notifications);
      prismaMock.pushSubscriptions.findMany.mockResolvedValueOnce([]);

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
      } as Notifications);
      prismaMock.pushSubscriptions.findMany.mockResolvedValueOnce([]);
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
      } as Notifications);
      prismaMock.pushSubscriptions.findMany.mockResolvedValueOnce([]);
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
      } as Notifications);
      prismaMock.pushSubscriptions.findMany.mockResolvedValueOnce([]);
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
        } as Notifications)
        .mockResolvedValueOnce({
          id: "notif-2",
          createdAt: new Date(),
        } as Notifications);

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

  describe("markAsRead", () => {
    it("updates the notification read state", async () => {
      prismaMock.notifications.update.mockResolvedValueOnce({
        id: "notif-1",
        isRead: true,
      } as Notifications);

      const result = await markAsRead("notif-1");

      expect(result.isRead).toBe(true);
      expect(prismaMock.notifications.update).toHaveBeenCalledWith({
        where: { id: "notif-1" },
        data: expect.objectContaining({ isRead: true }),
      });
    });
  });
});
