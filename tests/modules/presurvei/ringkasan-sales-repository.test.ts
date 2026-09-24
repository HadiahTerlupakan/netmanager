import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/modules/database", () => ({
  prisma: {
    presurveiKegiatan: { groupBy: vi.fn() },
    presurveiProspek: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/modules/database";
import { TenantContextError } from "@/lib/prisma-extension";
import {
  BATAS_PROSPEK_AKTIF_DIPERIKSA,
  RingkasanSalesRepository,
} from "@/modules/presurvei/repositories/RingkasanSalesRepository";

/**
 * Setiap query menulis `tenantId` eksplisit di `where` — isolasi di
 * repository, tidak diserahkan ke ekstensi saja — dan menolak tenant kosong,
 * yang bagi Prisma berarti "tanpa syarat". userId dan tenantId sengaja
 * bernilai berbeda supaya tertukarnya terlihat.
 */

// Tipe `groupBy` Prisma memicu TS2615 (circular reference) begitu
// `vi.mocked()` mencoba menyelesaikan tipe parameternya secara penuh — isu
// yang sudah didokumentasikan di tests/setup.ts dan
// kegiatan-repository.test.ts. Cast ke `Mock` generik mengikuti mitigasi
// yang sama.
const groupByMock = prisma.presurveiKegiatan.groupBy as unknown as Mock;

const ID_SALES = "sales-a";
const ID_TENANT = "tenant-x";
const RENTANG = {
  mulai: new Date("2026-09-24T00:00:00.000Z"),
  selesai: new Date("2026-09-24T23:59:59.999Z"),
};

describe("RingkasanSalesRepository.hitungKegiatanPerJenis", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mengelompokkan kegiatan pemanggil per jenis dalam rentang dan tenant", async () => {
    groupByMock.mockResolvedValue([
      { jenis: "KUNJUNGAN", _count: { _all: 3 } },
      { jenis: "TELEPON", _count: { _all: 4 } },
    ] as never);

    const hasil = await new RingkasanSalesRepository().hitungKegiatanPerJenis(
      ID_SALES,
      RENTANG,
      ID_TENANT,
    );

    expect(groupByMock).toHaveBeenCalledWith({
      by: ["jenis"],
      where: {
        userId: ID_SALES,
        tenantId: ID_TENANT,
        waktuMulai: { gte: RENTANG.mulai, lte: RENTANG.selesai },
      },
      _count: { _all: true },
    });
    expect(hasil).toEqual({ KUNJUNGAN: 3, TELEPON: 4 });
  });

  it("menolak tenant kosong tanpa menyentuh database", async () => {
    await expect(
      new RingkasanSalesRepository().hitungKegiatanPerJenis(
        ID_SALES,
        RENTANG,
        "",
      ),
    ).rejects.toBeInstanceOf(TenantContextError);
    expect(groupByMock).not.toHaveBeenCalled();
  });
});

describe("RingkasanSalesRepository.daftarProspekAktif", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mengambil prospek beban aktif milik pemanggil, terlama lebih dulu", async () => {
    const diubah = new Date("2026-09-01T00:00:00.000Z");
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([
      {
        id: "p-1",
        nama: "Budi",
        noTelp: "081200",
        status: "BARU",
        updatedAt: diubah,
      },
    ] as never);

    const hasil = await new RingkasanSalesRepository().daftarProspekAktif(
      ID_SALES,
      ID_TENANT,
    );

    expect(prisma.presurveiProspek.findMany).toHaveBeenCalledWith({
      where: {
        pemilikId: ID_SALES,
        tenantId: ID_TENANT,
        status: { in: ["BARU", "DIHUBUNGI", "TERTARIK", "NEGOSIASI"] },
      },
      orderBy: { updatedAt: "asc" },
      take: BATAS_PROSPEK_AKTIF_DIPERIKSA,
      select: {
        id: true,
        nama: true,
        noTelp: true,
        status: true,
        updatedAt: true,
      },
    });
    expect(hasil).toEqual([
      {
        id: "p-1",
        nama: "Budi",
        noTelp: "081200",
        status: "BARU",
        updatedAt: diubah,
      },
    ]);
  });

  it("menolak tenant kosong tanpa menyentuh database", async () => {
    await expect(
      new RingkasanSalesRepository().daftarProspekAktif(ID_SALES, ""),
    ).rejects.toBeInstanceOf(TenantContextError);
    expect(prisma.presurveiProspek.findMany).not.toHaveBeenCalled();
  });
});

describe("RingkasanSalesRepository.waktuKegiatanTerakhir", () => {
  beforeEach(() => vi.clearAllMocks());

  it("tidak bertanya ke database bila tidak ada prospek", async () => {
    const hasil = await new RingkasanSalesRepository().waktuKegiatanTerakhir(
      [],
      ID_TENANT,
    );

    expect(hasil).toEqual({});
    expect(groupByMock).not.toHaveBeenCalled();
  });

  it("mengambil waktu kegiatan terakhir per prospek dan membuang baris kosong", async () => {
    const terakhir = new Date("2026-09-20T08:00:00.000Z");
    groupByMock.mockResolvedValue([
      { prospekId: "p-1", _max: { waktuMulai: terakhir } },
      { prospekId: null, _max: { waktuMulai: terakhir } },
      { prospekId: "p-2", _max: { waktuMulai: null } },
    ] as never);

    const hasil = await new RingkasanSalesRepository().waktuKegiatanTerakhir(
      ["p-1", "p-2"],
      ID_TENANT,
    );

    expect(groupByMock).toHaveBeenCalledWith({
      by: ["prospekId"],
      where: { prospekId: { in: ["p-1", "p-2"] }, tenantId: ID_TENANT },
      _max: { waktuMulai: true },
    });
    expect(hasil).toEqual({ "p-1": terakhir });
  });

  it("menolak tenant kosong walau daftar prospek terisi", async () => {
    await expect(
      new RingkasanSalesRepository().waktuKegiatanTerakhir(["p-1"], ""),
    ).rejects.toBeInstanceOf(TenantContextError);
  });
});
