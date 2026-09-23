import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

/**
 * Repository diuji dengan me-mock klien Prisma: yang diperiksa adalah bentuk
 * query yang dikirim (filter, paginasi, urutan), bukan perilaku database.
 * Filter tenantId sengaja tidak diperiksa karena ditegakkan oleh ekstensi
 * Prisma di lapisan database, bukan oleh repository.
 */

vi.mock("@/modules/database", () => ({
  prisma: {
    presurveiProspek: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

import { prisma } from "@/modules/database";
import { ProspekRepository } from "@/modules/presurvei/repositories/ProspekRepository";
import type { ProspekRow } from "@/modules/presurvei/mappers/prospek.mapper";

// Anotasi `: ProspekRow` wajib: tanpanya properti bernilai `null` jadi implicit
// any karena repo mematikan strictNullChecks (lihat Global Constraints).
const barisProspek = (over: Partial<ProspekRow> = {}): ProspekRow => ({
  id: "prospek-1",
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

/**
 * `include` yang wajib ikut di setiap panggilan yang mengembalikan entitas.
 * Ditulis ulang sebagai literal, bukan diimpor dari `sertakan-sales.ts`:
 * test yang memakai konstanta yang sama tetap hijau bila konstanta itu
 * kehilangan `tenantId` — kolom yang dibutuhkan penjaga tenant di mapper.
 */
const SERTAKAN_PEMILIK = {
  pemilik: { select: { name: true, email: true, tenantId: true } },
};

describe("ProspekRepository.findMany", () => {
  let repository: ProspekRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new ProspekRepository();
  });

  it("menghitung lompatan halaman dari nomor halaman", async () => {
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiProspek.count).mockResolvedValue(0 as never);

    await repository.findMany({ page: 3, limit: 20 });

    expect(prisma.presurveiProspek.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
  });

  it("menyertakan pemilik untuk nama di kartu", async () => {
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiProspek.count).mockResolvedValue(0 as never);

    await repository.findMany({ page: 1, limit: 10 });

    expect(
      vi.mocked(prisma.presurveiProspek.findMany).mock.calls[0][0]?.include,
    ).toEqual(SERTAKAN_PEMILIK);
  });

  it("membawa nama pemilik satu tenant dan menyembunyikan pemilik tenant lain", async () => {
    // Bentuk data yang pernah lahir dari handler pendaftaran tanpa penjaga
    // tenant: prospek tenant-1 yang ditugaskan ke sales tenant-2. `include`
    // bersarang tidak disaring ekstensi, jadi penjaganya di mapper.
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([
      barisProspek({
        id: "prospek-sendiri",
        pemilik: { name: "Rina", email: "rina@t1.id", tenantId: "tenant-1" },
      }),
      barisProspek({
        id: "prospek-silang",
        pemilikId: "user-asing",
        pemilik: {
          name: "Orang Asing",
          email: "asing@t2.id",
          tenantId: "tenant-2",
        },
      }),
      barisProspek({
        id: "prospek-tak-bertuan",
        pemilikId: null,
        pemilik: null,
      }),
    ] as never);
    vi.mocked(prisma.presurveiProspek.count).mockResolvedValue(3 as never);

    const hasil = await repository.findMany({ page: 1, limit: 10 });

    expect(hasil.items.map((item) => [item.id, item.namaPemilik])).toEqual([
      ["prospek-sendiri", "Rina"],
      ["prospek-silang", null],
      ["prospek-tak-bertuan", null],
    ]);
  });

  it("mencari pada nama, nomor telepon, dan alamat sekaligus", async () => {
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiProspek.count).mockResolvedValue(0 as never);

    await repository.findMany({ page: 1, limit: 10, search: "budi" });

    const argumen = vi.mocked(prisma.presurveiProspek.findMany).mock
      .calls[0][0];
    // Memeriksa kolomnya, bukan cuma jumlahnya: klausa yang tertukar ke kolom
    // lain tetap berjumlah tiga dan akan lolos dari pemeriksaan panjang saja.
    expect(argumen?.where?.OR).toEqual([
      { nama: { contains: "budi", mode: "insensitive" } },
      { noTelp: { contains: "budi", mode: "insensitive" } },
      { alamat: { contains: "budi", mode: "insensitive" } },
    ]);
  });

  it("menggabungkan beberapa filter sekaligus", async () => {
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiProspek.count).mockResolvedValue(0 as never);

    await repository.findMany({
      page: 1,
      limit: 10,
      status: "NEGOSIASI",
      sumber: "IKLAN",
      pemilikId: "user-1",
      search: "budi",
    });

    const argumen = vi.mocked(prisma.presurveiProspek.findMany).mock
      .calls[0][0];
    expect(argumen?.where).toMatchObject({
      status: "NEGOSIASI",
      sumber: "IKLAN",
      pemilikId: "user-1",
    });
    expect(argumen?.where?.OR).toHaveLength(3);
  });

  it("tidak menyaring apa pun saat tidak ada filter", async () => {
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiProspek.count).mockResolvedValue(0 as never);

    await repository.findMany({ page: 1, limit: 10 });

    const argumen = vi.mocked(prisma.presurveiProspek.findMany).mock
      .calls[0][0];
    expect(argumen?.where).toEqual({});
  });

  it("mengembalikan entitas domain, bukan baris mentah", async () => {
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([
      barisProspek(),
    ] as never);
    vi.mocked(prisma.presurveiProspek.count).mockResolvedValue(1 as never);

    const hasil = await repository.findMany({ page: 1, limit: 10 });

    expect(hasil.total).toBe(1);
    expect(hasil.items[0]).toMatchObject({ id: "prospek-1", status: "BARU" });
  });
});

