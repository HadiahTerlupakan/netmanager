import { beforeEach, describe, expect, it, vi } from "vitest";

import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { OPNAME_BEDA_SITE_ERROR } from "@/modules/inventory/domain/opname-pesan";
import { getInventoryOpnameService } from "@/modules/inventory/services/InventoryOpnameService";
import { prismaMock } from "../../setup";

vi.mock("@/lib/auth", () => ({
  getUserPermissions: vi.fn(),
  isSuperAdmin: vi.fn(),
}));

vi.mock("@/lib/tenant-context", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actual,
    getTenantIdFromContext: vi.fn(),
  };
});

describe("InventoryOpnameService", () => {
  const service = getInventoryOpnameService();

  beforeEach(() => {
    vi.mocked(getUserPermissions).mockResolvedValue([]);
    vi.mocked(isSuperAdmin).mockReturnValue(false);
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: "tenant-1",
      isSuperAdmin: false,
    });
    prismaMock.$transaction.mockImplementation(
      async (
        callback: (tx: typeof prismaMock) => Promise<unknown>,
      ): Promise<unknown> => callback(prismaMock),
    );
  });

  const ADMIN_DIBATASI = {
    id: "user-1",
    name: "Admin",
    email: "admin@example.com",
    role: "ADMIN",
    permissions: ["opname:site_only"],
    siteId: "site-sesi-lama",
    tenantId: "tenant-1",
  };

  it("createOpname memakai site tambahan (userSites) dari basis data", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      siteId: null,
      role: null,
      userSites: [{ siteId: "site-tambahan" }],
    });
    prismaMock.gudang.findUnique.mockResolvedValueOnce({
      id: "gudang-1",
      tenantId: "tenant-1",
      sites: [{ id: "site-tambahan" }],
      isActive: true,
    });
    prismaMock.barang.findUnique.mockResolvedValueOnce(null);
    prismaMock.barangGudang.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.createOpname({
        user: ADMIN_DIBATASI,
        barangId: "barang-1",
        gudangId: "gudang-1",
        stokFisik: 10,
      }),
    ).rejects.toThrow("Barang tidak ditemukan");
  });

  it("createOpname ditolak untuk user dibatasi opname:site_only di gudang site lain", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      siteId: "site-1",
      role: null,
      userSites: [],
    });
    prismaMock.gudang.findUnique.mockResolvedValueOnce({
      id: "gudang-1",
      tenantId: "tenant-1",
      sites: [{ id: "site-2" }],
      isActive: true,
    });

    await expect(
      service.createOpname({
        user: ADMIN_DIBATASI,
        barangId: "barang-1",
        gudangId: "gudang-1",
        stokFisik: 10,
      }),
    ).rejects.toThrow("(Beda Site)");
    expect(prismaMock.barang.findUnique).not.toHaveBeenCalled();
  });

  it("createOpname gagal-tertutup bila basis data mencatat user tanpa site", async () => {
    // Site dari sesi (token lama) tidak lagi dipercaya: basis data yang menentukan.
    prismaMock.user.findUnique.mockResolvedValueOnce({
      siteId: null,
      role: null,
      userSites: [],
    });

    await expect(
      service.createOpname({
        user: ADMIN_DIBATASI,
        barangId: "barang-1",
        gudangId: "gudang-1",
        stokFisik: 10,
      }),
    ).rejects.toThrow("User tidak memiliki Site");
  });

  it("listOpname menyaring ke seluruh site user (utama + userSites)", async () => {
    vi.mocked(getUserPermissions).mockResolvedValueOnce(["opname:site_only"]);
    prismaMock.user.findUnique.mockResolvedValueOnce({
      siteId: "site-1",
      userSites: [{ siteId: "site-2" }],
    });
    prismaMock.stockOpname.findMany.mockResolvedValueOnce([]);
    prismaMock.stockOpname.count.mockResolvedValueOnce(0);

    await service.listOpname({ user: ADMIN_DIBATASI, page: 1, limit: 10 });

    const findManyArgs = vi.mocked(prismaMock.stockOpname.findMany).mock
      .calls[0]?.[0];
    const countArgs = vi.mocked(prismaMock.stockOpname.count).mock
      .calls[0]?.[0];

    const expected = { in: ["site-1", "site-2"] };
    expect(findManyArgs?.where?.gudang?.sites?.some?.id).toEqual(expected);
    expect(countArgs?.where?.gudang?.sites?.some?.id).toEqual(expected);
  });

  it("listOpname user dibatasi tanpa site menjawab daftar kosong tanpa query", async () => {
    vi.mocked(getUserPermissions).mockResolvedValueOnce(["opname:site_only"]);
    prismaMock.user.findUnique.mockResolvedValueOnce({
      siteId: null,
      userSites: [],
    });

    const result = await service.listOpname({
      user: ADMIN_DIBATASI,
      page: 1,
      limit: 10,
    });

    expect(result.opnameList).toEqual([]);
    expect(prismaMock.stockOpname.findMany).not.toHaveBeenCalled();
  });

  it("getOpnameRecord menolak catatan opname di gudang site lain", async () => {
    vi.mocked(getUserPermissions).mockResolvedValueOnce(["opname:site_only"]);
    prismaMock.stockOpname.findFirst.mockResolvedValueOnce({
      id: "opname-1",
      tenantId: "tenant-1",
      gudang: { id: "gudang-lain", kode: "G2", nama: "Gudang 2", lokasi: null },
      barang: { id: "barang-1", kode: "B1", nama: "Kabel", satuan: "m" },
    });
    prismaMock.user.findUnique.mockResolvedValueOnce({
      siteId: "site-1",
      userSites: [],
    });
    prismaMock.gudang.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.getOpnameRecord({ id: "opname-1", user: ADMIN_DIBATASI }),
    ).rejects.toThrow(OPNAME_BEDA_SITE_ERROR);
  });

  it("rejects createOpname when tenant context is missing for non-superadmin", async () => {
    vi.mocked(getTenantIdFromContext).mockResolvedValueOnce({
      tenantId: null,
      isSuperAdmin: false,
    });
    prismaMock.user.findUnique.mockResolvedValueOnce({
      siteId: null,
      role: null,
    });

    await expect(
      service.createOpname({
        user: {
          id: "user-1",
          name: "Admin",
          email: "admin@example.com",
          role: "ADMIN",
          permissions: ["gudang:site_only"],
          siteId: "site-legacy",
        },
        barangId: "barang-1",
        gudangId: "gudang-1",
        stokFisik: 10,
      }),
    ).rejects.toThrow(
      "SECURITY_BREACH: tenant context is required for non-superadmin inventory opname access",
    );
  });

  it("rejects listOpname when tenant context is missing for non-superadmin", async () => {
    vi.mocked(getTenantIdFromContext).mockResolvedValueOnce({
      tenantId: null,
      isSuperAdmin: false,
    });

    await expect(
      service.listOpname({
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
      }),
    ).rejects.toThrow(
      "SECURITY_BREACH: tenant context is required for non-superadmin inventory opname access",
    );
  });

  it("runs createOpnameBatch with a long transaction timeout for full-warehouse SO", async () => {
    await service.createOpnameBatch({
      user: {
        id: "user-1",
        role: "ADMIN",
        tenantId: "tenant-1",
        permissions: [],
      },
      gudangId: "gudang-1",
      items: [],
    });

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ timeout: 60_000 }),
    );
  });
});
