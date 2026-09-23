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
  ubahKegiatanDalamTransaksi,
  ambilKegiatanDalamTransaksi,
  buatRiwayatDalamTransaksi,
  jejakTransaksi,
} = vi.hoisted(() => ({
  transaksiTerpanggil: vi.fn(),
  buatProspekDalamTransaksi: vi.fn(),
  buatKegiatanDalamTransaksi: vi.fn(),
  ubahKegiatanDalamTransaksi: vi.fn(),
  ambilKegiatanDalamTransaksi: vi.fn(),
  buatRiwayatDalamTransaksi: vi.fn(),
  /** Apakah callback transaksi sedang berjalan — penjaga "di dalam transaksi". */
  jejakTransaksi: { isAktif: false },
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    presurveiKegiatan: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      groupBy: vi.fn(),
    },
    presurveiKegiatanRiwayat: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: async (jalankan: (tx: unknown) => Promise<unknown>) => {
      transaksiTerpanggil();
      jejakTransaksi.isAktif = true;
      try {
        return await jalankan({
          presurveiProspek: { create: buatProspekDalamTransaksi },
          presurveiKegiatan: {
            create: buatKegiatanDalamTransaksi,
            updateMany: ubahKegiatanDalamTransaksi,
            findUnique: ambilKegiatanDalamTransaksi,
          },
          presurveiKegiatanRiwayat: { create: buatRiwayatDalamTransaksi },
        });
      } finally {
        jejakTransaksi.isAktif = false;
      }
    },
  },
}));

import { prisma } from "@/modules/database";
import { KegiatanRepository } from "@/modules/presurvei/repositories/KegiatanRepository";
import { toKegiatanListItem } from "@/modules/presurvei/dto/kegiatan.dto";
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

/**
 * `include` yang wajib ikut di setiap panggilan yang mengembalikan entitas.
 * Ditulis ulang sebagai literal, bukan diimpor dari `sertakan-sales.ts`:
 * test yang memakai konstanta yang sama tetap hijau bila konstanta itu
 * kehilangan `tenantId` — kolom yang dibutuhkan penjaga tenant di mapper.
 */