describe("ProspekRepository.findById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mengembalikan null saat prospek tidak ada", async () => {
    vi.mocked(prisma.presurveiProspek.findUnique).mockResolvedValue(
      null as never,
    );

    const hasil = await new ProspekRepository().findById("tidak-ada");

    expect(hasil).toBeNull();
  });

  it("memetakan seluruh kolom baris menjadi entitas domain", async () => {
    // Memeriksa kedua puluh dua field sekaligus, bukan sekadar beberapa:
    // satu field yang lupa dipetakan di mapper berarti datanya hilang senyap
    // setiap kali prospek dibaca dari database.
    const baris = barisProspek({
      email: "budi@contoh.id",
      latitude: -6.2,
      longitude: 106.8,
      shareloc: "https://maps.google.com/?q=-6.2,106.8",
      iklanId: "iklan-1",
      registrationId: "reg-1",
      referralNama: "Sari",
      status: "NEGOSIASI",
      paketDiminati: "20 Mbps",
      catatan: "minta dipasang akhir bulan",
      canvasingId: "canv-1",
      konversiAt: new Date("2026-09-23T00:00:00.000Z"),
      siteId: "site-1",
    });
    vi.mocked(prisma.presurveiProspek.findUnique).mockResolvedValue({
      ...baris,
      pemilik: { name: "  Dodi  ", email: "dodi@t1.id", tenantId: "tenant-1" },
    } as never);

    const hasil = await new ProspekRepository().findById("prospek-1");

    // `pemilik` hasil join tidak ikut ke entitas; yang ikut hanya labelnya.
    expect(hasil).toEqual({ ...baris, namaPemilik: "Dodi" });
    expect(prisma.presurveiProspek.findUnique).toHaveBeenCalledWith({
      where: { id: "prospek-1" },
      include: SERTAKAN_PEMILIK,
    });
  });
});

describe("ProspekRepository.findByNoTelp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mencari persis pada nomor yang diberikan", async () => {
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([] as never);

    await new ProspekRepository().findByNoTelp("081234567890");

    expect(prisma.presurveiProspek.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { noTelp: "081234567890" },
        include: SERTAKAN_PEMILIK,
      }),
    );
  });

  it("mengembalikan entitas domain, bukan baris mentah", async () => {
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([
      barisProspek(),
    ] as never);

    const hasil = await new ProspekRepository().findByNoTelp("081234567890");

    expect(hasil).toHaveLength(1);
    expect(hasil[0]).toMatchObject({ id: "prospek-1", status: "BARU" });
  });

  it("membatasi jumlah yang diambil pada angka yang masuk akal", async () => {
    // Nomor bersama bisa menempel pada ratusan prospek, dan kolomnya belum
    // ber-index. Tanpa batas, pemeriksaan duplikat memindai semuanya pada
    // jalur yang dilewati setiap pembuatan prospek.
    //
    // Batas atasnya ikut diperiksa, bukan hanya keberadaannya: `take` bernilai
    // besar secara teknis "ada batas" tapi menghidupkan kembali persis risiko
    // yang hendak dicegah. Batas bawahnya juga — `take: 1` akan menyembunyikan
    // duplikat nyata dari pemakai.
    const BATAS_WAJAR_MAKS = 50;
    const BATAS_WAJAR_MIN = 3;

    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([] as never);

    await new ProspekRepository().findByNoTelp("081234567890");

    const argumen = vi.mocked(prisma.presurveiProspek.findMany).mock
      .calls[0][0];
    expect(argumen?.take).toBeGreaterThanOrEqual(BATAS_WAJAR_MIN);
    expect(argumen?.take).toBeLessThanOrEqual(BATAS_WAJAR_MAKS);
  });
});

