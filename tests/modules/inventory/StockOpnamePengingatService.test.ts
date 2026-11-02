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
  return {
    id,
    kode: id.toUpperCase(),
    nama: `Gudang ${id}`,
    status,
    jumlahBarangBerstok: 3,
    jumlahDihitungDalamJadwal: 0,
    soTerakhir: null as null,
  };
}

function site(
  siteId: string,
  j: ReturnType<typeof jendela>,
  daftar: ReturnType<typeof gudang>[],
  isPengingatAktif = true,
) {
  return {
    siteId,
    namaSite: `Site ${siteId}`,
    jendela: j,
    keadaan: "TERBUKA",
    isPengingatAktif,
    gudang: daftar,
  };
}

/** Baris `findPenggunaDenganIzin`: `izinPembatas` kosong = role tanpa pembatas site. */
function penerima(
  id: string,
  siteIds: string[],
  izinPembatas: string[] = [],
  role: { nama?: string; isSuperAdmin?: boolean } = {},
) {
  return {
    id,
    siteIds,
    namaRole: role.nama ?? "Petugas Gudang",
    isRoleSuperAdmin: role.isSuperAdmin ?? false,
    izinPembatasRole: izinPembatas,
  };
}

const repo = {
  findTenantDenganPengingatAktif: vi.fn(),
  findPenggunaDenganIzin: vi.fn(),
};
const jadwalService = { getKepatuhan: vi.fn() };
const service = new StockOpnamePengingatService(
  repo as never,
  jadwalService as never,
);

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
    jadwalService.getKepatuhan.mockImplementation(
      async (_t: string, periode: string) => ({
        periode,
        site:
          periode === "2026-10"
            ? [
                site("s1", jendela("2026-10", "2026-10-10", "2026-10-15"), [
                  gudang("g1", "BELUM"),
                  gudang("g2", "LENGKAP"),
                ]),
                site("s2", jendela("2026-10", "2026-10-10", "2026-10-12"), [
                  gudang("g3", "SEBAGIAN"),
                ]),
                site("s3", jendela("2026-10", "2026-10-20", "2026-10-25"), [
                  gudang("g4", "BELUM"),
                ]),
                site(
                  "s4",
                  jendela("2026-10", "2026-10-10", "2026-10-12"),
                  [gudang("g5", "BELUM")],
                  false,
                ),
              ]
            : [],
      }),
    );
    repo.findPenggunaDenganIzin.mockResolvedValue([
      penerima("petugas-s1", ["s1"], ["opname:site_only"]),
      penerima("kepala", []),
    ]);

    await service.jalankan(new Date("2026-10-10T01:00:00.000Z"));

    expect(repo.findPenggunaDenganIzin).toHaveBeenCalledWith("t-1", "create");
    const pesan = Object.fromEntries(
      mockCreateNotification.mock.calls.map(([n]) => [n.userId, n.message]),
    );
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

  it("penerima dibatasi tanpa site tidak dikabari; penerima multi-site menerima semua site-nya", async () => {
    jadwalService.getKepatuhan.mockImplementation(
      async (_t: string, periode: string) => ({
        periode,
        site:
          periode === "2026-10"
            ? [
                site("s1", jendela("2026-10", "2026-10-10", "2026-10-15"), [
                  gudang("g1", "BELUM"),
                ]),
                site("s2", jendela("2026-10", "2026-10-10", "2026-10-15"), [
                  gudang("g2", "BELUM"),
                ]),
                site("s3", jendela("2026-10", "2026-10-10", "2026-10-15"), [
                  gudang("g3", "BELUM"),
                ]),
              ]
            : [],
      }),
    );
    repo.findPenggunaDenganIzin.mockResolvedValue([
      penerima("tanpa-site", [], ["barang:site_only"]),
      penerima("multi-site", ["s1", "s3"], ["gudang:site_only"]),
    ]);

    await service.jalankan(new Date("2026-10-10T01:00:00.000Z"));

    const pesan = Object.fromEntries(
      mockCreateNotification.mock.calls.map(([n]) => [n.userId, n.message]),
    );
    expect(pesan["tanpa-site"]).toBeUndefined();
    expect(pesan["multi-site"]).toContain("Site s1");
    expect(pesan["multi-site"]).toContain("Site s3");
    expect(pesan["multi-site"]).not.toContain("Site s2");
  });

  it.each(["opname:site_only", "barang:site_only", "gudang:site_only"])(
    "role dengan %s hanya dikabari site-nya sendiri",
    async (izin) => {
      jadwalService.getKepatuhan.mockImplementation(
        async (_t: string, periode: string) => ({
          periode,
          site:
            periode === "2026-10"
              ? [
                  site("s1", jendela("2026-10", "2026-10-10", "2026-10-15"), [
                    gudang("g1", "BELUM"),
                  ]),
                  site("s2", jendela("2026-10", "2026-10-10", "2026-10-15"), [
                    gudang("g2", "BELUM"),
                  ]),
                ]
              : [],
        }),
      );
      repo.findPenggunaDenganIzin.mockResolvedValue([
        penerima("petugas", ["s1"], [izin]),
      ]);

      await service.jalankan(new Date("2026-10-10T01:00:00.000Z"));

      const [notifikasi] = mockCreateNotification.mock.calls[0];
      expect(notifikasi.message).toContain("Site s1");
      expect(notifikasi.message).not.toContain("Site s2");
    },
  );

  it("super admin (flag atau nama role) dan role wildcard tidak dibatasi site", async () => {
    jadwalService.getKepatuhan.mockImplementation(
      async (_t: string, periode: string) => ({
        periode,
        site:
          periode === "2026-10"
            ? [
                site("s1", jendela("2026-10", "2026-10-10", "2026-10-15"), [
                  gudang("g1", "BELUM"),
                ]),
              ]
            : [],
      }),
    );
    repo.findPenggunaDenganIzin.mockResolvedValue([
      penerima("u-flag", [], ["gudang:site_only"], { isSuperAdmin: true }),
      penerima("u-nama", [], ["opname:site_only"], { nama: "SUPER_ADMIN" }),
      penerima("u-wildcard", [], ["*"]),
    ]);

    await service.jalankan(new Date("2026-10-10T01:00:00.000Z"));

    expect(
      mockCreateNotification.mock.calls.map(([n]) => n.userId).sort(),
    ).toEqual(["u-flag", "u-nama", "u-wildcard"]);
  });

  it("jadwal yang berakhir di akhir bulan: ringkasan DITUTUP tanggal 1 ke pengelola", async () => {
    jadwalService.getKepatuhan.mockImplementation(
      async (_t: string, periode: string) => ({
        periode,
        site:
          periode === "2026-10"
            ? [
                site("s1", jendela("2026-10", "2026-10-25", "2026-10-31"), [
                  gudang("g1", "BELUM"),
                  gudang("g2", "SEBAGIAN"),
                ]),
              ]
            : [],
      }),
    );
    repo.findPenggunaDenganIzin.mockResolvedValue([penerima("admin", [])]);

    await service.jalankan(new Date("2026-11-01T01:00:00.000Z"));

    expect(repo.findPenggunaDenganIzin).toHaveBeenCalledWith("t-1", "manage");
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin",
        sourceId: "DITUTUP:2026-11-01",
        title: "2 gudang tidak tuntas stock opname Oktober 2026",
      }),
    );
  });

  it("idempotent per pengguna+fase+hari", async () => {
    jadwalService.getKepatuhan.mockResolvedValue({
      periode: "2026-10",
      site: [
        site("s1", jendela("2026-10", "2026-10-25", "2026-10-31"), [
          gudang("g1", "BELUM"),
        ]),
      ],
    });
    repo.findPenggunaDenganIzin.mockResolvedValue([penerima("petugas", [])]);
    mockHasNotification.mockResolvedValue(true);

    await service.jalankan(new Date("2026-10-25T01:00:00.000Z"));

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("isi pesan menyebut site, rentang jadwalnya, dan memotong daftar gudang panjang", () => {
    const banyak = Array.from({ length: 7 }, (_, i) =>
      gudang(`g${i}`, "BELUM"),
    );
    const pesan = susunPesan("DIBUKA", [
      {
        site: site(
          "s1",
          jendela("2026-10", "2026-10-25", "2026-10-31"),
          banyak,
        ) as never,
        gudang: banyak as never,
      },
    ]);
    expect(pesan.judul).toBe("Jadwal stock opname Oktober 2026 dimulai");
    expect(pesan.isi).toContain("Site s1 (25 Okt–31 Okt)");
    expect(pesan.isi).toContain("dan 2 lainnya");
  });
});