const SERTAKAN_PELAKU = {
  user: { select: { id: true, name: true, tenantId: true } },
};
const SERTAKAN_PEMILIK = {
  pemilik: { select: { id: true, name: true, tenantId: true } },
};

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

  it("menyertakan pelaku untuk nama sales di baris daftar", async () => {
    vi.mocked(prisma.presurveiKegiatan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiKegiatan.count).mockResolvedValue(0 as never);

    await new KegiatanRepository().findMany({ page: 1, limit: 10 });

    expect(
      vi.mocked(prisma.presurveiKegiatan.findMany).mock.calls[0][0]?.include,
    ).toEqual(SERTAKAN_PELAKU);
  });

  it("membawa nama pelaku satu tenant dan menyembunyikan pelaku tenant lain", async () => {
    // `include` bersarang tidak disaring ekstensi tenant. Baris tenant-1 yang
    // menunjuk user tenant-2 harus kehilangan namanya, bukan mencetak nama
    // orang dari tenant lain.
    vi.mocked(prisma.presurveiKegiatan.findMany).mockResolvedValue([
      barisKegiatan({
        id: "kegiatan-sendiri",
        user: { id: "user-1", name: "Rina", tenantId: "tenant-1" },
      }),
      barisKegiatan({
        id: "kegiatan-silang",
        userId: "user-asing",
        user: {
          name: "Orang Asing",
          id: "user-asing",
          tenantId: "tenant-2",
        },
      }),
    ] as never);
    vi.mocked(prisma.presurveiKegiatan.count).mockResolvedValue(2 as never);

    const hasil = await new KegiatanRepository().findMany({
      page: 1,
      limit: 10,
    });

    expect(hasil.items.map((item) => [item.id, item.namaSales])).toEqual([
      ["kegiatan-sendiri", "Rina"],
      ["kegiatan-silang", null],
    ]);
  });

  it("tidak meloloskan email pelaku tanpa nama ke DTO daftar", async () => {
    // Tiruan sengaja membawa `email` seolah kolom itu ikut ter-select. Label
    // cadangan wajib netral: email rekan tidak boleh terbuka bagi pemegang
    // permission presurvei yang belum tentu berhak melihatnya.
    vi.mocked(prisma.presurveiKegiatan.findMany).mockResolvedValue([
      barisKegiatan({
        user: {
          id: "user-anonim-77aa11",
          name: null,
          tenantId: "tenant-1",
          email: "bocor@t1.id",
        } as never,
      }),
    ] as never);
    vi.mocked(prisma.presurveiKegiatan.count).mockResolvedValue(1 as never);

    const hasil = await new KegiatanRepository().findMany({
      page: 1,
      limit: 10,
    });
    const dto = toKegiatanListItem(hasil.items[0]);

    expect(JSON.stringify(dto)).not.toContain("bocor@t1.id");
    expect(dto.namaSales).toBe("Tanpa nama (…77aa11)");
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
      include: SERTAKAN_PELAKU,
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
    vi.mocked(prisma.presurveiKegiatan.findUnique).mockResolvedValue({
      ...baris,
      user: {
        id: "user-tanpa-nama-9f3k2q",
        name: null,
        tenantId: "tenant-1",
      },
    } as never);

    const hasil = await new KegiatanRepository().findById("kegiatan-1");

    // `user` hasil join tidak ikut ke entitas; yang ikut hanya labelnya —
    // label netral, karena `name` null.
    expect(hasil).toEqual({ ...baris, namaSales: "Tanpa nama (…9f3k2q)" });
    expect(prisma.presurveiKegiatan.findUnique).toHaveBeenCalledWith({
      where: { id: "kegiatan-1" },
      include: SERTAKAN_PELAKU,
    });
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
      include: SERTAKAN_PEMILIK,
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
      include: SERTAKAN_PELAKU,
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

describe("KegiatanRepository.ubahDenganRiwayat", () => {
  const VERSI = new Date("2026-09-22T05:00:00.000Z");
  const masukan = Object.freeze({
    id: "kegiatan-1",
    versi: VERSI,
    nilaiBaru: { catatan: "Catatan baru", hasil: "DEAL" as const },
    riwayat: {
      tenantId: "tenant-7",
      diubahOlehId: "admin-3",
      perubahan: {
        catatan: { dari: "Catatan lama", ke: "Catatan baru" },
        hasil: { dari: "TERTARIK" as const, ke: "DEAL" as const },
      },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    ubahKegiatanDalamTransaksi.mockResolvedValue({ count: 1 });
    buatRiwayatDalamTransaksi.mockResolvedValue({ id: "riwayat-1" });
    ambilKegiatanDalamTransaksi.mockResolvedValue(
      barisKegiatan({ catatan: "Catatan baru", hasil: "DEAL" }),
    );
  });

  it("menulis kegiatan dengan penjaga versi di dalam transaksi", async () => {
    ubahKegiatanDalamTransaksi.mockImplementation(async () => {
      expect(jejakTransaksi.isAktif).toBe(true);
      return { count: 1 };
    });

    await new KegiatanRepository().ubahDenganRiwayat(masukan);

    expect(transaksiTerpanggil).toHaveBeenCalledOnce();
    expect(ubahKegiatanDalamTransaksi).toHaveBeenCalledWith({
      where: { id: "kegiatan-1", updatedAt: VERSI },
      data: { catatan: "Catatan baru", hasil: "DEAL" },
    });
    expect(prisma.presurveiKegiatan.updateMany).not.toHaveBeenCalled();
  });

  it("menulis baris riwayat di transaksi yang sama, dengan tenant dan pengubah", async () => {
    buatRiwayatDalamTransaksi.mockImplementation(async () => {
      expect(jejakTransaksi.isAktif).toBe(true);
      return { id: "riwayat-1" };
    });

    await new KegiatanRepository().ubahDenganRiwayat(masukan);

    expect(buatRiwayatDalamTransaksi).toHaveBeenCalledWith({
      data: {
        kegiatanId: "kegiatan-1",
        tenantId: "tenant-7",
        diubahOlehId: "admin-3",
        perubahan: {
          catatan: { dari: "Catatan lama", ke: "Catatan baru" },
          hasil: { dari: "TERTARIK", ke: "DEAL" },
        },
      },
    });
    expect(prisma.presurveiKegiatanRiwayat.create).not.toHaveBeenCalled();
  });

  it("mengembalikan kegiatan hasil baca ulang beserta pelakunya", async () => {
    const hasil = await new KegiatanRepository().ubahDenganRiwayat(masukan);

    expect(ambilKegiatanDalamTransaksi).toHaveBeenCalledWith({
      where: { id: "kegiatan-1" },
      include: SERTAKAN_PELAKU,
    });
    expect(hasil.catatan).toBe("Catatan baru");
    expect(hasil.hasil).toBe("DEAL");
  });

  it("tidak menulis riwayat dan mengembalikan null bila versinya basi", async () => {
    ubahKegiatanDalamTransaksi.mockResolvedValue({ count: 0 });

    const hasil = await new KegiatanRepository().ubahDenganRiwayat(masukan);

    expect(hasil).toBeNull();
    expect(buatRiwayatDalamTransaksi).not.toHaveBeenCalled();
  });
});

describe("KegiatanRepository.findRiwayat", () => {
  const barisRiwayat = (over: Record<string, unknown> = {}) => ({
    id: "riwayat-1",
    kegiatanId: "kegiatan-1",
    tenantId: "tenant-1",
    diubahOlehId: "admin-3",
    diubahPada: new Date("2026-09-22T06:00:00.000Z"),
    perubahan: { hasil: { dari: "TERTARIK", ke: "DEAL" } },
    diubahOleh: { id: "admin-3", name: "Admin Tiga", tenantId: "tenant-1" },
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mengambil riwayat satu kegiatan, terbaru lebih dulu, dengan pengubahnya", async () => {
    vi.mocked(prisma.presurveiKegiatanRiwayat.findMany).mockResolvedValue(
      [] as never,
    );

    await new KegiatanRepository().findRiwayat("kegiatan-1");

    expect(prisma.presurveiKegiatanRiwayat.findMany).toHaveBeenCalledWith({
      where: { kegiatanId: "kegiatan-1" },
      orderBy: { diubahPada: "desc" },
      include: {
        diubahOleh: { select: { id: true, name: true, tenantId: true } },
      },
    });
  });

  it("memetakan baris dan menyembunyikan nama pengubah dari tenant lain", async () => {
    vi.mocked(prisma.presurveiKegiatanRiwayat.findMany).mockResolvedValue([
      barisRiwayat(),
      barisRiwayat({
        id: "riwayat-2",
        diubahOleh: {
          id: "orang-luar",
          name: "Orang Luar",
          tenantId: "tenant-9",
        },
      }),
    ] as never);

    const hasil = await new KegiatanRepository().findRiwayat("kegiatan-1");

    expect(hasil).toEqual([
      {
        id: "riwayat-1",
        kegiatanId: "kegiatan-1",
        tenantId: "tenant-1",
        diubahOlehId: "admin-3",
        namaPengubah: "Admin Tiga",
        diubahPada: new Date("2026-09-22T06:00:00.000Z"),
        perubahan: { hasil: { dari: "TERTARIK", ke: "DEAL" } },
      },
      expect.objectContaining({ id: "riwayat-2", namaPengubah: null }),
    ]);
  });
});