describe("ProspekRepository.tandaiKonversi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hanya menandai prospek yang belum pernah ditandai", async () => {
    // `canvasingId: null` di where inilah titik serialisasinya. Pemeriksaan di
    // domain berjalan sebelum canvasing dibuat, jadi dua permintaan bersamaan
    // bisa sama-sama melewatinya — hanya penulisan ini yang bisa memutuskan
    // siapa yang menang. Tanpa filter itu keduanya menang dan satu canvasing
    // jadi yatim.
    const konversiAt = new Date("2026-09-23T00:00:00.000Z");
    vi.mocked(prisma.presurveiProspek.update).mockResolvedValue(
      barisProspek({ canvasingId: "canvasing-1", konversiAt }) as never,
    );

    const hasil = await new ProspekRepository().tandaiKonversi(
      "prospek-1",
      "canvasing-1",
    );

    expect(prisma.presurveiProspek.update).toHaveBeenCalledWith({
      where: { id: "prospek-1", canvasingId: null },
      data: { canvasingId: "canvasing-1", konversiAt: expect.any(Date) },
      include: SERTAKAN_PEMILIK,
    });
    expect(hasil?.canvasingId).toBe("canvasing-1");
  });

  it("mengembalikan null saat prospek sudah tertandai", async () => {
    // Prisma melempar P2025 ketika tidak ada baris yang cocok dengan where.
    // Bagi pemanggil itu bukan kegagalan sistem melainkan kekalahan balapan,
    // dan ia harus bisa membedakannya untuk membersihkan canvasing-nya.
    vi.mocked(prisma.presurveiProspek.update).mockRejectedValue(
      Object.assign(new Error("Record to update not found"), { code: "P2025" }),
    );

    const hasil = await new ProspekRepository().tandaiKonversi(
      "prospek-1",
      "canvasing-1",
    );

    expect(hasil).toBeNull();
  });

  it("melempar ulang kegagalan selain P2025", async () => {
    // Koneksi putus atau konteks tenant hilang bukan kekalahan balapan.
    // Menelannya jadi null akan membuat pemanggil menghapus canvasing yang
    // sebetulnya masih sah, dan menutupi penyebab aslinya.
    vi.mocked(prisma.presurveiProspek.update).mockRejectedValue(
      Object.assign(new Error("connection reset"), { code: "P1001" }),
    );

    await expect(
      new ProspekRepository().tandaiKonversi("prospek-1", "canvasing-1"),
    ).rejects.toThrow("connection reset");
  });
});

describe("ProspekRepository.findByRegistrationId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mengembalikan null saat pendaftaran belum punya prospek", async () => {
    vi.mocked(prisma.presurveiProspek.findUnique).mockResolvedValue(
      null as never,
    );

    expect(
      await new ProspekRepository().findByRegistrationId("reg-1"),
    ).toBeNull();
  });

  it("mencari lewat kolom unik registrationId", async () => {
    vi.mocked(prisma.presurveiProspek.findUnique).mockResolvedValue(
      barisProspek({ registrationId: "reg-1" }) as never,
    );

    const hasil = await new ProspekRepository().findByRegistrationId("reg-1");

    expect(prisma.presurveiProspek.findUnique).toHaveBeenCalledWith({
      where: { registrationId: "reg-1" },
      include: SERTAKAN_PEMILIK,
    });
    expect(hasil?.registrationId).toBe("reg-1");
  });
});

