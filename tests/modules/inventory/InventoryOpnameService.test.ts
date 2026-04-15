import { beforeEach, describe, expect, it, vi } from "vitest";

import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { getInventoryOpnameService } from "@/modules/inventory/services/InventoryOpnameService";
import { prismaMock } from "../../setup";

vi.mock("@/lib/auth", () => ({
  getUserPermissions: vi.fn(),
  isSuperAdmin: vi.fn(),
}));

describe("InventoryOpnameService", () => {
  const service = getInventoryOpnameService();

  beforeEach(() => {
    vi.mocked(getUserPermissions).mockResolvedValue([]);
    vi.mocked(isSuperAdmin).mockReturnValue(false);
    prismaMock.$transaction.mockImplementation(
      async (
        callback: (tx: typeof prismaMock) => Promise<unknown>,
      ): Promise<unknown> => callback(prismaMock),
    );
  });

  it("allows createOpname with legacy siteId fallback before reaching barang lookup", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      siteId: null,
      role: null,
    });
    prismaMock.gudang.findUnique.mockResolvedValueOnce({
      id: "gudang-1",
      tenantId: "tenant-1",
      sites: [{ id: "site-legacy" }],
      isActive: true,
    });
    prismaMock.barang.findUnique.mockResolvedValueOnce(null);
    prismaMock.barangGudang.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.createOpname({
        user: {
          id: "user-1",
          name: "Admin",
          email: "admin@example.com",
          role: "ADMIN",
          permissions: ["k_barang:site_only"],
          siteId: "site-legacy",
        },
        barangId: "barang-1",
        gudangId: "gudang-1",
        stokFisik: 10,
      }),
    ).rejects.toThrow("Barang tidak ditemukan");
  });

  it("uses legacy input.user.siteId as site restriction fallback in listOpname", async () => {
    vi.mocked(getUserPermissions).mockResolvedValueOnce(["opname:site_only"]);
    prismaMock.user.findUnique.mockResolvedValueOnce({
      siteId: null,
    });
    prismaMock.stockOpname.findMany.mockResolvedValueOnce([]);
    prismaMock.stockOpname.count.mockResolvedValueOnce(0);

    await service.listOpname({
      user: {
        id: "user-1",
        name: "Admin",
        email: "admin@example.com",
        role: "ADMIN",
        permissions: [],
        siteId: "site-fallback",
      },
      page: 1,
      limit: 10,
    });

    const findManyArgs = vi.mocked(prismaMock.stockOpname.findMany).mock
      .calls[0]?.[0];
    const countArgs = vi.mocked(prismaMock.stockOpname.count).mock
      .calls[0]?.[0];

    expect(findManyArgs?.where?.gudang?.sites?.some?.id).toBe("site-fallback");
    expect(countArgs?.where?.gudang?.sites?.some?.id).toBe("site-fallback");
  });
});
