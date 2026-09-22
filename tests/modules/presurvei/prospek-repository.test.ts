import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Repository diuji dengan me-mock klien Prisma: yang diperiksa adalah bentuk
 * query yang dikirim (filter, paginasi, urutan), bukan perilaku database.
 * Filter tenantId sengaja tidak diperiksa karena ditegakkan oleh ekstensi
 * Prisma di lapisan database, bukan oleh repository.
 */

vi.mock("@/modules/database", () => ({
  prisma: {
    presurveiProspek: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/modules/database";
import { ProspekRepository } from "@/modules/presurvei/repositories/ProspekRepository";
import type { ProspekRow } from "@/modules/presurvei/mappers/prospek.mapper";

// Anotasi `: ProspekRow` wajib: tanpanya properti bernilai `null` jadi implicit
// any karena repo mematikan strictNullChecks (lihat Global Constraints).
const barisProspek = (over: Partial<ProspekRow> = {}): ProspekRow => ({
  id: "prospek-1",
  nama: "Budi",
  noTelp: "081234567890",
  email: null,
  alamat: "Jl. Merdeka 10",
  latitude: null,
  longitude: null,
  shareloc: null,
  sumber: "LAPANGAN",
  iklanId: null,
  registrationId: null,
  referralNama: null,
  status: "BARU",
  pemilikId: "user-1",
  paketDiminati: null,
  catatan: null,
  canvasingId: null,
  konversiAt: null,
  siteId: null,
  tenantId: "tenant-1",
  createdAt: new Date("2026-09-22T00:00:00.000Z"),
  updatedAt: new Date("2026-09-22T00:00:00.000Z"),
  ...over,
});

describe("ProspekRepository.findMany", () => {
  let repository: ProspekRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new ProspekRepository();
  });

  it("menghitung lompatan halaman dari nomor halaman", async () => {
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiProspek.count).mockResolvedValue(0 as never);

    await repository.findMany({ page: 3, limit: 20 });

    expect(prisma.presurveiProspek.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
  });

  it("mencari pada nama, nomor telepon, dan alamat sekaligus", async () => {
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiProspek.count).mockResolvedValue(0 as never);

    await repository.findMany({ page: 1, limit: 10, search: "budi" });

    const argumen = vi.mocked(prisma.presurveiProspek.findMany).mock
      .calls[0][0];
    expect(argumen?.where?.OR).toHaveLength(3);
  });

  it("tidak menyaring apa pun saat tidak ada filter", async () => {
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiProspek.count).mockResolvedValue(0 as never);

    await repository.findMany({ page: 1, limit: 10 });

    const argumen = vi.mocked(prisma.presurveiProspek.findMany).mock
      .calls[0][0];
    expect(argumen?.where).toEqual({});
  });

  it("mengembalikan entitas domain, bukan baris mentah", async () => {
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([
      barisProspek(),
    ] as never);
    vi.mocked(prisma.presurveiProspek.count).mockResolvedValue(1 as never);

    const hasil = await repository.findMany({ page: 1, limit: 10 });

    expect(hasil.total).toBe(1);
    expect(hasil.items[0]).toMatchObject({ id: "prospek-1", status: "BARU" });
  });
});

describe("ProspekRepository.findById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mengembalikan null saat prospek tidak ada", async () => {
    vi.mocked(prisma.presurveiProspek.findUnique).mockResolvedValue(
      null as never,
    );

    const hasil = await new ProspekRepository().findById("tidak-ada");

    expect(hasil).toBeNull();
  });
});
