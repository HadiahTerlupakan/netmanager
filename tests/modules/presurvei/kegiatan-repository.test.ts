import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kegiatan dan prospek yang lahir darinya harus tersimpan bersama atau tidak
 * sama sekali. Kalau kegiatan tersimpan tapi prospeknya gagal, laporan sales
 * menunjukkan kunjungan berhasil tanpa prospek yang bisa di-follow-up.
 */

const transaksiTerpanggil = vi.fn();

vi.mock("@/modules/database", () => ({
  prisma: {
    presurveiKegiatan: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: (jalankan: (tx: unknown) => Promise<unknown>) => {
      transaksiTerpanggil();
      return jalankan({
        presurveiProspek: {
          create: vi.fn().mockResolvedValue({
            id: "prospek-baru",
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
          }),
        },
        presurveiKegiatan: {
          create: vi.fn().mockResolvedValue({
            id: "kegiatan-baru",
            jenis: "KUNJUNGAN",
            userId: "user-1",
            prospekId: "prospek-baru",
            iklanId: null,
            waktuMulai: new Date("2026-09-22T01:00:00.000Z"),
            waktuSelesai: null,
            latitude: -6.2,
            longitude: 106.8,
            alamatDikunjungi: "Jl. Merdeka 10",
            ditemuiNama: "Budi",
            hasil: "TERTARIK",
            catatan: null,
            fotoUrls: [],
            odpTerdekat: null,
            estimasiKabelMeter: null,
            catatanTeknis: null,
            siteId: null,
            tenantId: "tenant-1",
            createdAt: new Date("2026-09-22T01:00:00.000Z"),
            updatedAt: new Date("2026-09-22T01:00:00.000Z"),
          }),
        },
      });
    },
  },
}));

import { prisma } from "@/modules/database";
import { KegiatanRepository } from "@/modules/presurvei/repositories/KegiatanRepository";
import type { KegiatanRow } from "@/modules/presurvei/mappers/kegiatan.mapper";

// Anotasi `: KegiatanRow` wajib: tanpanya properti bernilai `null` jadi implicit
// any karena repo mematikan strictNullChecks (lihat Global Constraints).
const barisKegiatan = (over: Partial<KegiatanRow> = {}): KegiatanRow => ({
  id: "kegiatan-1",
  jenis: "KUNJUNGAN",
  userId: "user-1",
  prospekId: null,
  iklanId: null,
  waktuMulai: new Date("2026-09-22T01:00:00.000Z"),
  waktuSelesai: null,
  latitude: -6.2,
  longitude: 106.8,
  alamatDikunjungi: "Jl. Merdeka 10",
  ditemuiNama: "Budi",
  hasil: "TERTARIK",
  catatan: null,
  fotoUrls: [],
  odpTerdekat: null,
  estimasiKabelMeter: null,
  catatanTeknis: null,
  siteId: null,
  tenantId: "tenant-1",
  createdAt: new Date("2026-09-22T01:00:00.000Z"),
  updatedAt: new Date("2026-09-22T01:00:00.000Z"),
  ...over,
});

describe("KegiatanRepository.findMany", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menyaring rentang tanggal pada waktu mulai", async () => {
    vi.mocked(prisma.presurveiKegiatan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiKegiatan.count).mockResolvedValue(0 as never);

    await new KegiatanRepository().findMany({
      page: 1,
      limit: 10,
      dariTanggal: new Date("2026-09-01T00:00:00.000Z"),
      sampaiTanggal: new Date("2026-09-30T00:00:00.000Z"),
    });

    const argumen = vi.mocked(prisma.presurveiKegiatan.findMany).mock
      .calls[0][0];
    expect(argumen?.where?.waktuMulai).toEqual({
      gte: new Date("2026-09-01T00:00:00.000Z"),
      lte: new Date("2026-09-30T00:00:00.000Z"),
    });
  });

  it("mengurutkan kegiatan terbaru lebih dulu", async () => {
    vi.mocked(prisma.presurveiKegiatan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiKegiatan.count).mockResolvedValue(0 as never);

    await new KegiatanRepository().findMany({ page: 1, limit: 10 });

    const argumen = vi.mocked(prisma.presurveiKegiatan.findMany).mock
      .calls[0][0];
    expect(argumen?.orderBy).toEqual({ waktuMulai: "desc" });
  });
});

describe("KegiatanRepository.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("meneruskan masukan ke Prisma tanpa membuat prospek", async () => {
    vi.mocked(prisma.presurveiKegiatan.create).mockResolvedValue(
      barisKegiatan() as never,
    );

    const hasil = await new KegiatanRepository().create({
      jenis: "TELEPON",
      userId: "user-1",
      waktuMulai: new Date("2026-09-22T01:00:00.000Z"),
      hasil: "PERLU_FOLLOWUP",
    });

    expect(prisma.presurveiKegiatan.create).toHaveBeenCalledWith({
      data: {
        jenis: "TELEPON",
        userId: "user-1",
        waktuMulai: new Date("2026-09-22T01:00:00.000Z"),
        hasil: "PERLU_FOLLOWUP",
      },
    });
    expect(hasil.id).toBe("kegiatan-1");
  });
});

describe("KegiatanRepository.findById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mengembalikan null saat kegiatan tidak ada", async () => {
    vi.mocked(prisma.presurveiKegiatan.findUnique).mockResolvedValue(
      null as never,
    );

    expect(await new KegiatanRepository().findById("tidak-ada")).toBeNull();
  });

  it("memetakan seluruh kolom baris menjadi entitas domain", async () => {
    // Memeriksa seluruh field sekaligus: satu field yang lupa dipetakan berarti
    // hasil survei teknis hilang senyap setiap kali kegiatan dibaca.
    const baris = barisKegiatan({
      jenis: "SURVEI_LOKASI",
      prospekId: "prospek-1",
      waktuSelesai: new Date("2026-09-22T02:00:00.000Z"),
      catatan: "rumah pojok, pagar hitam",
      fotoUrls: ["https://contoh.id/a.webp"],
      odpTerdekat: "ODP-12",
      estimasiKabelMeter: 120,
      catatanTeknis: "perlu tiang tambahan",
      siteId: "site-1",
    });
    vi.mocked(prisma.presurveiKegiatan.findUnique).mockResolvedValue(
      baris as never,
    );

    const hasil = await new KegiatanRepository().findById("kegiatan-1");

    expect(hasil).toEqual({ ...baris });
  });
});

describe("KegiatanRepository.createDenganProspek", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menyimpan keduanya dalam satu transaksi dan menautkan prospek ke kegiatan", async () => {
    const hasil = await new KegiatanRepository().createDenganProspek(
      {
        jenis: "KUNJUNGAN",
        userId: "user-1",
        waktuMulai: new Date("2026-09-22T01:00:00.000Z"),
        hasil: "TERTARIK",
      },
      {
        nama: "Budi",
        noTelp: "081234567890",
        alamat: "Jl. Merdeka 10",
        sumber: "LAPANGAN",
        pemilikId: "user-1",
      },
    );

    expect(transaksiTerpanggil).toHaveBeenCalledOnce();
    expect(hasil.prospek.id).toBe("prospek-baru");
    expect(hasil.kegiatan.prospekId).toBe("prospek-baru");
  });
});
