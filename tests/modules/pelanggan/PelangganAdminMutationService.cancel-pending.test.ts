import { beforeEach, describe, expect, it, vi } from "vitest";

import { PelangganAdminMutationService } from "@/modules/pelanggan/services/PelangganAdminMutationService";

const syncCycleInvoiceAfterCancel = vi.hoisted(() =>
  vi.fn(async () => ({ status: "REPRICED" })),
);

vi.mock("@/modules/finance", () => ({
  InvoiceProrateService: class {
    syncCycleInvoiceAfterCancel = syncCycleInvoiceAfterCancel;
  },
}));

const SESSION = {
  user: { id: "admin-1", role: "ADMIN", tenantId: "tenant-1" },
};
const APPLY_AT = new Date("2026-10-31T17:00:00.000Z");

describe("PelangganAdminMutationService.cancelPendingPackage", () => {
  let cancelPendingPackage: ReturnType<typeof vi.fn>;
  let service: PelangganAdminMutationService;

  beforeEach(() => {
    vi.clearAllMocks();
    cancelPendingPackage = vi.fn();
    service = new PelangganAdminMutationService({
      cancelPendingPackage,
      findForAdminMutation: vi.fn(async () => ({ id: "pel-1", siteId: null })),
    } as never);
  });

  // Tagihan siklus mungkin sudah dihitung ulang ke paket terjadwal saat
  // jadwalnya diajukan; membatalkan jadwal harus mengembalikannya.
  it("mengembalikan tagihan siklus dari paket yang jadwalnya dibatalkan", async () => {
    cancelPendingPackage.mockResolvedValue({
      id: "pel-1",
      found: true,
      hasPendingPackage: true,
      cancelledPackageId: "pkg-baru",
      cancelledApplyAt: APPLY_AT,
    });

    const result = await service.cancelPendingPackage({
      id: "pel-1",
      session: SESSION as never,
    });

    expect(result).toEqual({ cancelled: true });
    expect(cancelPendingPackage).toHaveBeenCalledWith("pel-1", "tenant-1");
    expect(syncCycleInvoiceAfterCancel).toHaveBeenCalledWith({
      pelangganId: "pel-1",
      cancelledPackageId: "pkg-baru",
      applyAt: APPLY_AT,
    });
  });

  it("tanpa jadwal, tagihan tidak disentuh", async () => {
    cancelPendingPackage.mockResolvedValue({
      id: "pel-1",
      found: true,
      hasPendingPackage: false,
      cancelledPackageId: null,
      cancelledApplyAt: null,
    });

    const result = await service.cancelPendingPackage({
      id: "pel-1",
      session: SESSION as never,
    });

    expect(result).toMatchObject({ cancelled: false });
    expect(syncCycleInvoiceAfterCancel).not.toHaveBeenCalled();
  });
});
