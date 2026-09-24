import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({ logError: vi.fn() }));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: palsu.logError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

/**
 * Kunjungan yang membuahkan minat harus langsung melahirkan prospek. Kalau
 * tidak, sales harus mengetik ulang data yang sama dan prospeknya sering tidak
 * pernah dibuat — kunjungan berhasil pun hilang jejaknya.
 */

import { KegiatanService } from "@/modules/presurvei/services/KegiatanService";
import type { IKegiatanRepository } from "@/modules/presurvei/domain/ports/IKegiatanRepository";
import type { KegiatanEntity } from "@/modules/presurvei/domain/entities/Kegiatan";
import type { RiwayatKegiatanEntity } from "@/modules/presurvei/domain/entities/KegiatanRiwayat";
import type { PengumumPerubahanKegiatan } from "@/modules/presurvei/services/KegiatanService";
import type { ProspekEntity } from "@/modules/presurvei/domain/entities/Prospek";

const WAKTU_KUNJUNGAN = new Date("2026-09-22T01:00:00.000Z");

const kegiatan = (over: Partial<KegiatanEntity> = {}): KegiatanEntity => ({
  id: "kegiatan-1",
  jenis: "KUNJUNGAN",
  userId: "user-1",
  namaSales: null,
  peranPelaku: null,
  departemenPelaku: null,
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
  hitungUntukUser: vi.fn().mockResolvedValue(0),
  ubahDenganRiwayat: vi.fn().mockResolvedValue(null),
  findRiwayat: vi.fn().mockResolvedValue([]),
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

describe("KegiatanService.rincian", () => {
  it("mengikat kepemilikan yang sama dengan detail", async () => {
    const repository = bangunRepository();
    vi.mocked(repository.findById).mockResolvedValue(
      kegiatan({ userId: "user-lain" }),
    );
    const service = new KegiatanService(repository);

    await expect(service.rincian("kegiatan-1", "user-1")).rejects.toMatchObject(
      { statusCode: 403 },
    );
    expect(repository.findRiwayat).not.toHaveBeenCalled();
  });

  it("mengembalikan kegiatan beserta riwayatnya", async () => {
    const repository = bangunRepository();
    const tersimpan = kegiatan();
    const riwayat: RiwayatKegiatanEntity[] = [
      {
        id: "riwayat-1",
        kegiatanId: "kegiatan-1",
        tenantId: "tenant-1",
        diubahOlehId: "admin-3",
        namaPengubah: "Admin Tiga",
        diubahPada: WAKTU_KUNJUNGAN,
        perubahan: { catatan: { dari: null, ke: "Isi" } },
      },
    ];
    vi.mocked(repository.findById).mockResolvedValue(tersimpan);
    vi.mocked(repository.findRiwayat).mockResolvedValue(riwayat);

    const hasil = await new KegiatanService(repository).rincian("kegiatan-1");

    expect(repository.findRiwayat).toHaveBeenCalledWith("kegiatan-1");
    expect(hasil).toEqual({ kegiatan: tersimpan, riwayat });
  });
});

describe("KegiatanService.ubah", () => {
  const VERSI = new Date("2026-09-22T04:00:00.000Z");
  const tersimpan = (): KegiatanEntity =>
    kegiatan({
      userId: "sales-1",
      catatan: "Catatan lama",
      ditemuiNama: "Bu Rina",
      hasil: "TERTARIK",
      tenantId: "tenant-7",
      updatedAt: VERSI,
    });

  let repository: IKegiatanRepository;
  let umumkan: ReturnType<typeof vi.fn<PengumumPerubahanKegiatan>>;
  let service: KegiatanService;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = bangunRepository();
    vi.mocked(repository.findById).mockResolvedValue(tersimpan());
    vi.mocked(repository.ubahDenganRiwayat).mockResolvedValue(
      kegiatan({ catatan: "Catatan baru", hasil: "DEAL" }),
    );
    umumkan = vi.fn<PengumumPerubahanKegiatan>().mockResolvedValue(undefined);
    service = new KegiatanService(repository, umumkan);
  });

  it("melempar 404 saat kegiatan tidak ada", async () => {
    vi.mocked(repository.findById).mockResolvedValue(null);

    await expect(
      service.ubah("tidak-ada", { catatan: "x" }, { idPengubah: "admin-3" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("menolak 403 pemanggil terikat yang bukan pemilik, tanpa menulis apa pun", async () => {
    await expect(
      service.ubah(
        "kegiatan-1",
        { catatan: "Curang" },
        { idPengubah: "sales-2", pemilikWajib: "sales-2" },
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    expect(repository.ubahDenganRiwayat).not.toHaveBeenCalled();
    expect(umumkan).not.toHaveBeenCalled();
  });

  it("membiarkan pemilik terikat mengubah kegiatannya sendiri", async () => {
    await service.ubah(
      "kegiatan-1",
      { catatan: "Catatan baru" },
      { idPengubah: "sales-1", pemilikWajib: "sales-1" },
    );

    expect(repository.ubahDenganRiwayat).toHaveBeenCalledOnce();
  });

  it("membiarkan pemanggil tanpa pengikat mengubah kegiatan siapa pun", async () => {
    await service.ubah(
      "kegiatan-1",
      { catatan: "Catatan baru" },
      { idPengubah: "admin-3" },
    );

    expect(repository.ubahDenganRiwayat).toHaveBeenCalledOnce();
  });

  it("menolak 400 hasil yang melintasi batas melahirkan prospek", async () => {
    await expect(
      service.ubah(
        "kegiatan-1",
        { hasil: "PERLU_FOLLOWUP" },
        { idPengubah: "admin-3" },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message:
        "Hasil ini mengubah apakah kegiatan melahirkan prospek; catat kegiatan baru.",
    });
    expect(repository.ubahDenganRiwayat).not.toHaveBeenCalled();
  });

  it("menulis hanya medan yang berubah, dengan versi, tenant kegiatan, dan pengubah", async () => {
    await service.ubah(
      "kegiatan-1",
      { catatan: "Catatan baru", ditemuiNama: "Bu Rina", hasil: "DEAL" },
      { idPengubah: "admin-3" },
    );

    expect(repository.ubahDenganRiwayat).toHaveBeenCalledWith({
      id: "kegiatan-1",
      versi: VERSI,
      nilaiBaru: { catatan: "Catatan baru", hasil: "DEAL" },
      riwayat: {
        tenantId: "tenant-7",
        diubahOlehId: "admin-3",
        perubahan: {
          catatan: { dari: "Catatan lama", ke: "Catatan baru" },
          hasil: { dari: "TERTARIK", ke: "DEAL" },
        },
      },
    });
  });

  it("tidak menulis dan tidak mengumumkan apa pun bila tidak ada yang berubah", async () => {
    const hasil = await service.ubah(
      "kegiatan-1",
      { catatan: "Catatan lama", hasil: "TERTARIK" },
      { idPengubah: "admin-3" },
    );

    expect(repository.ubahDenganRiwayat).not.toHaveBeenCalled();
    expect(umumkan).not.toHaveBeenCalled();
    expect(hasil.kegiatan.catatan).toBe("Catatan lama");
  });

  it("menolak 409 bila kegiatan diubah pihak lain sejak dibaca", async () => {
    vi.mocked(repository.ubahDenganRiwayat).mockResolvedValue(null);

    await expect(
      service.ubah(
        "kegiatan-1",
        { catatan: "Baru" },
        { idPengubah: "admin-3" },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
      message:
        "Kegiatan ini sudah diubah orang lain. Muat ulang lalu coba lagi.",
    });
    expect(umumkan).not.toHaveBeenCalled();
  });

  it("memakai versi yang dilihat klien sebagai kunci, bukan versi bacaannya sendiri", async () => {
    // Klien membuka form pada versi lama; server sudah membaca versi yang
    // lebih baru. Kunci harus versi klien supaya tulisan orang lain di antara
    // keduanya tidak tertimpa diam-diam.
    const VERSI_KLIEN = new Date("2026-09-22T03:59:00.456Z");

    await service.ubah(
      "kegiatan-1",
      { catatan: "Catatan baru" },
      { idPengubah: "admin-3", versiDilihat: VERSI_KLIEN },
    );

    expect(repository.ubahDenganRiwayat).toHaveBeenCalledWith(
      expect.objectContaining({ versi: VERSI_KLIEN }),
    );
  });

  it("mengumumkan perubahan setelah tersimpan, dengan medan yang berubah", async () => {
    // Urutan dicatat, bukan di-`expect` di dalam mock: kegagalan pengumum
    // ditelan service (hanya di-log), jadi assertion di dalamnya tak terlihat.
    const urutan: string[] = [];
    vi.mocked(repository.ubahDenganRiwayat).mockImplementation(async () => {
      urutan.push("tulis");
      return kegiatan({ catatan: "Catatan baru", hasil: "DEAL" });
    });
    umumkan.mockImplementation(async () => {
      urutan.push("umumkan");
    });

    await service.ubah(
      "kegiatan-1",
      { catatan: "Catatan baru", hasil: "DEAL" },
      { idPengubah: "admin-3" },
    );

    expect(urutan).toEqual(["tulis", "umumkan"]);

    expect(umumkan).toHaveBeenCalledWith({
      kegiatanId: "kegiatan-1",
      pelakuId: "sales-1",
      diubahOlehId: "admin-3",
      medanBerubah: ["catatan", "hasil"],
      tenantId: "tenant-7",
    });
  });

  it("tetap berhasil dan mencatat log bila pengumuman gagal", async () => {
    umumkan.mockRejectedValue(new Error("antrian mati"));

    const hasil = await service.ubah(
      "kegiatan-1",
      { catatan: "Catatan baru" },
      { idPengubah: "admin-3" },
    );
    await new Promise((selesai) => setTimeout(selesai, 0));

    expect(hasil.kegiatan.catatan).toBe("Catatan baru");
    expect(palsu.logError).toHaveBeenCalledWith(
      expect.stringContaining("presurvei:kegiatan.updated"),
      expect.any(Error),
    );
  });

  it("mengembalikan kegiatan tersimpan beserta riwayat terbaru", async () => {
    const hasil = await service.ubah(
      "kegiatan-1",
      { catatan: "Catatan baru" },
      { idPengubah: "admin-3" },
    );

    expect(repository.findRiwayat).toHaveBeenCalledWith("kegiatan-1");
    expect(hasil.kegiatan.catatan).toBe("Catatan baru");
    expect(hasil.riwayat).toEqual([]);
  });
});
