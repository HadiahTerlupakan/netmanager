import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/database", () => ({ prisma: {} }));

import { StockOpnameJadwalService } from "@/modules/inventory/services/StockOpnameJadwalService";

const repo = {
  findAturan: vi.fn(),
  findJadwal: vi.fn(),
  upsertAturan: vi.fn(),
  upsertJadwal: vi.fn(),
  deleteJadwal: vi.fn(),
  findGudangAktif: vi.fn(),
  findBarangBerstok: vi.fn(),
  findOpnameDalamRentang: vi.fn(),
  findSiteIdsPengguna: vi.fn(),
};
const service = new StockOpnameJadwalService(repo as never);
const DALAM_JADWAL = new Date("2026-10-26T03:00:00.000Z");
const LUAR_JADWAL = new Date("2026-10-05T03:00:00.000Z");

describe("StockOpnameJadwalService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.findAturan.mockResolvedValue({ isAktif: true, tanggalMulai: 25, tanggalSelesai: 30 });
    repo.findJadwal.mockResolvedValue(null);
  });

  it("jadwal khusus bulan itu menimpa aturan bawaan", async () => {
    repo.findJadwal.mockResolvedValue({
      tanggalMulai: new Date("2026-10-20T00:00:00.000Z"),
      tanggalSelesai: new Date("2026-10-23T00:00:00.000Z"),
      catatan: "Maju karena libur",
    });
    const jadwal = await service.getJadwal("t-1", "2026-10");
    expect(jadwal.jendela).toEqual({ periode: "2026-10", mulai: "2026-10-20", selesai: "2026-10-23", sumber: "KHUSUS" });
    expect(jadwal.catatan).toBe("Maju karena libur");
  });

  it("tenant yang belum mengatur memakai bawaan 25–akhir bulan dengan pengingat mati", async () => {
    repo.findAturan.mockResolvedValue(null);
    const jadwal = await service.getJadwal("t-1", "2026-11");
    expect(jadwal.aturan).toMatchObject({ isAktif: false, isDiatur: false });
    expect(jadwal.jendela).toMatchObject({ mulai: "2026-11-25", selesai: "2026-11-30" });
  });

  it("validasi ditolak sebagai 400", async () => {
    await expect(service.simpanAturan("t-1", { isAktif: true, tanggalMulai: 30, tanggalSelesai: 2 })).rejects.toMatchObject({ status: 400 });
    await expect(
      service.simpanJadwalKhusus("t-1", "2026-10", { mulai: "2026-10-28", selesai: "2026-11-01" }, "u-1"),
    ).rejects.toMatchObject({ status: 400 });
    expect(repo.upsertJadwal).not.toHaveBeenCalled();
  });

  it("kepatuhan dikelompokkan per site; gudang tanpa site di kelompok sendiri; status per gudang", async () => {
    repo.findGudangAktif.mockResolvedValue([
      { id: "g1", kode: "G1", nama: "Gudang Utara", sites: [{ id: "s1", name: "Site A" }] },
      { id: "g2", kode: "G2", nama: "Gudang Selatan", sites: [{ id: "s1", name: "Site A" }, { id: "s2", name: "Site B" }] },
      { id: "g3", kode: "G3", nama: "Gudang Lepas", sites: [] },
    ]);
    repo.findBarangBerstok.mockResolvedValue([
      { gudangId: "g1", barangId: "kabel" },
      { gudangId: "g1", barangId: "odp" },
      { gudangId: "g2", barangId: "kabel" },
      { gudangId: "g3", barangId: "kabel" },
    ]);
    repo.findOpnameDalamRentang.mockResolvedValue([
      { gudangId: "g1", barangId: "kabel", tanggal: DALAM_JADWAL, pic: "Budi" },
      { gudangId: "g1", barangId: "odp", tanggal: DALAM_JADWAL, pic: "Budi" },
      { gudangId: "g2", barangId: "kabel", tanggal: LUAR_JADWAL, pic: "Ani" },
    ]);

    const laporan = await service.getKepatuhan("t-1", "2026-10", null, new Date("2026-10-31T03:00:00.000Z"));

    expect(laporan.keadaan).toBe("DITUTUP");
    expect(laporan.jumlahPerStatus).toMatchObject({ LENGKAP: 1, DI_LUAR_JADWAL: 1, BELUM: 1 });
    expect(laporan.site.map((s) => [s.namaSite, s.gudang.map((g) => `${g.kode}:${g.status}`)])).toEqual([
      ["Site A", ["G1:LENGKAP", "G2:DI_LUAR_JADWAL"]],
      ["Site B", ["G2:DI_LUAR_JADWAL"]],
      ["Tanpa site", ["G3:BELUM"]],
    ]);
    expect(laporan.site[0].gudang[0].soTerakhir).toEqual({ tanggal: DALAM_JADWAL, pic: "Budi" });
  });

  it("pengguna site_only hanya melihat site-nya walau gudang melayani site lain", async () => {
    repo.findGudangAktif.mockResolvedValue([
      { id: "g2", kode: "G2", nama: "Gudang Selatan", sites: [{ id: "s1", name: "Site A" }, { id: "s2", name: "Site B" }] },
    ]);
    repo.findBarangBerstok.mockResolvedValue([]);
    repo.findOpnameDalamRentang.mockResolvedValue([]);

    const laporan = await service.getKepatuhan("t-1", "2026-10", ["s2"]);

    expect(repo.findGudangAktif).toHaveBeenCalledWith("t-1", ["s2"]);
    expect(laporan.site.map((s) => s.namaSite)).toEqual(["Site B"]);
  });
});
