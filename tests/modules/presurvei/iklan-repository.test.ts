import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Repository diuji dengan me-mock klien Prisma: yang diperiksa adalah bentuk
 * query yang dikirim, bukan perilaku database. Filter tenantId sengaja tidak
 * diperiksa karena ditegakkan ekstensi Prisma di lapisan database.
 */

vi.mock("@/modules/database", () => ({
  prisma: {
    presurveiIklan: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/modules/database";
import { IklanRepository } from "@/modules/presurvei/repositories/IklanRepository";
import type { IklanRow } from "@/modules/presurvei/mappers/iklan.mapper";

const barisIklan = (over: Partial<IklanRow> = {}): IklanRow => ({
  id: "iklan-1",
  nama: "Promo Ramadan",
  kode: "promo-ramadan",
  channel: "META",
  tanggalMulai: new Date("2026-09-01T00:00:00.000Z"),
  tanggalSelesai: null,
  biaya: null,
  penanggungJawabId: null,
  isAktif: true,
  tenantId: "tenant-1",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  ...over,
});

describe("IklanRepository.findMany", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menghitung lompatan halaman dari nomor halaman", async () => {
    vi.mocked(prisma.presurveiIklan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiIklan.count).mockResolvedValue(0 as never);

    await new IklanRepository().findMany({ page: 3, limit: 20 });

    expect(prisma.presurveiIklan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
  });

  it("menggabungkan filter channel, status aktif, dan pencarian", async () => {
    vi.mocked(prisma.presurveiIklan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiIklan.count).mockResolvedValue(0 as never);

    await new IklanRepository().findMany({
      page: 1,
      limit: 10,
      channel: "META",
      isAktif: true,
      search: "ramadan",
    });

    const argumen = vi.mocked(prisma.presurveiIklan.findMany).mock.calls[0][0];
    expect(argumen?.where).toMatchObject({ channel: "META", isAktif: true });
    expect(argumen?.where?.OR).toEqual([
      { nama: { contains: "ramadan", mode: "insensitive" } },
      { kode: { contains: "ramadan", mode: "insensitive" } },
    ]);
  });

  it("menyaring isAktif false, bukan mengabaikannya", async () => {
    // `isAktif: false` adalah filter yang sah — memeriksanya dengan truthiness
    // akan membuat pengguna tidak pernah bisa melihat iklan yang dimatikan.
    vi.mocked(prisma.presurveiIklan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiIklan.count).mockResolvedValue(0 as never);

    await new IklanRepository().findMany({
      page: 1,
      limit: 10,
      isAktif: false,
    });

    const argumen = vi.mocked(prisma.presurveiIklan.findMany).mock.calls[0][0];
    expect(argumen?.where).toMatchObject({ isAktif: false });
  });

  it("tidak menyaring apa pun saat tidak ada filter", async () => {
    vi.mocked(prisma.presurveiIklan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiIklan.count).mockResolvedValue(0 as never);

    await new IklanRepository().findMany({ page: 1, limit: 10 });

    const argumen = vi.mocked(prisma.presurveiIklan.findMany).mock.calls[0][0];
    expect(argumen?.where).toEqual({});
  });
});

describe("IklanRepository.findByKode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mencari lewat findFirst karena kode hanya unik per tenant", async () => {
    vi.mocked(prisma.presurveiIklan.findFirst).mockResolvedValue(null as never);

    await new IklanRepository().findByKode("promo-ramadan");

    expect(prisma.presurveiIklan.findFirst).toHaveBeenCalledWith({
      where: { kode: "promo-ramadan" },
    });
  });

  it("mengembalikan null saat kode tidak dikenal", async () => {
    vi.mocked(prisma.presurveiIklan.findFirst).mockResolvedValue(null as never);

    expect(await new IklanRepository().findByKode("entah")).toBeNull();
  });
});

describe("IklanRepository — pemetaan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("memetakan seluruh kolom baris menjadi entitas domain", async () => {
    const baris = barisIklan({
      tanggalSelesai: new Date("2026-09-30T00:00:00.000Z"),
      // Bentuk `{ toNumber(): number }`, bukan `{ toString(): string }`: itu
      // tipe lama yang sempat dipenuhi sembarang nilai JavaScript dan lolos
      // kompilasi tanpa menolak apa pun (lihat commit 0ba41af2). IklanRow
      // sekarang mensyaratkan bentuk mirip-Decimal ini.
      biaya: { toNumber: () => 1500000.5 },
      penanggungJawabId: "user-1",
    });
    vi.mocked(prisma.presurveiIklan.findUnique).mockResolvedValue(
      baris as never,
    );

    const hasil = await new IklanRepository().findById("iklan-1");

    expect(hasil).toEqual({
      id: "iklan-1",
      nama: "Promo Ramadan",
      kode: "promo-ramadan",
      channel: "META",
      tanggalMulai: baris.tanggalMulai,
      tanggalSelesai: baris.tanggalSelesai,
      biaya: 1500000.5,
      penanggungJawabId: "user-1",
      isAktif: true,
      tenantId: "tenant-1",
      createdAt: baris.createdAt,
      updatedAt: baris.updatedAt,
    });
  });

  it("mempertahankan biaya null apa adanya", async () => {
    vi.mocked(prisma.presurveiIklan.findUnique).mockResolvedValue(
      barisIklan() as never,
    );

    const hasil = await new IklanRepository().findById("iklan-1");

    expect(hasil?.biaya).toBeNull();
  });
});
