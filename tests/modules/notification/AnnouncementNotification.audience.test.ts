import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../../setup";

const mockSendPushToActors = vi.fn().mockResolvedValue(0);

vi.mock("@/modules/notification/services/ActorPushService", () => ({
  sendPushToActors: (...args: unknown[]) => mockSendPushToActors(...args),
}));

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("AnnouncementNotification audience filtering", () => {
  let sendEmployeeAnnouncementNotifications: (typeof import("@/modules/notification/services/AnnouncementNotification.helpers"))["sendEmployeeAnnouncementNotifications"];

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ sendEmployeeAnnouncementNotifications } =
      await import("@/modules/notification/services/AnnouncementNotification.helpers"));
  });

  it("filters ADMIN audience by accessAdminPanel capability, not role name", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: "user-1" },
      { id: "user-2" },
    ]);
    prismaMock.leaveRequest.findMany.mockResolvedValue([]);
    prismaMock.notifications.createMany.mockResolvedValue({ count: 2 });

    await sendEmployeeAnnouncementNotifications({
      id: "ann-1",
      title: "Admin Notice",
      content: "Important update",
      target: "ADMIN",
      tenantId: "tenant-1",
    } as never);

    const userQuery = prismaMock.user.findMany.mock.calls[0][0];
    expect(userQuery.where).toMatchObject({
      fcmTokens: { isEmpty: false },
      isActive: true,
      tenantId: "tenant-1",
      role: { is: { accessAdminPanel: true } },
    });
    expect(userQuery.where).not.toMatchObject({
      role: { name: { in: ["ADMIN", "SUPER_ADMIN"] } },
    });
  });

  // Push pengumuman dulu hanya lewat Expo (`lib/expo`) ke `pushToken`, jadi
  // tidak pernah sampai ke aplikasi sekarang yang mendaftar lewat FCM.
  it("mengirim push pengumuman lewat FCM ke penerima yang tidak sedang cuti", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: "user-1" },
      { id: "user-cuti" },
    ]);
    prismaMock.leaveRequest.findMany.mockResolvedValue([
      { userId: "user-cuti" },
    ]);
    prismaMock.notifications.createMany.mockResolvedValue({ count: 2 });

    await sendEmployeeAnnouncementNotifications({
      id: "ann-2",
      title: "Libur",
      content: "Kantor tutup besok",
      target: "ALL",
      tenantId: "tenant-1",
    } as never);

    expect(mockSendPushToActors).toHaveBeenCalledWith(
      [{ type: "user", id: "user-1" }],
      "Libur",
      "Kantor tutup besok",
      { announcementId: "ann-2", url: "/announcement" },
    );
  });

  it("pengumuman tanpa tenant tidak di-push (cegah push lintas tenant)", async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: "user-1" }]);
    prismaMock.leaveRequest.findMany.mockResolvedValue([]);
    prismaMock.notifications.createMany.mockResolvedValue({ count: 1 });

    await sendEmployeeAnnouncementNotifications({
      id: "ann-3",
      title: "Tanpa tenant",
      content: "Isi",
      target: "ALL",
    } as never);

    expect(mockSendPushToActors).not.toHaveBeenCalled();
  });
});
