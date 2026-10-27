import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  canAccessSite: vi.fn(),
  renewCurrentCycle: vi.fn(),
}));

vi.mock("@/modules/roles", () => ({ canAccessSite: palsu.canAccessSite }));

vi.mock("@/modules/finance", () => ({
  CustomerRenewalService: class {
    renewCurrentCycle = palsu.renewCurrentCycle;
  },
}));

import { PelangganRenewalService } from "@/modules/pelanggan/services/PelangganRenewalService";

const SESI_ADMIN_SITE = {
  user: { tenantId: "tenant-1", isSuperAdmin: false, role: "ADMIN_SITE" },
};
const DATA = {
  statusBayar: "LUNAS" as const,
  paymentMethod: "CASH" as const,
  reference: "",
  notes: "lunas di loket",
};

function serviceDengan(pelanggan: { siteId: string | null } | null) {
  const findForAdminMutation = vi.fn().mockResolvedValue(pelanggan);
  const service = new PelangganRenewalService({
    findForAdminMutation,
  } as never);
  return { service, findForAdminMutation };
}

describe("PelangganRenewalService.renew", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    palsu.canAccessSite.mockReturnValue(true);
    palsu.renewCurrentCycle.mockResolvedValue({ invoiceId: "inv-1" });
  });

  it("mencari pelanggan dalam tenant sesi lalu menyerahkan penagihan ke finance", async () => {
    const { service, findForAdminMutation } = serviceDengan({
      siteId: "site-1",
    });

    await service.renew({
      id: "pel-1",
      session: SESI_ADMIN_SITE,
      userId: "admin-1",
      data: DATA,
    });

    expect(findForAdminMutation).toHaveBeenCalledWith("pel-1", "tenant-1");
    expect(palsu.renewCurrentCycle).toHaveBeenCalledWith({
      pelangganId: "pel-1",
      statusBayar: "LUNAS",
      paymentMethod: "CASH",
      reference: null,
      notes: "lunas di loket",
      userId: "admin-1",
    });
  });

  it("NOT_FOUND untuk pelanggan di luar tenant", async () => {
    const { service } = serviceDengan(null);

    await expect(
      service.renew({
        id: "pel-1",
        session: SESI_ADMIN_SITE,
        userId: "admin-1",
        data: DATA,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(palsu.renewCurrentCycle).not.toHaveBeenCalled();
  });

  it("FORBIDDEN untuk pelanggan di site yang tidak boleh diakses", async () => {
    palsu.canAccessSite.mockReturnValue(false);
    const { service } = serviceDengan({ siteId: "site-lain" });

    await expect(
      service.renew({
        id: "pel-1",
        session: SESI_ADMIN_SITE,
        userId: "admin-1",
        data: DATA,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(palsu.renewCurrentCycle).not.toHaveBeenCalled();
  });
});
