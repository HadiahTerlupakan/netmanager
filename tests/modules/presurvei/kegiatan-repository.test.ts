import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

/**
 * Kegiatan dan prospek yang lahir darinya harus tersimpan bersama atau tidak
 * sama sekali. Kalau kegiatan tersimpan tapi prospeknya gagal, laporan sales
 * menunjukkan kunjungan berhasil tanpa prospek yang bisa di-follow-up.
 */

// Mock transaksi hidup di scope modul lewat `vi.hoisted`, bukan dibuat di dalam
// factory `vi.mock`. Versi sebelumnya membuatnya di dalam factory, sehingga
// argumen `create` mustahil diperiksa dari luar: yang bisa diasersikan hanyalah
// nilai yang mock itu sendiri tanam — dan `prospekId` tetap hijau meski
// tautannya dihapus dari implementasi.
const {
  transaksiTerpanggil,
  buatProspekDalamTransaksi,
  buatKegiatanDalamTransaksi,
} = vi.hoisted(() => ({
  transaksiTerpanggil: vi.fn(),
  buatProspekDalamTransaksi: vi.fn(),
  buatKegiatanDalamTransaksi: vi.fn(),
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    presurveiKegiatan: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      groupBy: vi.fn(),
    },
    $transaction: (jalankan: (tx: unknown) => Promise<unknown>) => {
      transaksiTerpanggil();
      return jalankan({
        presurveiProspek: { create: buatProspekDalamTransaksi },
        presurveiKegiatan: { create: buatKegiatanDalamTransaksi },
      });
    },
  },
}));

import { prisma } from "@/modules/database";
import { KegiatanRepository } from "@/modules/presurvei/repositories/KegiatanRepository";
import type { KegiatanRow } from "@/modules/presurvei/mappers/kegiatan.mapper";
import type { ProspekRow } from "@/modules/presurvei/mappers/prospek.mapper";

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

