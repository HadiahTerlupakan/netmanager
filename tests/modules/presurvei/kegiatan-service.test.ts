import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kunjungan yang membuahkan minat harus langsung melahirkan prospek. Kalau
 * tidak, sales harus mengetik ulang data yang sama dan prospeknya sering tidak
 * pernah dibuat — kunjungan berhasil pun hilang jejaknya.
 */

import { KegiatanService } from "@/modules/presurvei/services/KegiatanService";
import type { IKegiatanRepository } from "@/modules/presurvei/domain/ports/IKegiatanRepository";
import type { KegiatanEntity } from "@/modules/presurvei/domain/entities/Kegiatan";
import type { ProspekEntity } from "@/modules/presurvei/domain/entities/Prospek";

const WAKTU_KUNJUNGAN = new Date("2026-09-22T01:00:00.000Z");

const kegiatan = (over: Partial<KegiatanEntity> = {}): KegiatanEntity => ({
  id: "kegiatan-1",
  jenis: "KUNJUNGAN",
  userId: "user-1",
  prospekId: null,
  iklanId: null,
  waktuMulai: WAKTU_KUNJUNGAN,
  waktuSelesai: null,
  latitude: -6.2,
  longitude: 106.8,
  alamatDikunjungi: "Jl. Merdeka 10",
  ditemuiNama: "Budi",
  hasil: "PERLU_FOLLOWUP",
  catatan: null,
  fotoUrls: [],
  odpTerdekat: null,
  estimasiKabelMeter: null,
  catatanTeknis: null,
  siteId: null,
  tenantId: "tenant-1",
  createdAt: WAKTU_KUNJUNGAN,
  updatedAt: WAKTU_KUNJUNGAN,
  ...over,
});

const prospek = (over: Partial<ProspekEntity> = {}): ProspekEntity =>
  ({
    id: "prospek-1",
    nama: "Budi",
    noTelp: "081234567890",
    alamat: "Jl. Merdeka 10",
    sumber: "LAPANGAN",
    status: "BARU",
    pemilikId: "user-1",
    tenantId: "tenant-1",
    createdAt: WAKTU_KUNJUNGAN,
    updatedAt: WAKTU_KUNJUNGAN,
    ...over,
  }) as ProspekEntity;

const bangunRepository = (): IKegiatanRepository => ({
  findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  findById: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue(kegiatan()),
  createDenganProspek: vi
    .fn()
    .mockResolvedValue({ kegiatan: kegiatan(), prospek: prospek() }),
});

const masukanKunjungan = {
  jenis: "KUNJUNGAN" as const,
  userId: "user-1",
  waktuMulai: WAKTU_KUNJUNGAN,
  latitude: -6.2,
  longitude: 106.8,
  alamatDikunjungi: "Jl. Merdeka 10",
  ditemuiNama: "Budi",
  hasil: "PERLU_FOLLOWUP" as const,
};

describe("KegiatanService.catat", () => {
  let repository: IKegiatanRepository;

  beforeEach(() => {
    repository = bangunRepository();
  });

  it("menyimpan kegiatan saja saat hasilnya belum menunjukkan minat", async () => {
    const service = new KegiatanService(repository);

    await service.catat(masukanKunjungan);

    expect(repository.create).toHaveBeenCalledOnce();
    expect(repository.createDenganProspek).not.toHaveBeenCalled();
  });

  it("membuat prospek saat hasilnya TERTARIK dan data prospek disertakan", async () => {
    const service = new KegiatanService(repository);

    const hasil = await service.catat({
      ...masukanKunjungan,
      hasil: "TERTARIK",
      prospekBaru: {
        nama: "Budi",
        noTelp: "081234567890",
        alamat: "Jl. Merdeka 10",
      },
    });

    expect(repository.createDenganProspek).toHaveBeenCalledOnce();
    expect(hasil.prospek?.id).toBe("prospek-1");
  });

  it("menurunkan sumber prospek dari jenis kegiatan lapangan", async () => {
    const service = new KegiatanService(repository);

    await service.catat({
      ...masukanKunjungan,
      hasil: "DEAL",
      prospekBaru: {
        nama: "Budi",
        noTelp: "081234567890",
        alamat: "Jl. Merdeka 10",
      },
    });

    const [, prospekDibuat] = vi.mocked(repository.createDenganProspek).mock
      .calls[0];
    expect(prospekDibuat).toMatchObject({
      sumber: "LAPANGAN",
      pemilikId: "user-1",
    });
  });

  it("tetap menyimpan kegiatan tanpa prospek saat data prospek tidak disertakan", async () => {
    const service = new KegiatanService(repository);

    const hasil = await service.catat({
      ...masukanKunjungan,
      hasil: "TERTARIK",
    });

    expect(repository.create).toHaveBeenCalledOnce();
    expect(repository.createDenganProspek).not.toHaveBeenCalled();
    expect(hasil.prospek).toBeNull();
  });

  it("tidak membuat prospek baru saat kegiatan sudah menempel ke prospek lama", async () => {
    const service = new KegiatanService(repository);

    await service.catat({
      ...masukanKunjungan,
      hasil: "TERTARIK",
      prospekId: "prospek-lama",
      prospekBaru: {
        nama: "Budi",
        noTelp: "081234567890",
        alamat: "Jl. Merdeka 10",
      },
    });

    expect(repository.create).toHaveBeenCalledOnce();
    expect(repository.createDenganProspek).not.toHaveBeenCalled();
  });
});

describe("KegiatanService.detail", () => {
  it("melempar 404 saat kegiatan tidak ditemukan", async () => {
    const service = new KegiatanService(bangunRepository());

    await expect(service.detail("tidak-ada")).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });
});
