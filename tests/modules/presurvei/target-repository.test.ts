import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Repository diuji dengan me-mock klien Prisma: yang diperiksa adalah bentuk
 * query yang dikirim, bukan perilaku database. Filter tenantId sengaja tidak
 * diperiksa karena ditegakkan ekstensi Prisma di lapisan database.
 */

vi.mock("@/modules/database", () => ({
  prisma: {
    presurveiTarget: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/modules/database";
import { TargetRepository } from "@/modules/presurvei/repositories/TargetRepository";
import type { TargetRow } from "@/modules/presurvei/mappers/target.mapper";
import type { SimpanTargetInput } from "@/modules/presurvei/domain/ports/ITargetRepository";

// Anotasi `: TargetRow` wajib: tanpanya properti bernilai `null` jadi implicit
// any karena repo mematikan strictNullChecks (lihat Global Constraints).
const barisTarget = (over: Partial<TargetRow> = {}): TargetRow => ({
  id: "target-1",
  userId: "user-1",
  periodeTahun: 2026,
  periodeBulan: 9,
  targetKunjungan: 20,
  targetProspek: 10,
  targetKonversi: 4,
  tenantId: "tenant-1",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  ...over,
});

// `periodeTahun`/`periodeBulan` dan ketiga field `target*` sengaja bernilai
// berbeda-beda: semuanya `number` dan saling bersebelahan, jadi nilai kembar
// akan menyembunyikan field yang tertukar (kelas cacat yang baru ditemukan di
// DTO iklan, id tertukar dengan kode).
const masukanTarget: SimpanTargetInput = {
  userId: "user-1",
  periodeTahun: 2026,
  periodeBulan: 9,
  targetKunjungan: 20,
  targetProspek: 10,
  targetKonversi: 4,
};

describe("TargetRepository.findByUserPeriode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mencari target lewat pemilik dan periodenya", async () => {
    vi.mocked(prisma.presurveiTarget.findFirst).mockResolvedValue(
      null as never,
    );

    await new TargetRepository().findByUserPeriode("user-1", {
      tahun: 2026,
      bulan: 9,
    });

    expect(prisma.presurveiTarget.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", periodeTahun: 2026, periodeBulan: 9 },
    });
  });

  it("memetakan seluruh kolom baris menjadi entitas domain", async () => {
    vi.mocked(prisma.presurveiTarget.findFirst).mockResolvedValue(
      barisTarget({
        periodeTahun: 2026,
        periodeBulan: 9,
        targetKunjungan: 20,
        targetProspek: 10,
        targetKonversi: 4,
      }) as never,
    );

    const hasil = await new TargetRepository().findByUserPeriode("user-1", {
      tahun: 2026,
      bulan: 9,
    });

    expect(hasil).toMatchObject({
      periodeTahun: 2026,
      periodeBulan: 9,
      targetKunjungan: 20,
      targetProspek: 10,
      targetKonversi: 4,
    });
  });
});

describe("TargetRepository.simpan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("memperbarui target yang sudah ada untuk periode itu", async () => {
    // Cabang paling berharga: tanpa test ini, refactor yang menghilangkan
    // pencarian awal membuat setiap penyimpanan melahirkan baris baru alih-
    // alih memperbarui — dan karena ada constraint unique, gejalanya bukan
    // data ganda melainkan kegagalan P2002 yang membingungkan.
    vi.mocked(prisma.presurveiTarget.findFirst).mockResolvedValue(
      barisTarget({ id: "target-lama" }) as never,
    );
    vi.mocked(prisma.presurveiTarget.update).mockResolvedValue(
      barisTarget({ id: "target-lama" }) as never,
    );

    await new TargetRepository().simpan(masukanTarget);

    expect(prisma.presurveiTarget.update).toHaveBeenCalledWith({
      where: { id: "target-lama" },
      data: {
        targetKunjungan: 20,
        targetProspek: 10,
        targetKonversi: 4,
      },
    });
    expect(prisma.presurveiTarget.create).not.toHaveBeenCalled();
  });

  it("membuat target baru saat periode itu belum punya", async () => {
    vi.mocked(prisma.presurveiTarget.findFirst).mockResolvedValue(
      null as never,
    );
    vi.mocked(prisma.presurveiTarget.create).mockResolvedValue(
      barisTarget() as never,
    );

    await new TargetRepository().simpan(masukanTarget);

    expect(prisma.presurveiTarget.create).toHaveBeenCalledWith({
      data: masukanTarget,
    });
    expect(prisma.presurveiTarget.update).not.toHaveBeenCalled();
  });
});

// findByPeriode tidak tersentuh keempat test di atas (yang menyasar
// findByUserPeriode dan simpan) — brief ronde perbaikan ini secara eksplisit
// meminta metode yang belum tersentuh ditambahkan, mengikuti gaya Test 1.
describe("TargetRepository.findByPeriode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mencari seluruh target pada satu periode, lintas sales", async () => {
    vi.mocked(prisma.presurveiTarget.findMany).mockResolvedValue([] as never);

    await new TargetRepository().findByPeriode({ tahun: 2026, bulan: 9 });

    expect(prisma.presurveiTarget.findMany).toHaveBeenCalledWith({
      where: { periodeTahun: 2026, periodeBulan: 9 },
    });
  });
});