const barisProspek = (over: Partial<ProspekRow> = {}): ProspekRow => ({
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

  it("memakai batas bawah saja saat hanya dariTanggal diisi", async () => {
    vi.mocked(prisma.presurveiKegiatan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiKegiatan.count).mockResolvedValue(0 as never);

    await new KegiatanRepository().findMany({
      page: 1,
      limit: 10,
      dariTanggal: new Date("2026-09-01T00:00:00.000Z"),
    });

    const argumen = vi.mocked(prisma.presurveiKegiatan.findMany).mock
      .calls[0][0];
    expect(argumen?.where?.waktuMulai).toEqual({
      gte: new Date("2026-09-01T00:00:00.000Z"),
    });
  });

  it("memakai batas atas saja saat hanya sampaiTanggal diisi", async () => {
    vi.mocked(prisma.presurveiKegiatan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiKegiatan.count).mockResolvedValue(0 as never);

    await new KegiatanRepository().findMany({
      page: 1,
      limit: 10,
      sampaiTanggal: new Date("2026-09-30T00:00:00.000Z"),
    });

    const argumen = vi.mocked(prisma.presurveiKegiatan.findMany).mock
      .calls[0][0];
    expect(argumen?.where?.waktuMulai).toEqual({
      lte: new Date("2026-09-30T00:00:00.000Z"),
    });
  });

  it("menggabungkan filter sederhana dan rentang tanggal sekaligus", async () => {
    // Tiap filter tunggal sudah punya testnya sendiri, tapi itu tidak menangkap
    // penggabungan yang saling menimpa — satu key yang hilang saat di-spread
    // hanya terlihat ketika beberapa filter dipakai bersamaan.
    vi.mocked(prisma.presurveiKegiatan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiKegiatan.count).mockResolvedValue(0 as never);

    await new KegiatanRepository().findMany({
      page: 1,
      limit: 10,
      userId: "user-1",
      jenis: "SURVEI_LOKASI",
      hasil: "TERTARIK",
      prospekId: "prospek-1",
      dariTanggal: new Date("2026-09-01T00:00:00.000Z"),
      sampaiTanggal: new Date("2026-09-30T00:00:00.000Z"),
    });

    const argumen = vi.mocked(prisma.presurveiKegiatan.findMany).mock
      .calls[0][0];
    expect(argumen?.where).toEqual({
      userId: "user-1",
      jenis: "SURVEI_LOKASI",
      hasil: "TERTARIK",
      prospekId: "prospek-1",
      waktuMulai: {
        gte: new Date("2026-09-01T00:00:00.000Z"),
        lte: new Date("2026-09-30T00:00:00.000Z"),
      },
    });
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
  const prospekTersimpan = barisProspek();

  const masukanKegiatan = {
    jenis: "KUNJUNGAN" as const,
    userId: "user-1",
    waktuMulai: new Date("2026-09-22T01:00:00.000Z"),
    hasil: "TERTARIK" as const,
  };

  const masukanProspek = {
    nama: "Budi",
    noTelp: "081234567890",
    alamat: "Jl. Merdeka 10",
    sumber: "LAPANGAN" as const,
    pemilikId: "user-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    buatProspekDalamTransaksi.mockResolvedValue(prospekTersimpan);
    buatKegiatanDalamTransaksi.mockResolvedValue(
      barisKegiatan({
        id: "kegiatan-baru",
        prospekId: prospekTersimpan.id,
      }),
    );
  });

  it("menyimpan keduanya dalam satu transaksi", async () => {
    const hasil = await new KegiatanRepository().createDenganProspek(
      masukanKegiatan,
      masukanProspek,
    );

    expect(transaksiTerpanggil).toHaveBeenCalledOnce();
    expect(buatProspekDalamTransaksi).toHaveBeenCalledWith({
      data: masukanProspek,
    });
    expect(hasil.prospek.id).toBe(prospekTersimpan.id);
  });

  it("menautkan kegiatan ke prospek yang baru saja dibuat", async () => {
    // Invarian unggulan modul ini: `prospekId` yang dikirim ke Prisma harus id
    // prospek yang baru lahir, bukan nilai yang ditanam mock. Assertion ini
    // memeriksa ARGUMEN `create`, sehingga menghapus tautan `prospekId` dari
    // repository membuatnya merah.
    await new KegiatanRepository().createDenganProspek(
      masukanKegiatan,
      masukanProspek,
    );

    expect(buatKegiatanDalamTransaksi).toHaveBeenCalledWith({
      data: expect.objectContaining({ prospekId: prospekTersimpan.id }),
    });
  });

  it("mengembalikan kegiatan yang sudah tertaut ke prospeknya", async () => {
    const hasil = await new KegiatanRepository().createDenganProspek(
      masukanKegiatan,
      masukanProspek,
    );

    expect(hasil.kegiatan.prospekId).toBe(prospekTersimpan.id);
  });
});

describe("KegiatanRepository.hitungPerUser", () => {
  // Tipe `groupBy` Prisma memicu TS2615 (circular reference) begitu
  // `vi.mocked()` mencoba menyelesaikan tipe parameternya secara penuh —
  // isu yang sudah didokumentasikan di tests/setup.ts untuk model lain.
  // Cast ke `Mock` generik di sini mengikuti mitigasi yang sama.
  const groupByMock = prisma.presurveiKegiatan.groupBy as unknown as Mock;

  beforeEach(() => vi.clearAllMocks());

  const RENTANG = {
    mulai: new Date("2026-09-01T00:00:00.000Z"),
    selesai: new Date("2026-09-30T23:59:59.999Z"),
  };

  it("mengirim query groupBy terkunci pada waktuMulai, gte/lte, dan userId", async () => {
    // Seluruh argumen dibandingkan sekaligus, bukan hanya sebagian: itu
    // satu-satunya cara menangkap gte/lte yang berubah jadi gt/lt, klausa
    // where yang hilang, atau by yang bergeser ke kolom lain — ketiganya
    // lolos tanpa test sama sekali sebelum ini.
    groupByMock.mockResolvedValue([]);

    await new KegiatanRepository().hitungPerUser(RENTANG);

    expect(groupByMock.mock.calls[0][0]).toEqual({
      by: ["userId"],
      where: {
        waktuMulai: { gte: RENTANG.mulai, lte: RENTANG.selesai },
      },
      _count: { _all: true },
    });
  });

  it("memetakan hasil groupBy menjadi Record berkunci userId", async () => {
    groupByMock.mockResolvedValue([
      { userId: "user-1", _count: { _all: 7 } },
      { userId: "user-2", _count: { _all: 3 } },
    ]);

    const hasil = await new KegiatanRepository().hitungPerUser(RENTANG);

    expect(hasil).toEqual({ "user-1": 7, "user-2": 3 });
  });
});
