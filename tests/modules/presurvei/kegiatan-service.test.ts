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
  namaSales: null,
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
  hitungPerUser: vi.fn().mockResolvedValue({}),
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

  it("mewariskan lokasi, iklan, dan site kunjungan ke prospeknya", async () => {
    // Prospek yang lahir dari kunjungan harus membawa koordinat kunjungan itu.
    // Tanpa test ini, lat/lng yang tertukar atau fallback yang hilang tidak
    // akan tertangkap apa pun.
    const service = new KegiatanService(repository);

    await service.catat({
      ...masukanKunjungan,
      hasil: "TERTARIK",
      iklanId: "iklan-1",
      siteId: "site-1",
      prospekBaru: {
        nama: "Budi",
        noTelp: "081234567890",
        alamat: "Jl. Merdeka 10",
        email: "budi@contoh.id",
        paketDiminati: "20 Mbps",
      },
    });

    const [, prospekDibuat] = vi.mocked(repository.createDenganProspek).mock
      .calls[0];
    expect(prospekDibuat).toEqual({
      nama: "Budi",
      noTelp: "081234567890",
      alamat: "Jl. Merdeka 10",
      email: "budi@contoh.id",
      paketDiminati: "20 Mbps",
      latitude: -6.2,
      longitude: 106.8,
      sumber: "LAPANGAN",
      iklanId: "iklan-1",
      pemilikId: "user-1",
      siteId: "site-1",
    });
  });

  it("tidak membuat prospek saat hasilnya belum berminat meski datanya lengkap", async () => {
    // Mengisolasi cabang `isHasilMelahirkanProspek`: data prospek sengaja
    // disertakan supaya satu-satunya alasan penolakan adalah hasilnya.
    const service = new KegiatanService(repository);

    const hasil = await service.catat({
      ...masukanKunjungan,
      hasil: "TIDAK_MINAT",
      prospekBaru: {
        nama: "Budi",
        noTelp: "081234567890",
        alamat: "Jl. Merdeka 10",
      },
    });

    expect(repository.create).toHaveBeenCalledOnce();
    expect(repository.createDenganProspek).not.toHaveBeenCalled();
    expect(hasil.prospek).toBeNull();
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

  it("tidak membuat prospek otomatis dari kegiatan telepon meski berminat", async () => {
    // Hanya kegiatan lapangan yang sumbernya pasti LAPANGAN (spec §6.1).
    // Telepon dan chat tidak punya nilai enum yang tepat, jadi menebaknya
    // berarti atribusi sumber yang salah dan tidak bisa dibetulkan lagi —
    // sales membuat prospeknya lewat POST /api/presurvei/prospek.
    const service = new KegiatanService(repository);

    const hasil = await service.catat({
      jenis: "TELEPON",
      userId: "user-1",
      waktuMulai: WAKTU_KUNJUNGAN,
      hasil: "TERTARIK",
      prospekBaru: {
        nama: "Budi",
        noTelp: "081234567890",
        alamat: "Jl. Merdeka 10",
      },
    });

    expect(repository.create).toHaveBeenCalledOnce();
    expect(repository.createDenganProspek).not.toHaveBeenCalled();
    expect(hasil.prospek).toBeNull();
  });

  it("tidak membuat prospek otomatis dari kegiatan chat maupun iklan", async () => {
    const service = new KegiatanService(repository);

    await service.catat({
      jenis: "CHAT",
      userId: "user-1",
      waktuMulai: WAKTU_KUNJUNGAN,
      hasil: "DEAL",
      prospekBaru: {
        nama: "Budi",
        noTelp: "081234567890",
        alamat: "Jl. Merdeka 10",
      },
    });
    await service.catat({
      jenis: "IKLAN",
      userId: "user-1",
      iklanId: "iklan-1",
      waktuMulai: WAKTU_KUNJUNGAN,
      hasil: "DEAL",
      prospekBaru: {
        nama: "Budi",
        noTelp: "081234567890",
        alamat: "Jl. Merdeka 10",
      },
    });

    expect(repository.create).toHaveBeenCalledTimes(2);
    expect(repository.createDenganProspek).not.toHaveBeenCalled();
  });

  it("mengupas prospekBaru sebelum meneruskan kegiatan ke repository", async () => {
    // `prospekBaru` bukan kolom Prisma. Kalau suatu refactor meneruskan `input`
    // utuh, Prisma menolak dengan "Unknown argument `prospekBaru`" di runtime
    // sementara seluruh test lain tetap hijau.
    const service = new KegiatanService(repository);

    await service.catat({
      ...masukanKunjungan,
      hasil: "TIDAK_MINAT",
      prospekBaru: {
        nama: "Budi",
        noTelp: "081234567890",
        alamat: "Jl. Merdeka 10",
      },
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ prospekBaru: expect.anything() }),
    );
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

  it("mengembalikan kegiatan saat pemilik wajibnya cocok", async () => {
    const repository = bangunRepository();
    vi.mocked(repository.findById).mockResolvedValue(
      kegiatan({ userId: "user-1" }),
    );
    const service = new KegiatanService(repository);

    const hasil = await service.detail("kegiatan-1", "user-1");

    expect(hasil.id).toBe("kegiatan-1");
  });

  it("menolak 403 saat kegiatan milik sales lain", async () => {
    // Sales lapangan hanya memegang `m_presurvei:read`, jadi tanpa pengikat ini
    // ia bisa membaca laporan kunjungan seluruh tenant.
    const repository = bangunRepository();
    vi.mocked(repository.findById).mockResolvedValue(
      kegiatan({ userId: "user-lain" }),
    );
    const service = new KegiatanService(repository);

    await expect(service.detail("kegiatan-1", "user-1")).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });

  it("tidak membatasi kepemilikan saat pemilik wajib tidak diisi", async () => {
    const repository = bangunRepository();
    vi.mocked(repository.findById).mockResolvedValue(
      kegiatan({ userId: "user-lain" }),
    );
    const service = new KegiatanService(repository);

    const hasil = await service.detail("kegiatan-1");

    expect(hasil.userId).toBe("user-lain");
  });
});
