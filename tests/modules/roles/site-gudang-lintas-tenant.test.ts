import { describe, expect, it, vi } from "vitest";

import { SiteService } from "@/modules/roles";

/**
 * Penugasan gudang ke site memakai `connect`/`set` Prisma berdasarkan id mentah
 * kiriman klien, dan ekstensi tenant TIDAK menyaring relasi bersarang. Tanpa
 * penjaga, pemegang `site:update` cukup menebak id gudang milik tenant lain
 * untuk menautkannya ke site sendiri — dan gudang itu lalu ikut terbaca lewat
 * filter `gudang.sites` di seluruh modul inventory.
 *
 * `findGudangIdsInTenant` memakai prisma ber-ekstensi tenant, jadi gudang tenant
 * lain tidak ikut terbaca dan hilang dari hasil. Yang diuji di sini: selisih
 * jumlah itu benar-benar menghentikan penulisan.
 */

/** Entity site seadanya, cukup untuk dilewatkan mapper. */
const siteEntity = {
  id: "site-1",
  code: "JAKSEL",
  name: "Jakarta Selatan",
  description: null as string | null,
  address: null as string | null,
  kabupatenKota: null as string | null,
  isActive: true,
  location: {
    latitude: null as number | null,
    longitude: null as number | null,
    attendanceRadius: 100,
  },
  counts: { users: 0, workOrders: 0, pelanggan: 0 },
  users: [] as { id: string; name: string }[],
  gudangs: [] as { id: string; nama: string; kode: string }[],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const repositoryPalsu = (gudangDalamTenant: string[]) => ({
  findById: vi.fn().mockResolvedValue(siteEntity),
  findByCode: vi.fn().mockResolvedValue(null),
  findGudangIdsInTenant: vi.fn().mockResolvedValue(gudangDalamTenant),
  create: vi.fn().mockResolvedValue(siteEntity),
  update: vi.fn().mockResolvedValue(siteEntity),
});

describe("penugasan gudang lintas tenant", () => {
  it("menolak id gudang yang bukan milik tenant aktif", async () => {
    const repository = repositoryPalsu(["gudang-sendiri"]);
    const service = new SiteService(repository as never);

    const hasil = await service.updateSite(
      "site-1",
      { gudangIds: ["gudang-sendiri", "gudang-tenant-lain"] },
      "user-1",
    );

    expect(hasil.success).toBe(false);
    if (!hasil.success) expect(hasil.code).toBe("VALIDATION_ERROR");
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("menolak juga saat membuat site baru", async () => {
    const repository = repositoryPalsu([]);
    const service = new SiteService(repository as never);

    const hasil = await service.createSite(
      { code: "BARU", name: "Site Baru", gudangIds: ["gudang-tenant-lain"] },
      "user-1",
    );

    expect(hasil.success).toBe(false);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("meneruskan gudang yang seluruhnya milik tenant aktif", async () => {
    const repository = repositoryPalsu(["g1", "g2"]);
    const service = new SiteService(repository as never);

    const hasil = await service.updateSite(
      "site-1",
      { gudangIds: ["g1", "g2"] },
      "user-1",
    );

    expect(hasil.success).toBe(true);
    expect(repository.update).toHaveBeenCalled();
  });

  it("tanpa gudangIds tidak memanggil pemeriksaan sama sekali", async () => {
    const repository = repositoryPalsu([]);
    const service = new SiteService(repository as never);

    await service.updateSite("site-1", { name: "Ganti Nama" }, "user-1");

    expect(repository.findGudangIdsInTenant).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalled();
  });

  // Id ganda tidak boleh menutupi satu id asing.
  it("id berulang tidak membuat selisih jumlahnya tertutupi", async () => {
    const repository = repositoryPalsu(["g1"]);
    const service = new SiteService(repository as never);

    const hasil = await service.updateSite(
      "site-1",
      { gudangIds: ["g1", "g1", "gudang-asing"] },
      "user-1",
    );

    expect(hasil.success).toBe(false);
    expect(repository.update).not.toHaveBeenCalled();
  });
});
