import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  findAllPaginated: vi.fn(),
}));

vi.mock("@/modules/pelanggan/repositories/PelangganRepository", () => ({
  PelangganRepository: class MockPelangganRepository {
    findAllPaginated = mockFns.findAllPaginated;
  },
}));

import {
  listMobilePelanggan,
  SiteAccessDeniedError,
  type MobileSessionUser,
} from "@/modules/pelanggan/services/MobilePelangganService";

// Scoping site mobile berdiri sendiri (lihat resolveSiteFilter) — tidak lagi
// lewat checkSiteRestriction/@/modules/roles, jadi tidak ada mock modul roles
// di sini. Fixture di bawah menguji logika sebenarnya lewat bentuk sesi asli.
const teknisiDuaSite: { user: MobileSessionUser } = {
  user: { id: "user-1", tenantId: "tenant-1", siteIds: ["site-a", "site-b"] },
};

const pelangganRow = {
  id: "plg-1",
  idPelanggan: "P-001",
  nama: "Budi",
  username: "budi",
  status: "ISOLIR",
  alamat: "Jl. Mawar 1",
  noTelp: "08123",
  jatuhTempo: new Date("2026-09-10T00:00:00.000Z"),
  siteId: "site-a",
  latitude: -6.2,
  longitude: 106.8,
  hargaPaket: { name: "Paket 20 Mbps" },
  site: { name: "Site A" },
};

describe("listMobilePelanggan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.findAllPaginated.mockResolvedValue({
      data: [pelangganRow],
      total: 1,
    });
  });

  it("membatasi query pada site yang ditugaskan ke karyawan", async () => {
    await listMobilePelanggan({
      session: teknisiDuaSite,
      status: "ISOLIR",
      page: 1,
      limit: 20,
    });

    expect(mockFns.findAllPaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        siteId: { in: ["site-a", "site-b"] },
        status: "ISOLIR",
      }),
      1,
      20,
    );
  });

  it("tidak menambahkan filter tenant manual — isolasi tenant milik ekstensi Prisma", async () => {
    await listMobilePelanggan({
      session: teknisiDuaSite,
      status: "ISOLIR",
      page: 1,
      limit: 20,
    });

    const filter = mockFns.findAllPaginated.mock.calls[0][0];
    expect("tenantId" in filter).toBe(false);
  });

  it("menolak karyawan yang tidak punya site sama sekali", async () => {
    const session: { user: MobileSessionUser } = {
      user: { id: "user-2", tenantId: "tenant-1", siteIds: [] },
    };

    await expect(
      listMobilePelanggan({ session, page: 1, limit: 20 }),
    ).rejects.toBeInstanceOf(SiteAccessDeniedError);
    expect(mockFns.findAllPaginated).not.toHaveBeenCalled();
  });

  it("mengecualikan pelanggan DISMANTLE ketika status tidak diminta", async () => {
    await listMobilePelanggan({ session: teknisiDuaSite, page: 1, limit: 20 });

    const filter = mockFns.findAllPaginated.mock.calls[0][0];
    expect(filter.status).toEqual({ not: "DISMANTLE" });
  });

  it("mempersempit ke satu site ketika siteId diminta dan diizinkan", async () => {
    await listMobilePelanggan({
      session: teknisiDuaSite,
      siteId: "site-b",
      page: 1,
      limit: 20,
    });

    const filter = mockFns.findAllPaginated.mock.calls[0][0];
    expect(filter.siteId).toBe("site-b");
  });

  it("menolak siteId di luar site karyawan", async () => {
    await expect(
      listMobilePelanggan({
        session: teknisiDuaSite,
        siteId: "site-z",
        page: 1,
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(SiteAccessDeniedError);
    expect(mockFns.findAllPaginated).not.toHaveBeenCalled();
  });

  it("fallback ke siteId legacy sebagai satu-satunya site yang diizinkan saat siteIds tidak ada", async () => {
    const session: { user: MobileSessionUser } = {
      user: { id: "user-3", tenantId: "tenant-1", siteId: "site-a" },
    };

    await listMobilePelanggan({ session, page: 1, limit: 20 });

    const filter = mockFns.findAllPaginated.mock.calls[0][0];
    expect(filter.siteId).toEqual({ in: ["site-a"] });
  });

  it("tidak membatasi super admin — siteId yang diminta dipakai apa adanya tanpa validasi", async () => {
    const session: { user: MobileSessionUser } = {
      user: { id: "user-9", tenantId: "tenant-1", isSuperAdmin: true },
    };

    await listMobilePelanggan({
      session,
      siteId: "site-manapun",
      page: 1,
      limit: 20,
    });

    const filter = mockFns.findAllPaginated.mock.calls[0][0];
    expect(filter.siteId).toBe("site-manapun");
  });

  it("tidak membatasi super admin — tanpa siteId diminta, tidak ada filter site sama sekali", async () => {
    const session: { user: MobileSessionUser } = {
      user: { id: "user-9", tenantId: "tenant-1", isSuperAdmin: true },
    };

    await listMobilePelanggan({ session, page: 1, limit: 20 });

    const filter = mockFns.findAllPaginated.mock.calls[0][0];
    expect("siteId" in filter).toBe(false);
  });

  it("memetakan baris pelanggan ke DTO mobile tanpa kolom sensitif", async () => {
    const result = await listMobilePelanggan({
      session: teknisiDuaSite,
      page: 1,
      limit: 20,
    });

    expect(result.total).toBe(1);
    expect(result.data[0]).toEqual({
      id: "plg-1",
      idPelanggan: "P-001",
      nama: "Budi",
      username: "budi",
      status: "ISOLIR",
      paket: "Paket 20 Mbps",
      alamat: "Jl. Mawar 1",
      noTelp: "08123",
      jatuhTempo: "2026-09-10T00:00:00.000Z",
      siteId: "site-a",
      siteName: "Site A",
      latitude: -6.2,
      longitude: 106.8,
    });
  });
});
