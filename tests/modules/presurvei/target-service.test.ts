import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Laporan pencapaian menggabungkan tiga sumber angka yang dihitung terpisah.
 * Yang paling mudah salah adalah batas periodenya: satu hari meleset berarti
 * kegiatan tanggal 1 atau tanggal terakhir hilang dari laporan bulan itu.
 */

import { TargetService } from "@/modules/presurvei/services/TargetService";
import type { ITargetRepository } from "@/modules/presurvei/domain/ports/ITargetRepository";
import type { IKegiatanRepository } from "@/modules/presurvei/domain/ports/IKegiatanRepository";
import type { IProspekRepository } from "@/modules/presurvei/domain/ports/IProspekRepository";
import type { TargetEntity } from "@/modules/presurvei/domain/entities/Target";

const WAKTU = new Date("2026-09-01T00:00:00.000Z");

const target = (over: Partial<TargetEntity> = {}): TargetEntity =>
  ({
    id: "target-1",
    userId: "sales-1",
    periodeTahun: 2026,
    periodeBulan: 9,
    targetKunjungan: 20,
    targetProspek: 10,
    targetKonversi: 5,
    tenantId: "tenant-1",
    createdAt: WAKTU,
    updatedAt: WAKTU,
    ...over,
  }) as TargetEntity;

const bangunTargetRepo = (): ITargetRepository => ({
  findByPeriode: vi.fn().mockResolvedValue([target()]),
  findByUserPeriode: vi.fn().mockResolvedValue(null),
  simpan: vi.fn().mockResolvedValue(target()),
});

const bangunKegiatanRepo = () =>
  ({
    hitungPerUser: vi.fn().mockResolvedValue({ "sales-1": 10 }),
  }) as unknown as IKegiatanRepository;

const bangunProspekRepo = () =>
  ({
    hitungBaruPerUser: vi.fn().mockResolvedValue({ "sales-1": 5 }),
    hitungKonversiPerUser: vi.fn().mockResolvedValue({ "sales-1": 1 }),
  }) as unknown as IProspekRepository;

describe("TargetService.laporanPencapaian", () => {
  let targetRepo: ITargetRepository;
  let kegiatanRepo: IKegiatanRepository;
  let prospekRepo: IProspekRepository;

  beforeEach(() => {
    targetRepo = bangunTargetRepo();
    kegiatanRepo = bangunKegiatanRepo();
    prospekRepo = bangunProspekRepo();
  });

  const service = () =>
    new TargetService(targetRepo, kegiatanRepo, prospekRepo);

  it("menggabungkan target dengan realisasi tiap sales", async () => {
    const hasil = await service().laporanPencapaian({ tahun: 2026, bulan: 9 });

    expect(hasil).toHaveLength(1);
    expect(hasil[0]).toMatchObject({
      userId: "sales-1",
      pencapaian: {
        kunjungan: { target: 20, tercapai: 10, persen: 50 },
        prospek: { target: 10, tercapai: 5, persen: 50 },
        konversi: { target: 5, tercapai: 1, persen: 20 },
      },
    });
  });

  it("memakai rentang yang mencakup seluruh hari pada bulan itu", async () => {
    await service().laporanPencapaian({ tahun: 2026, bulan: 9 });

    const rentang = vi.mocked(kegiatanRepo.hitungPerUser).mock.calls[0][0];
    expect(rentang.mulai.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    // September berakhir tanggal 30; batas atasnya harus mencakup detik
    // terakhir hari itu, bukan tengah malam yang memotong satu hari penuh.
    expect(rentang.selesai.toISOString()).toBe("2026-09-30T23:59:59.999Z");
  });

  it("menangani Desember dengan menyeberang ke tahun berikutnya", async () => {
    await service().laporanPencapaian({ tahun: 2026, bulan: 12 });

    const rentang = vi.mocked(kegiatanRepo.hitungPerUser).mock.calls[0][0];
    expect(rentang.selesai.toISOString()).toBe("2026-12-31T23:59:59.999Z");
  });

  it("menangani Februari tahun kabisat", async () => {
    await service().laporanPencapaian({ tahun: 2028, bulan: 2 });

    const rentang = vi.mocked(kegiatanRepo.hitungPerUser).mock.calls[0][0];
    expect(rentang.selesai.toISOString()).toBe("2028-02-29T23:59:59.999Z");
  });

  it("melaporkan nol realisasi untuk sales yang belum bergerak", async () => {
    vi.mocked(kegiatanRepo.hitungPerUser).mockResolvedValue({});
    vi.mocked(prospekRepo.hitungBaruPerUser).mockResolvedValue({});
    vi.mocked(prospekRepo.hitungKonversiPerUser).mockResolvedValue({});

    const hasil = await service().laporanPencapaian({ tahun: 2026, bulan: 9 });

    expect(hasil[0].pencapaian.kunjungan.tercapai).toBe(0);
    expect(hasil[0].pencapaian.kunjungan.persen).toBe(0);
  });

  it("mengembalikan daftar kosong saat belum ada target ditetapkan", async () => {
    vi.mocked(targetRepo.findByPeriode).mockResolvedValue([]);

    expect(
      await service().laporanPencapaian({ tahun: 2026, bulan: 9 }),
    ).toEqual([]);
  });
});

describe("TargetService.tetapkan", () => {
  it("meneruskan masukan apa adanya ke repository", async () => {
    const targetRepo = bangunTargetRepo();
    const service = new TargetService(
      targetRepo,
      bangunKegiatanRepo(),
      bangunProspekRepo(),
    );

    const masukan = {
      userId: "sales-1",
      periodeTahun: 2026,
      periodeBulan: 9,
      targetKunjungan: 20,
      targetProspek: 10,
      targetKonversi: 5,
    };

    await service.tetapkan(masukan);

    // Memeriksa argumennya, bukan sekadar bahwa repository terpanggil: nama
    // test ini menjanjikan "apa adanya", dan angka-angkanya bersebelahan serta
    // bertipe sama sehingga tertukarnya tidak akan ditolak compiler.
    expect(targetRepo.simpan).toHaveBeenCalledWith(masukan);
  });
});
