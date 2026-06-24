import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFull: vi.fn(),
  deliverNotification: vi.fn(),
}));

vi.mock("../modules/notification/repositories/NotificationRepository", () => ({
  NotificationRepository: class {
    createFull = mocks.createFull;
  },
}));

vi.mock("@/modules/users", () => ({
  UserLookupService: class {},
}));

vi.mock(
  "../modules/notification/services/NotificationService.delivery",
  () => ({ deliverNotification: mocks.deliverNotification }),
);

describe("createNotification — tenantId propagation ke delivery", () => {
  let createNotification: (typeof import("../modules/notification/services/NotificationService"))["createNotification"];
  let getTenantIdFromContext: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.createFull.mockResolvedValue({
      id: "notif-1",
      type: "WORK_ORDER",
      priority: "URGENT",
      title: "WO Baru",
      message: "WO-1",
      link: "/admin/workorders/wo-1",
      createdAt: new Date("2026-06-18T00:00:00.000Z"),
    });

    ({ getTenantIdFromContext } =
      (await import("@/lib/tenant-context")) as unknown as {
        getTenantIdFromContext: ReturnType<typeof vi.fn>;
      });
    getTenantIdFromContext.mockResolvedValue({
      tenantId: "tenant-A",
      isSuperAdmin: false,
    });

    ({ createNotification } =
      await import("../modules/notification/services/NotificationService"));
  });

  it("meneruskan tenantId hasil resolve dari context ke deliverNotification saat data tidak punya tenantId", async () => {
    // WORK_ORDER notification dibuat tanpa tenantId eksplisit (kasus bug)
    await createNotification({
      type: "WORK_ORDER",
      priority: "URGENT",
      title: "WO Baru",
      message: "WO-1",
      userId: "user-1",
      sourceType: "WORK_ORDER",
      sourceId: "wo-1",
    });

    expect(mocks.deliverNotification).toHaveBeenCalledTimes(1);
    const deliveredArg = mocks.deliverNotification.mock.calls[0][0];
    expect(deliveredArg.data.tenantId).toBe("tenant-A");
  });

  it("tetap tanpa tenantId (null/undefined) ketika context kosong — proteksi cross-tenant dipertahankan", async () => {
    getTenantIdFromContext.mockResolvedValue({
      tenantId: null,
      isSuperAdmin: false,
    });

    await createNotification({
      type: "WORK_ORDER",
      priority: "URGENT",
      title: "WO Baru",
      message: "WO-1",
      userId: "user-1",
    });

    const deliveredArg = mocks.deliverNotification.mock.calls[0][0];
    expect(deliveredArg.data.tenantId ?? null).toBeNull();
  });
});
