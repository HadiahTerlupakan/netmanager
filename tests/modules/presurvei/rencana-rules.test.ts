import { describe, expect, it } from "vitest";
import type { RencanaEntity } from "@/modules/presurvei/domain/entities/Rencana";
import {
  hitungRekapRencana,
  isBolehMengatur,
  isDalamLingkup,
  isLaporanTerlambat,
  salesIdsDalamLingkup,
  tanggalLokal,
  tentukanStatusTampil,
  tentukanSumber,
  type LingkupRencana,
} from "@/modules/presurvei/domain/rencana-rules";

const WIB = "Asia/Jakarta";
const HARI_INI = "2026-09-26";

const rencana = (over: Partial<RencanaEntity> = {}): RencanaEntity => ({
  id: "r-1",
  salesId: "sales-a",
  namaSales: "Ani",
  dibuatOlehId: "sales-a",
  namaPembuat: "Ani",
  sumber: "MANDIRI",
  jenis: "KUNJUNGAN",
  tanggal: HARI_INI,
  jam: null,
  tujuan: "Kunjungi calon pelanggan",
  prospekId: null,
  namaProspek: null,
  alamat: null,
  latitude: null,
  longitude: null,
  status: "DIRENCANAKAN",
  kegiatanId: null,
  dilaporkanAt: null,
  alasanBatal: null,
  dibatalkanOlehId: null,
  dibatalkanAt: null,
  tenantId: "tenant-1",
  createdAt: new Date("2026-09-20T00:00:00Z"),
  updatedAt: new Date("2026-09-20T00:00:00Z"),
  ...over,
});

const SENDIRI: LingkupRencana = { jenis: "SENDIRI", penggunaId: "sales-a" };
const TIM: LingkupRencana = { jenis: "TIM", penggunaId: "kepala", anggotaIds: ["sales-a"] };
const SEMUA: LingkupRencana = { jenis: "SEMUA", penggunaId: "admin" };

describe("tanggalLokal", () => {
  it("batas hari mengikuti zona tenant, bukan UTC", () => {
    // 23.30 UTC tanggal 25 = 06.30 WIB tanggal 26.
    expect(tanggalLokal(new Date("2026-09-25T23:30:00Z"), WIB)).toBe("2026-09-26");
    expect(tanggalLokal(new Date("2026-09-25T23:30:00Z"), "UTC")).toBe("2026-09-25");
  });
});

describe("tentukanStatusTampil", () => {
  it("DIRENCANAKAN bertanggal lampau menjadi TERLEWAT; hari ini tetap DIRENCANAKAN", () => {
    expect(tentukanStatusTampil(rencana({ tanggal: "2026-09-25" }), HARI_INI)).toBe("TERLEWAT");
    expect(tentukanStatusTampil(rencana(), HARI_INI)).toBe("DIRENCANAKAN");
  });

  it("SELESAI dan BATAL tidak pernah menjadi TERLEWAT", () => {
    expect(tentukanStatusTampil(rencana({ tanggal: "2026-09-01", status: "SELESAI" }), HARI_INI)).toBe("SELESAI");
    expect(tentukanStatusTampil(rencana({ tanggal: "2026-09-01", status: "BATAL" }), HARI_INI)).toBe("BATAL");
  });
});

describe("isLaporanTerlambat", () => {
  it("terlambat bila dilaporkan setelah hari rencananya (WIB)", () => {
    const larutMalamWib = new Date("2026-09-26T16:30:00Z"); // 23.30 WIB tgl 26
    const besokPagiWib = new Date("2026-09-26T17:30:00Z"); // 00.30 WIB tgl 27
    expect(isLaporanTerlambat(rencana({ dilaporkanAt: larutMalamWib }), WIB)).toBe(false);
    expect(isLaporanTerlambat(rencana({ dilaporkanAt: besokPagiWib }), WIB)).toBe(true);
    expect(isLaporanTerlambat(rencana(), WIB)).toBe(false);
  });
});

describe("lingkup", () => {
  it("sumber MANDIRI untuk diri sendiri, PENUGASAN untuk orang lain", () => {
    expect(tentukanSumber("a", "a")).toBe("MANDIRI");
    expect(tentukanSumber("a", "kepala")).toBe("PENUGASAN");
  });

  it("kepala sales menjangkau dirinya dan anggota tim, bukan sales lain", () => {
    expect(isDalamLingkup("kepala", TIM)).toBe(true);
    expect(isDalamLingkup("sales-a", TIM)).toBe(true);
    expect(isDalamLingkup("sales-b", TIM)).toBe(false);
    expect(isDalamLingkup("sales-b", SEMUA)).toBe(true);
    expect(isDalamLingkup("sales-b", SENDIRI)).toBe(false);
  });

  it("filter sales per lingkup; SEMUA tanpa batas", () => {
    expect(salesIdsDalamLingkup(SEMUA)).toBeUndefined();
    expect(salesIdsDalamLingkup(SENDIRI)).toEqual(["sales-a"]);
    expect(salesIdsDalamLingkup(TIM)).toEqual(["kepala", "sales-a"]);
  });

  it("sales tidak boleh mengatur penugasan dari atasan, hanya rencana mandirinya", () => {
    expect(isBolehMengatur(rencana(), SENDIRI)).toBe(true);
    expect(isBolehMengatur(rencana({ sumber: "PENUGASAN", dibuatOlehId: "kepala" }), SENDIRI)).toBe(false);
    expect(isBolehMengatur(rencana({ sumber: "PENUGASAN" }), TIM)).toBe(true);
  });
});

describe("hitungRekapRencana", () => {
  it("memilah selesai tepat waktu/terlambat, terlewat, batal, mendatang, dan persen realisasi", () => {
    const daftar = [
      rencana({ id: "1", tanggal: "2026-09-24", status: "SELESAI", dilaporkanAt: new Date("2026-09-24T05:00:00Z") }),
      rencana({ id: "2", tanggal: "2026-09-24", status: "SELESAI", dilaporkanAt: new Date("2026-09-25T05:00:00Z") }),
      rencana({ id: "3", tanggal: "2026-09-25" }),
      rencana({ id: "4", tanggal: "2026-09-25", status: "BATAL" }),
      rencana({ id: "5", tanggal: "2026-09-27" }),
      rencana({ id: "6", salesId: "sales-b", namaSales: "Budi", tanggal: "2026-09-28" }),
    ];

    const [ani, budi] = hitungRekapRencana(daftar, HARI_INI, WIB);

    expect(ani).toMatchObject({
      salesId: "sales-a",
      total: 5,
      selesai: 2,
      tepatWaktu: 1,
      terlambat: 1,
      terlewat: 1,
      batal: 1,
      mendatang: 1,
      persenRealisasi: 67,
    });
    // Belum ada yang jatuh tempo: persen tidak dihitung (bukan 0%).
    expect(budi).toMatchObject({ salesId: "sales-b", mendatang: 1, persenRealisasi: null });
  });
});
