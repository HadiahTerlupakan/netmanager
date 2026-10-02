import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateNotification = vi.hoisted(() => vi.fn());
const mockHasNotification = vi.hoisted(() => vi.fn());

vi.mock("@/modules/database", () => ({ prisma: {} }));
vi.mock("@/modules/notification", () => ({
  createNotification: mockCreateNotification,
  hasNotificationForSource: mockHasNotification,
}));

import {
  faseHariIni,
  StockOpnamePengingatService,
  susunPesan,
} from "@/modules/inventory/services/StockOpnamePengingatService";

function jendela(periode: string, mulai: string, selesai: string) {
  return { periode, mulai, selesai, sumber: "BAWAAN" as const };
}

function gudang(id: string, status: string) {
  return { id, kode: id.toUpperCase(), nama: `Gudang ${id}`, status, jumlahBarangBerstok: 3, jumlahDihitungDalamJadwal: 0, soTerakhir: null as null };
}

function site(siteId: string, j: ReturnType<typeof jendela>, daftar: ReturnType<typeof gudang>[], isPengingatAktif = true) {
  return { siteId, namaSite: `Site ${siteId}`, jendela: j, keadaan: "TERBUKA", isPengingatAktif, gudang: daftar };
}

const repo = { findTenantDenganPengingatAktif: vi.fn(), findPenggunaDenganIzin: vi.fn() };
const jadwalService = { getKepatuhan: vi.fn() };
const service = new StockOpnamePengingatService(repo as never, jadwalService as never);

describe("pengingat stock opname per site", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasNotification.mockResolvedValue(false);
    repo.findTenantDenganPengingatAktif.mockResolvedValue(["t-1"]);
  });

  it("fase hari ini: dibuka, hari terakhir, ditutup (sehari sesudah)", () => {
    const j = jendela("2026-10", "2026-10-25", "2026-10-31");
    expect(faseHariIni(j, "2026-10-25")).toBe("DIBUKA");
    expect(faseHariIni(j, "2026-10-31")).toBe("HARI_TERAKHIR");
    expect(faseHariIni(j, "2026-11-01")).toBe("DITUTUP");
    expect(faseHariIni(j, "2026-10-27")).toBeNull();
  });

  it("hanya site yang jadwalnya dimulai hari ini & pengingatnya aktif; petugas site_only hanya site-nya", async () => {
    jadwalService.getKepatuhan.mockImplementation(async (_t: string, periode: string) => ({
      periode,
      site:
        periode === "2026-10"
          ? [
              site("s1", jendela("2026-10", "2026-10-10", "2026-10-15"), [gudang("g1", "BELUM"), gudang("g2", "LENGKAP")]),
              site("s2", jendela("2026-10", "2026-10-10", "2026-10-12"), [gudang("g3", "SEBAGIAN")]),
              site("s3", jendela("2026-10", "2026-10-20", "2026-10-25"), [gudang("g4", "BELUM")]),
              site("s4", jendela("2026-10", "2026-10-10", "2026-10-12"), [gudang("g5", "BELUM")], false),
            ]
          : [],
    }));
    repo.findPenggunaDenganIzin.mockResolvedValue([
      { id: "petugas-s1", siteIds: ["s1"], isSiteOnly: true },
      { id: "kepala", siteIds: [], isSiteOnly: false },
    ]);

    await service.jalankan(new Date("2026-10-10T01:00:00.000Z"));

    expect(repo.findPenggunaDenganIzin).toHaveBeenCalledWith("t-1", "create");
    const pesan = Object.fromEntries(mockCreateNotification.mock.calls.map(([n]) => [n.userId, n.message]));
    expect(pesan["petugas-s1"]).toContain("Site s1");
    expect(pesan["petugas-s1"]).toContain("Gudang g1");
    expect(pesan["petugas-s1"]).not.toContain("Gudang g2"); // sudah lengkap
    expect(pesan["petugas-s1"]).not.toContain("Site s2");
    expect(pesan["kepala"]).toContain("Site s2");
    expect(pesan["kepala"]).not.toContain("Site s3"); // jadwalnya belum mulai
    expect(pesan["kepala"]).not.toContain("Site s4"); // pengingat mati
    expect(mockCreateNotification.mock.calls[0][0]).toMatchObject({
      sourceType: "STOCK_OPNAME",
      sourceId: "DIBUKA:2026-10-10",
      link: "/admin/inventory/opname?tab=laporan&periode=2026-10",
      tenantId: "t-1",
    });
  });

  it("jadwal yang berakhir di akhir bulan: ringkasan DITUTUP tanggal 1 ke pengelola", async () => {
    jadwalService.getKepatuhan.mockImplementation(async (_t: string, periode: string) => ({
      periode,
      site: periode === "2026-10" ? [site("s1", jendela("2026-10", "2026-10-25", "2026-10-31"), [gudang("g1", "BELUM"), gudang("g2", "SEBAGIAN")])] : [],
    }));
    repo.findPenggunaDenganIzin.mockResolvedValue([{ id: "admin", siteIds: [], isSiteOnly: false }]);

    await service.jalankan(new Date("2026-11-01T01:00:00.000Z"));

    expect(repo.findPenggunaDenganIzin).toHaveBeenCalledWith("t-1", "manage");
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin", sourceId: "DITUTUP:2026-11-01", title: "2 gudang tidak tuntas stock opname Oktober 2026" }),
    );
  });

  it("idempotent per pengguna+fase+hari", async () => {
    jadwalService.getKepatuhan.mockResolvedValue({
      periode: "2026-10",
      site: [site("s1", jendela("2026-10", "2026-10-25", "2026-10-31"), [gudang("g1", "BELUM")])],
    });
    repo.findPenggunaDenganIzin.mockResolvedValue([{ id: "petugas", siteIds: [], isSiteOnly: false }]);
    mockHasNotification.mockResolvedValue(true);

    await service.jalankan(new Date("2026-10-25T01:00:00.000Z"));

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("isi pesan menyebut site, rentang jadwalnya, dan memotong daftar gudang panjang", () => {
    const banyak = Array.from({ length: 7 }, (_, i) => gudang(`g${i}`, "BELUM"));
    const pesan = susunPesan("DIBUKA", [
      { site: site("s1", jendela("2026-10", "2026-10-25", "2026-10-31"), banyak) as never, gudang: banyak as never },
    ]);
    expect(pesan.judul).toBe("Jadwal stock opname Oktober 2026 dimulai");
    expect(pesan.isi).toContain("Site s1 (25 Okt–31 Okt)");
    expect(pesan.isi).toContain("dan 2 lainnya");
  });
});
