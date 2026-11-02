import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/notification", () => ({
  notifyAdminsAboutMobileAction: vi.fn(),
}));

import { MobileAvailableWorkOrderService } from "@/modules/work-order/services/MobileAvailableWorkOrderService";
import {
  getWorkOrderScopeViolation,
  validateMobileAssignedWorkOrderAccess,
} from "@/modules/work-order/services/work-order-access";

/**
 * WO PENDING/REQUESTED dulu melewati semua pemeriksaan di jalur mobile, jadi
 * `GET /api/mobile/work-orders/:id` membuka WO site mana pun se-tenant dan
 * aksi CLAIM melompati aturan site/departemen milik `claimAvailableWorkOrder`.
 */

const TENANT = "tenant-1";

function pendingWorkOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "wo-1",
    tenantId: TENANT,
    status: "PENDING",
    assignedToId: null as string | null,
    assignedMitraId: null as string | null,
    siteId: "site-b",
    departmentId: null as string | null,
    assignments: [] as never[],
    ...overrides,
  };
}

function access(input: {
  workOrder: Record<string, unknown>;
  userId?: string;
  isSuperAdmin?: boolean;
  guard?: () => Promise<boolean>;
}) {
  return validateMobileAssignedWorkOrderAccess({
    repository: { findById: async () => input.workOrder as never },
    workOrderId: "wo-1",
    userContext: {
      id: input.userId ?? "teknisi-a",
      permissions: [],
      tenantId: TENANT,
      isSuperAdmin: input.isSuperAdmin ?? false,
    },
    allowedStatuses: ["PENDING"],
    invalidStatusMessage: "status salah",
    unclaimedAccessGuard: input.guard,
  });
}

describe("akses mobile WO yang belum diambil", () => {
  it("menolak non-peserta bila guard menilai di luar site", async () => {
    await expect(
      access({ workOrder: pendingWorkOrder(), guard: async () => false }),
    ).rejects.toThrow("Akses ditolak");
  });

  it("mengizinkan non-peserta yang lolos aturan daftar WO tersedia", async () => {
    await expect(
      access({ workOrder: pendingWorkOrder(), guard: async () => true }),
    ).resolves.toMatchObject({ id: "wo-1" });
  });

  it("gagal tertutup bila pemanggil tidak memberi guard", async () => {
    await expect(access({ workOrder: pendingWorkOrder() })).rejects.toThrow(
      "Akses ditolak",
    );
  });

  it("pemegang WO tetap bisa membuka WO-nya tanpa guard", async () => {
    await expect(
      access({
        workOrder: pendingWorkOrder({ assignedToId: "teknisi-a" }),
      }),
    ).resolves.toMatchObject({ id: "wo-1" });
  });

  it("super admin dilepas", async () => {
    await expect(
      access({ workOrder: pendingWorkOrder(), isSuperAdmin: true }),
    ).resolves.toMatchObject({ id: "wo-1" });
  });
});

describe("canAccessUnclaimedWorkOrder memakai aturan daftar WO tersedia", () => {
  function serviceWith(profile: {
    user?: Record<string, unknown> | null;
    mitra?: Record<string, unknown> | null;
  }) {
    return new MobileAvailableWorkOrderService({
      findUserProfile: vi.fn().mockResolvedValue(profile.user ?? null),
      findMitraProfile: vi.fn().mockResolvedValue(profile.mitra ?? null),
    } as never);
  }

  const user = { id: "teknisi-a", role: "Teknisi", tenantId: TENANT };

  it("menolak karyawan beda site", async () => {
    const service = serviceWith({
      user: { siteId: "site-a", departmentId: null, userSites: [] },
    });

    await expect(
      service.canAccessUnclaimedWorkOrder(
        { siteId: "site-b", departmentId: null },
        user,
      ),
    ).resolves.toBe(false);
  });

  it("mengizinkan karyawan lewat site tambahan (userSites)", async () => {
    const service = serviceWith({
      user: {
        siteId: "site-a",
        departmentId: null as string | null,
        userSites: [{ siteId: "site-a" }, { siteId: "site-b" }],
      },
    });

    await expect(
      service.canAccessUnclaimedWorkOrder(
        { siteId: "site-b", departmentId: null },
        user,
      ),
    ).resolves.toBe(true);
  });

  it("menolak karyawan beda departemen", async () => {
    const service = serviceWith({
      user: { siteId: "site-b", departmentId: "dept-a", userSites: [] },
    });

    await expect(
      service.canAccessUnclaimedWorkOrder(
        { siteId: "site-b", departmentId: "dept-b" },
        user,
      ),
    ).resolves.toBe(false);
  });

  it("menolak mitra beda site", async () => {
    const service = serviceWith({ mitra: { siteId: "site-a" } });

    await expect(
      service.canAccessUnclaimedWorkOrder(
        { siteId: "site-b", departmentId: null },
        { ...user, role: "MITRA" },
      ),
    ).resolves.toBe(false);
  });
});

describe("getWorkOrderScopeViolation", () => {
  const wo = { siteId: "site-a", departmentId: "dept-a" };

  it("tanpa toggle tidak membatasi", () => {
    expect(getWorkOrderScopeViolation(wo, { permissions: [] })).toBeNull();
  });

  it("gagal tertutup untuk role site_only tanpa site", () => {
    expect(
      getWorkOrderScopeViolation(
        { siteId: null, departmentId: null },
        { permissions: ["workorders:site_only"] },
      ),
    ).toContain("Site berbeda");
  });

  it("menolak site lain dan menerima site sendiri", () => {
    const restricted = { permissions: ["workorders:site_only"] };
    expect(
      getWorkOrderScopeViolation(wo, { ...restricted, siteId: "site-b" }),
    ).toContain("Site berbeda");
    expect(
      getWorkOrderScopeViolation(wo, { ...restricted, siteId: "site-a" }),
    ).toBeNull();
  });
});
