import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../../setup";

const mockSendExpoPushNotifications = vi.fn();

vi.mock("@/lib/expo", () => ({
  sendExpoPushNotifications: (...args: unknown[]) =>
    mockSendExpoPushNotifications(...args),
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
      { id: "user-1", pushToken: "token-1" },
      { id: "user-2", pushToken: "token-2" },
    ]);
    prismaMock.leaveRequest.findMany.mockResolvedValue([]);
    prismaMock.notifications.createMany.mockResolvedValue({ count: 2 });

    await sendEmployeeAnnouncementNotifications({
      id: "ann-1",
      title: "Admin Notice",
      content: "Important update",
      target: "ADMIN",
    } as never);

    const userQuery = prismaMock.user.findMany.mock.calls[0][0];
    expect(userQuery.where).toMatchObject({
      pushToken: { not: null },
      isActive: true,
      role: { is: { accessAdminPanel: true } },
    });
    expect(userQuery.where).not.toMatchObject({
      role: { name: { in: ["ADMIN", "SUPER_ADMIN"] } },
    });
  });
});