describe("ProspekRepository.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("meneruskan masukan ke Prisma dan memetakan hasilnya jadi entitas", async () => {
    vi.mocked(prisma.presurveiProspek.create).mockResolvedValue(
      barisProspek() as never,
    );

    const hasil = await new ProspekRepository().create({
      nama: "Budi",
      noTelp: "081234567890",
      alamat: "Jl. Merdeka 10",
      sumber: "WALK_IN",
      pemilikId: "user-1",
    });

    expect(prisma.presurveiProspek.create).toHaveBeenCalledWith({
      data: {
        nama: "Budi",
        noTelp: "081234567890",
        alamat: "Jl. Merdeka 10",
        sumber: "WALK_IN",
        pemilikId: "user-1",
      },
      include: SERTAKAN_PEMILIK,
    });
    expect(hasil.id).toBe("prospek-1");
  });
});

describe("ProspekRepository.update", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menyasar prospek yang tepat dan meneruskan perubahannya", async () => {
    vi.mocked(prisma.presurveiProspek.update).mockResolvedValue(
      barisProspek({ status: "DIHUBUNGI" }) as never,
    );

    const hasil = await new ProspekRepository().update("prospek-1", {
      status: "DIHUBUNGI",
      catatan: "sudah ditelepon",
    });

    expect(prisma.presurveiProspek.update).toHaveBeenCalledWith({
      where: { id: "prospek-1" },
      data: { status: "DIHUBUNGI", catatan: "sudah ditelepon" },
      include: SERTAKAN_PEMILIK,
    });
    expect(hasil.status).toBe("DIHUBUNGI");
  });
});

describe("ProspekRepository.hitungBaruPerUser", () => {
  // Tipe `groupBy` Prisma memicu TS2615 (circular reference) begitu
  // `vi.mocked()` mencoba menyelesaikan tipe parameternya secara penuh —
  // isu yang sudah didokumentasikan di tests/setup.ts untuk model lain.
  // Cast ke `Mock` generik di sini mengikuti mitigasi yang sama.
  const groupByMock = prisma.presurveiProspek.groupBy as unknown as Mock;

  beforeEach(() => vi.clearAllMocks());

  const RENTANG = {
    mulai: new Date("2026-09-01T00:00:00.000Z"),
    selesai: new Date("2026-09-30T23:59:59.999Z"),
  };

  it("mengirim query groupBy terkunci pada createdAt, gte/lte, dan pemilikId", async () => {
    // `hitungBaruPerUser` dan `hitungKonversiPerUser` mendelegasikan ke helper
    // yang sama dan hanya beda nama field tanggal — createdAt di sini,
    // konversiAt di metode sebelah. Assertion penuh inilah yang menangkap
    // keduanya tertukar; memeriksa "ada rentang" saja tidak akan menangkapnya
    // karena bentuknya tetap identik setelah tertukar.
    groupByMock.mockResolvedValue([]);

    await new ProspekRepository().hitungBaruPerUser(RENTANG);

    expect(groupByMock.mock.calls[0][0]).toEqual({
      by: ["pemilikId"],
      where: {
        createdAt: { gte: RENTANG.mulai, lte: RENTANG.selesai },
        pemilikId: { not: null },
      },
      _count: { _all: true },
    });
  });

  it("memetakan hasil groupBy menjadi Record berkunci pemilikId", async () => {
    groupByMock.mockResolvedValue([
      { pemilikId: "user-1", _count: { _all: 4 } },
      { pemilikId: "user-2", _count: { _all: 2 } },
    ]);

    const hasil = await new ProspekRepository().hitungBaruPerUser(RENTANG);

    expect(hasil).toEqual({ "user-1": 4, "user-2": 2 });
  });
});

describe("ProspekRepository.hitungKonversiPerUser", () => {
  const groupByMock = prisma.presurveiProspek.groupBy as unknown as Mock;

  beforeEach(() => vi.clearAllMocks());

  const RENTANG = {
    mulai: new Date("2026-09-01T00:00:00.000Z"),
    selesai: new Date("2026-09-30T23:59:59.999Z"),
  };

  it("mengirim query groupBy terkunci pada konversiAt, gte/lte, dan pemilikId", async () => {
    // Pasangan test dari hitungBaruPerUser: kalau createdAt/konversiAt
    // tertukar antara kedua metode, salah satu dari dua test ini pasti merah
    // karena masing-masing mengunci nama field tanggalnya sendiri.
    groupByMock.mockResolvedValue([]);

    await new ProspekRepository().hitungKonversiPerUser(RENTANG);

    expect(groupByMock.mock.calls[0][0]).toEqual({
      by: ["pemilikId"],
      where: {
        konversiAt: { gte: RENTANG.mulai, lte: RENTANG.selesai },
        pemilikId: { not: null },
      },
      _count: { _all: true },
    });
  });
});
