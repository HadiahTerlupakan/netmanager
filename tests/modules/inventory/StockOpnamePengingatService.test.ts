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

const JENDELA = { periode: "2026-10", mulai: "2026-10-25", selesai: "2026-10-31", sumber: "BAWAAN" as const };

function gudang(id: string, status: string) {
  return { id, kode: id.toUpperCase(), nama: `Gudang ${id}`, status, jumlahBarangBerstok: 3, jumlahDihitungDalamJadwal: 0, soTerakhir: null as null };
}

const repo = { findTenantAktif: vi.fn(), findPenggunaDenganIzin: vi.fn() };
const jadwalService = { getJadwal: vi.fn(), getKepatuhan: vi.fn() };
const service = new StockOpnamePengingatService(repo as never, jadwalService as never);

describe("pengingat stock opname", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasNotification.mockResolvedValue(false);
    repo.findTenantAktif.mockResolvedValue(["t-1"]);
    jadwalService.getJadwal.mockImplementation(async (_t: string, periode: string) => ({
      jendela: { ...JENDELA, periode, mulai: `${periode}-25`, selesai: `${periode}-${periode === "2026-09" ? "30" : "31"}` },
    }));
    jadwalService.getKepatuhan.mockResolvedValue({
      jendela: JENDELA,
      site: [
        { siteId: "s1", namaSite: "Site A", gudang: [gudang("g1", "BELUM"), gudang("g2", "LENGKAP")] },
        { siteId: "s2", namaSite: "Site B", gudang: [gudang("g3", "SEBAGIAN")] },
      ],
    });
  });

  it("fase hari ini: dibuka, hari terakhir, ditutup (sehari sesudah)", () => {
    expect(faseHariIni(JENDELA, "2026-10-25")).toBe("DIBUKA");
    expect(faseHariIni(JENDELA, "2026-10-31")).toBe("HARI_TERAKHIR");
    expect(faseHariIni(JENDELA, "2026-11-01")).toBe("DITUTUP");
    expect(faseHariIni(JENDELA, "2026-10-27")).toBeNull();
  });

  it("hari pertama: petugas site_only hanya diberi tahu gudang site-nya; yang lengkap tidak disebut", async () => {
    repo.findPenggunaDenganIzin.mockResolvedValue([
      { id: "petugas-a", siteIds: ["s1"], isSiteOnly: true },
      { id: "petugas-semua", siteIds: [], isSiteOnly: false },
    ]);

    await service.jalankan(new Date("2026-10-25T01:00:00.000Z"));

    expect(repo.findPenggunaDenganIzin).toHaveBeenCalledWith("t-1", "create");
    const pesan = Object.fromEntries(
      mockCreateNotification.mock.calls.map(([n]) => [n.userId, n.message]),
    );
    expect(pesan["petugas-a"]).toContain("Gudang g1");
    expect(pesan["petugas-a"]).not.toContain("Gudang g3");
    expect(pesan["petugas-a"]).not.toContain("Gudang g2");
    expect(pesan["petugas-semua"]).toContain("Gudang g3");
    expect(mockCreateNotification.mock.calls[0][0]).toMatchObject({
      sourceType: "STOCK_OPNAME",
      sourceId: "2026-10:DIBUKA",
      link: "/admin/inventory/opname?tab=jadwal&periode=2026-10",
      tenantId: "t-1",
    });
  });

  it("jadwal yang berakhir di akhir bulan: ringkasan DITUTUP terkirim tanggal 1 ke pengelola", async () => {
    repo.findPenggunaDenganIzin.mockResolvedValue([{ id: "admin", siteIds: [], isSiteOnly: false }]);

    await service.jalankan(new Date("2026-11-01T01:00:00.000Z"));

    expect(repo.findPenggunaDenganIzin).toHaveBeenCalledWith("t-1", "manage");
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin", sourceId: "2026-10:DITUTUP", title: "2 gudang tidak tuntas stock opname Oktober 2026" }),
    );
  });

  it("idempotent: pengguna yang sudah menerima fase ini tidak dikirimi lagi; hari biasa tidak mengirim", async () => {
    repo.findPenggunaDenganIzin.mockResolvedValue([{ id: "petugas", siteIds: [], isSiteOnly: false }]);
    mockHasNotification.mockResolvedValue(true);
    await service.jalankan(new Date("2026-10-25T01:00:00.000Z"));
    expect(mockCreateNotification).not.toHaveBeenCalled();

    mockHasNotification.mockResolvedValue(false);
    await service.jalankan(new Date("2026-10-27T01:00:00.000Z"));
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("isi pesan menyebut rentang tanggal dan memotong daftar gudang panjang", () => {
    const banyak = Array.from({ length: 7 }, (_, i) => gudang(`g${i}`, "BELUM")) as never[];
    const pesan = susunPesan("DIBUKA", JENDELA, banyak);
    expect(pesan.judul).toBe("Jadwal stock opname Oktober 2026 dimulai");
    expect(pesan.isi).toContain("25 Okt–31 Okt");
    expect(pesan.isi).toContain("dan 2 lainnya");
  });
});
