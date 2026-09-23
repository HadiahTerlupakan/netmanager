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
import type { CalonSales } from "@/modules/presurvei/domain/penugasan-sales";
import type { ISalesRepository } from "@/modules/presurvei/domain/ports/ISalesRepository";
import { PenugasanSalesService } from "@/modules/presurvei/services/PenugasanSalesService";

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
      // periodeTahun/periodeBulan disertakan, bukan cuma userId dan
      // pencapaian: keduanya diteruskan dari baris target (2026/9, dua angka
      // berbeda), dan tertukarnya lolos toMatchObject yang lama karena
      // keduanya tidak pernah diperiksa sama sekali.
      periodeTahun: 2026,
      periodeBulan: 9,
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
    // [].map() juga menghasilkan [], jadi toEqual([]) saja tidak menangkap
    // penjaga `if (target.length === 0) return []` yang terhapus. Yang
    // hilang justru gunanya: tanpa penjaga, tiga query groupBy tetap
    // ditembakkan padahal tidak ada target sama sekali.
    expect(kegiatanRepo.hitungPerUser).not.toHaveBeenCalled();
  });
});

describe("TargetService.tetapkan", () => {
  const TENANT_SESI = "tenant-sesi";
  const TENANT_LAIN = "tenant-lain";

  // Dibekukan: tanpa ini, `masukan` adalah referensi yang sama dengan yang
  // diteruskan ke service, sehingga mutasi in-place (mis. service mengubah
  // input.targetKonversi sebelum meneruskannya) membandingkan objek dengan
  // dirinya sendiri dan lolos hijau meski isinya sudah diubah.
  const masukan = Object.freeze({
    userId: "sales-1",
    periodeTahun: 2026,
    periodeBulan: 9,
    targetKunjungan: 20,
    targetProspek: 10,
    targetKonversi: 5,
  });

  const calon = (ubahan: Partial<CalonSales> = {}): CalonSales => ({
    id: "sales-1",
    tenantId: TENANT_SESI,
    isSales: true,
    isActive: true,
    ...ubahan,
  });

  let targetRepo: ITargetRepository;
  let salesRepo: ISalesRepository;

  beforeEach(() => {
    targetRepo = bangunTargetRepo();
    salesRepo = {
      daftarAktif: vi.fn(),
      cariCalonSales: vi.fn().mockResolvedValue(calon()),
    };
  });

  const service = () =>
    new TargetService(
      targetRepo,
      bangunKegiatanRepo(),
      bangunProspekRepo(),
      new PenugasanSalesService(salesRepo),
    );

  it("meneruskan masukan apa adanya ke repository, ditambah tenant sesi", async () => {
    await service().tetapkan(masukan, TENANT_SESI);

    // Memeriksa argumennya, bukan sekadar bahwa repository terpanggil: nama
    // test ini menjanjikan "apa adanya", dan angka-angkanya bersebelahan serta
    // bertipe sama sehingga tertukarnya tidak akan ditolak compiler.
    expect(targetRepo.simpan).toHaveBeenCalledWith({
      userId: "sales-1",
      periodeTahun: 2026,
      periodeBulan: 9,
      targetKunjungan: 20,
      targetProspek: 10,
      targetKonversi: 5,
      tenantId: TENANT_SESI,
    });
  });

  it("mencari target yang sudah ada di tenant baris, bukan lintas tenant", async () => {
    await service().tetapkan(masukan, TENANT_SESI);

    expect(targetRepo.findByUserPeriode).toHaveBeenCalledWith(
      "sales-1",
      { tahun: 2026, bulan: 9 },
      TENANT_SESI,
    );
  });

  it("menolak sales dari tenant lain tanpa menyimpan apa pun", async () => {
    vi.mocked(salesRepo.cariCalonSales).mockResolvedValue(
      calon({ tenantId: TENANT_LAIN }),
    );

    await expect(
      service().tetapkan(masukan, TENANT_SESI),
    ).rejects.toMatchObject({ statusCode: 422, code: "SALES_TIDAK_SAH" });
    expect(targetRepo.simpan).not.toHaveBeenCalled();
  });

  it("menolak user yang bukan sales", async () => {
    vi.mocked(salesRepo.cariCalonSales).mockResolvedValue(
      calon({ isSales: false }),
    );

    await expect(
      service().tetapkan(masukan, TENANT_SESI),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(targetRepo.simpan).not.toHaveBeenCalled();
  });

  it("menolak target BARU untuk sales nonaktif", async () => {
    vi.mocked(salesRepo.cariCalonSales).mockResolvedValue(
      calon({ isActive: false }),
    );

    await expect(
      service().tetapkan(masukan, TENANT_SESI),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(targetRepo.simpan).not.toHaveBeenCalled();
  });

  it("tetap mengizinkan mengubah target yang sudah ada milik sales yang kini nonaktif", async () => {
    // Layar target mode ubah mengunci sales dari barisnya
    // (`app/admin/presurvei/target/targetFormState.ts`), jadi sales yang
    // dinonaktifkan di tengah bulan tetap harus bisa dikoreksi targetnya.
    vi.mocked(salesRepo.cariCalonSales).mockResolvedValue(
      calon({ isActive: false }),
    );
    vi.mocked(targetRepo.findByUserPeriode).mockResolvedValue(target());

    await service().tetapkan(masukan, TENANT_SESI);

    expect(targetRepo.simpan).toHaveBeenCalledWith({
      ...masukan,
      tenantId: TENANT_SESI,
    });
  });

  it("super admin tanpa tenant sesi menulis tenant milik sales itu secara eksplisit", async () => {
    vi.mocked(salesRepo.cariCalonSales).mockResolvedValue(
      calon({ tenantId: TENANT_LAIN }),
    );

    await service().tetapkan(masukan, null);

    expect(targetRepo.findByUserPeriode).toHaveBeenCalledWith(
      "sales-1",
      { tahun: 2026, bulan: 9 },
      TENANT_LAIN,
    );
    expect(targetRepo.simpan).toHaveBeenCalledWith({
      ...masukan,
      tenantId: TENANT_LAIN,
    });
  });

  it("super admin tanpa tenant sesi ditolak untuk user tak dikenal", async () => {
    vi.mocked(salesRepo.cariCalonSales).mockResolvedValue(null);

    await expect(service().tetapkan(masukan, null)).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(targetRepo.simpan).not.toHaveBeenCalled();
  });
});

describe("TargetService.ambilPeriode", () => {
  it("meneruskan periode ke repository dan mengembalikan hasilnya apa adanya", async () => {
    const targetRepo = bangunTargetRepo();
    const daftarTarget = [target({ userId: "sales-2" })];
    vi.mocked(targetRepo.findByPeriode).mockResolvedValue(daftarTarget);

    const service = new TargetService(
      targetRepo,
      bangunKegiatanRepo(),
      bangunProspekRepo(),
    );

    const hasil = await service.ambilPeriode({ tahun: 2026, bulan: 9 });

    expect(targetRepo.findByPeriode).toHaveBeenCalledWith({
      tahun: 2026,
      bulan: 9,
    });
    // Identitas referensi (toBe), bukan toEqual: mengganti implementasi
    // dengan `return [];` tetap punya bentuk array yang valid, tapi ini
    // membuktikan hasilnya benar-benar nilai yang dikembalikan repository.
    expect(hasil).toBe(daftarTarget);
  });
});
