import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/database", () => ({ prisma: {} }));

import { StockOpnameJadwalService } from "@/modules/inventory/services/StockOpnameJadwalService";

const repo = {
  findSite: vi.fn(),
  findAturanSites: vi.fn(),
  findJadwalSites: vi.fn(),
  findJadwalKhususSite: vi.fn(),
  upsertAturan: vi.fn(),
  upsertJadwal: vi.fn(),
  deleteJadwal: vi.fn(),
  findSitesAktif: vi.fn(),
  findGudangAktif: vi.fn(),
  findBarangBerstok: vi.fn(),
  findOpnameDalamRentang: vi.fn(),
};
const riwayatRepo = {
  catat: vi.fn(),
  riwayatGudang: vi.fn(),
  peristiwaTerakhirPerGudang: vi.fn(),
};
const service = new StockOpnameJadwalService(
  repo as never,
  riwayatRepo as never,
);
const SITE_A = { id: "s1", name: "Site A" };
const SITE_B = { id: "s2", name: "Site B" };

describe("StockOpnameJadwalService — jadwal per site", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.findSite.mockResolvedValue(SITE_A);
    repo.findAturanSites.mockResolvedValue([]);
    repo.findJadwalSites.mockResolvedValue([]);
    repo.findJadwalKhususSite.mockResolvedValue([]);
    repo.findBarangBerstok.mockResolvedValue([]);
    repo.findOpnameDalamRentang.mockResolvedValue([]);
    riwayatRepo.peristiwaTerakhirPerGudang.mockResolvedValue([]);
    riwayatRepo.riwayatGudang.mockResolvedValue([]);
  });

  it("tiap site memakai jadwalnya: bawaan, khusus bulan itu, atau sebulan penuh bila belum diatur", async () => {
    repo.findAturanSites.mockResolvedValue([
      { siteId: "s1", isAktif: true, tanggalMulai: 25, tanggalSelesai: 31 },
      { siteId: "s2", isAktif: false, tanggalMulai: 10, tanggalSelesai: 15 },
    ]);
    repo.findJadwalSites.mockResolvedValue([
      {
        siteId: "s2",
        tanggalMulai: new Date("2026-10-05T00:00:00.000Z"),
        tanggalSelesai: new Date("2026-10-08T00:00:00.000Z"),
        catatan: "Maju",
      },
    ]);

    const jadwal = await service.getJadwalSites(
      "t-1",
      [SITE_A, SITE_B, { id: "s3", name: "Site C" }],
      "2026-10",
    );

    expect(jadwal.get("s1")?.jendela).toMatchObject({
      mulai: "2026-10-25",
      selesai: "2026-10-31",
      sumber: "BAWAAN",
    });
    expect(jadwal.get("s2")?.jendela).toMatchObject({
      mulai: "2026-10-05",
      selesai: "2026-10-08",
      sumber: "KHUSUS",
    });
    expect(jadwal.get("s2")?.catatan).toBe("Maju");
    expect(jadwal.get("s3")?.jendela).toMatchObject({
      mulai: "2026-10-01",
      selesai: "2026-10-31",
      sumber: "TANPA_JADWAL",
    });
    expect(jadwal.get("s3")?.aturan.isDiatur).toBe(false);
  });

  it("site milik tenant lain ditolak 404; validasi ditolak 400", async () => {
    repo.findSite.mockResolvedValueOnce(null);
    await expect(
      service.simpanAturanSite("t-1", "s-lain", {
        isAktif: true,
        tanggalMulai: 1,
        tanggalSelesai: 5,
      }),
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      service.simpanAturanSite("t-1", "s1", {
        isAktif: true,
        tanggalMulai: 30,
        tanggalSelesai: 2,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.simpanJadwalKhususSite(
        "t-1",
        "s1",
        "2026-10",
        { mulai: "2026-10-28", selesai: "2026-11-01" },
        "u-1",
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(repo.upsertAturan).not.toHaveBeenCalled();
    expect(repo.upsertJadwal).not.toHaveBeenCalled();
  });

  it("gudang lintas site dinilai dengan jadwal masing-masing site", async () => {
    repo.findSitesAktif.mockResolvedValue([SITE_A, SITE_B]);
    repo.findAturanSites.mockResolvedValue([
      { siteId: "s1", isAktif: true, tanggalMulai: 1, tanggalSelesai: 5 },
      { siteId: "s2", isAktif: true, tanggalMulai: 20, tanggalSelesai: 25 },
    ]);
    repo.findGudangAktif.mockResolvedValue([
      {
        id: "g1",
        kode: "G1",
        nama: "Gudang Bersama",
        sites: [{ id: "s1" }, { id: "s2" }],
      },
      { id: "g9", kode: "G9", nama: "Gudang Lepas", sites: [] },
    ]);
    repo.findBarangBerstok.mockResolvedValue([
      { gudangId: "g1", barangId: "kabel" },
      { gudangId: "g9", barangId: "kabel" },
    ]);
    repo.findOpnameDalamRentang.mockResolvedValue([
      {
        gudangId: "g1",
        barangId: "kabel",
        tanggal: new Date("2026-10-03T03:00:00.000Z"),
        pic: "Budi",
      },
    ]);

    const laporan = await service.getKepatuhan(
      "t-1",
      "2026-10",
      null,
      new Date("2026-10-28T03:00:00.000Z"),
    );

    const ringkas = laporan.site.map((s) => [
      s.namaSite,
      s.jendela.sumber,
      s.gudang.map((g) => g.status),
    ]);
    expect(ringkas).toEqual([
      ["Site A", "BAWAAN", ["LENGKAP"]],
      ["Site B", "BAWAAN", ["DI_LUAR_JADWAL"]],
      ["Tanpa site", "TANPA_JADWAL", ["BELUM"]],
    ]);
    expect(laporan.site[0].isPengingatAktif).toBe(true);
    expect(laporan.jumlahPerStatus).toMatchObject({
      LENGKAP: 1,
      DI_LUAR_JADWAL: 1,
      BELUM: 1,
    });
  });

  it("menyebut orang yang terakhir mengubah, bukan PIC pada catatan opname", async () => {
    // `pic` adalah teks bebas yang ikut tersunting; ia tidak menjawab siapa
    // yang terakhir menyentuh catatan itu. Jejak perubahanlah yang menjawab.
    repo.findSitesAktif.mockResolvedValue([SITE_A]);
    repo.findGudangAktif.mockResolvedValue([
      { id: "g1", kode: "G1", nama: "Gudang A", sites: [{ id: "s1" }] },
    ]);
    repo.findBarangBerstok.mockResolvedValue([
      { gudangId: "g1", barangId: "kabel" },
    ]);
    repo.findOpnameDalamRentang.mockResolvedValue([
      {
        gudangId: "g1",
        barangId: "kabel",
        tanggal: new Date("2026-10-12T03:00:00.000Z"),
        pic: "Budi",
      },
    ]);
    riwayatRepo.peristiwaTerakhirPerGudang.mockResolvedValue([
      {
        gudangId: "g1",
        aksi: "DIUBAH",
        namaPelaku: "Siti",
        dilakukanPada: new Date("2026-10-14T03:00:00.000Z"),
      },
    ]);

    const laporan = await service.getKepatuhan("t-1", "2026-10", null);

    expect(laporan.site[0].gudang[0].soTerakhir).toMatchObject({
      pic: "Budi",
      diubahOleh: "Siti",
    });
  });

  it("jatuh kembali ke PIC untuk catatan yang belum punya jejak perubahan", async () => {
    repo.findSitesAktif.mockResolvedValue([SITE_A]);
    repo.findGudangAktif.mockResolvedValue([
      { id: "g1", kode: "G1", nama: "Gudang A", sites: [{ id: "s1" }] },
    ]);
    repo.findBarangBerstok.mockResolvedValue([
      { gudangId: "g1", barangId: "kabel" },
    ]);
    repo.findOpnameDalamRentang.mockResolvedValue([
      {
        gudangId: "g1",
        barangId: "kabel",
        tanggal: new Date("2026-10-12T03:00:00.000Z"),
        pic: "Budi",
      },
    ]);

    const laporan = await service.getKepatuhan("t-1", "2026-10", null);

    expect(laporan.site[0].gudang[0].soTerakhir).toMatchObject({
      pic: "Budi",
      diubahOleh: null,
    });
  });

  it("riwayat gudang di luar jangkauan site pengguna ditolak 404", async () => {
    // Pesannya sama dengan gudang yang memang tidak ada, supaya keberadaan
    // gudang tenant atau site lain tidak bocor lewat beda pesan galat.
    repo.findGudangAktif.mockResolvedValue([
      { id: "g1", kode: "G1", nama: "Gudang A", sites: [{ id: "s1" }] },
    ]);

    await expect(
      service.getRiwayatGudang({
        tenantId: "t-1",
        gudangId: "g-lain",
        periode: "2026-10",
        siteIds: ["s1"],
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(riwayatRepo.riwayatGudang).not.toHaveBeenCalled();
  });

  it("riwayat gudang dibatasi pada rentang bulan yang diminta", async () => {
    repo.findGudangAktif.mockResolvedValue([
      { id: "g1", kode: "G1", nama: "Gudang A", sites: [{ id: "s1" }] },
    ]);
    riwayatRepo.riwayatGudang.mockResolvedValue([
      {
        id: "r1",
        aksi: "DIUBAH",
        namaPelaku: "Siti",
        namaBarang: "Kabel Dropcore",
        dilakukanPada: new Date("2026-10-14T03:00:00.000Z"),
        perubahan: { stokFisik: { dari: 10, ke: 11 } },
      },
    ]);

    const riwayat = await service.getRiwayatGudang({
      tenantId: "t-1",
      gudangId: "g1",
      periode: "2026-10",
      siteIds: null,
    });

    expect(riwayatRepo.riwayatGudang).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t-1", gudangId: "g1" }),
    );
    expect(riwayat).toHaveLength(1);
    expect(riwayat[0]).toMatchObject({
      namaPelaku: "Siti",
      perubahan: { stokFisik: { dari: 10, ke: 11 } },
    });
  });

  it("pengguna site_only: hanya site-nya, tanpa kelompok 'Tanpa site'; site tanpa gudang disembunyikan", async () => {
    repo.findSitesAktif.mockResolvedValue([SITE_B]);
    repo.findGudangAktif.mockResolvedValue([]);

    const laporan = await service.getKepatuhan("t-1", "2026-10", ["s2"]);

    expect(repo.findSitesAktif).toHaveBeenCalledWith("t-1", ["s2"]);
    expect(laporan.site).toEqual([]);
  });

  it("halaman site menampilkan jadwal bulan ini dan jadwal khusus mendatang", async () => {
    repo.findJadwalKhususSite.mockResolvedValue([
      {
        periode: "2026-12",
        tanggalMulai: new Date("2026-12-15T00:00:00.000Z"),
        tanggalSelesai: new Date("2026-12-18T00:00:00.000Z"),
        catatan: "Libur akhir tahun",
      },
    ]);

    const jadwal = await service.getJadwalSite("t-1", "s1", "2026-10");

    expect(repo.findJadwalKhususSite).toHaveBeenCalledWith(
      "t-1",
      "s1",
      "2026-10",
    );
    expect(jadwal.jadwalKhusus).toEqual([
      {
        periode: "2026-12",
        mulai: "2026-12-15",
        selesai: "2026-12-18",
        catatan: "Libur akhir tahun",
      },
    ]);
  });
});
