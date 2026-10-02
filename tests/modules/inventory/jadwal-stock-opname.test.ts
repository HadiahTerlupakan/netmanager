import { describe, expect, it } from "vitest";

import {
  jendelaDariAturan,
  keadaanJendela,
  nilaiStatusGudang,
  periodeDari,
  rentangWaktuJendela,
  validasiAturan,
  validasiJadwalKhusus,
} from "@/modules/inventory/domain/jadwal-stock-opname";

const set = (...ids: string[]) => new Set(ids);

describe("jadwal stock opname", () => {
  it("aturan tanggal 25–31: bulan pendek memakai tanggal terakhir bulan", () => {
    const aturan = { isAktif: true, tanggalMulai: 25, tanggalSelesai: 31 };
    expect(jendelaDariAturan("2026-02", aturan)).toEqual({
      periode: "2026-02",
      mulai: "2026-02-25",
      selesai: "2026-02-28",
      sumber: "BAWAAN",
    });
    expect(jendelaDariAturan("2026-10", aturan).selesai).toBe("2026-10-31");
  });

  it("periode & rentang waktu mengikuti kalender WIB", () => {
    // 31 Okt 2026 18:00 UTC = 1 Nov 2026 01:00 WIB
    expect(periodeDari(new Date("2026-10-31T18:00:00.000Z"))).toBe("2026-11");
    const { dari, sampai } = rentangWaktuJendela({ mulai: "2026-10-25", selesai: "2026-10-31" });
    expect(dari.toISOString()).toBe("2026-10-24T17:00:00.000Z");
    expect(sampai.toISOString()).toBe("2026-10-31T16:59:59.999Z");
  });

  it("keadaan jendela: belum dibuka, terbuka (inklusif), ditutup", () => {
    const jendela = { periode: "2026-10", mulai: "2026-10-25", selesai: "2026-10-30", sumber: "BAWAAN" as const };
    expect(keadaanJendela(jendela, new Date("2026-10-24T10:00:00.000Z"))).toBe("BELUM_DIBUKA");
    expect(keadaanJendela(jendela, new Date("2026-10-30T16:00:00.000Z"))).toBe("TERBUKA");
    expect(keadaanJendela(jendela, new Date("2026-10-30T17:30:00.000Z"))).toBe("DITUTUP");
  });

  it("validasi aturan & jadwal khusus", () => {
    expect(validasiAturan({ tanggalMulai: 25, tanggalSelesai: 30 })).toBeNull();
    expect(validasiAturan({ tanggalMulai: 30, tanggalSelesai: 25 })).toMatch(/sebelum/);
    expect(validasiAturan({ tanggalMulai: 0, tanggalSelesai: 32 })).toBe("Tanggal harus 1–31");
    expect(validasiJadwalKhusus("2026-10", "2026-10-20", "2026-10-27")).toBeNull();
    expect(validasiJadwalKhusus("2026-10", "2026-10-28", "2026-11-02")).toMatch(/di dalam bulan/);
    expect(validasiJadwalKhusus("2026-02", "2026-02-30", "2026-02-28")).toBe("Tanggal tidak valid");
    expect(validasiJadwalKhusus("2026-13", "2026-10-01", "2026-10-02")).toMatch(/YYYY-MM/);
  });

  it("status gudang: lengkap, sebagian, di luar jadwal, belum, tanpa stok", () => {
    const berstok = set("a", "b", "c");
    expect(nilaiStatusGudang({ barangBerstok: berstok, barangDihitungDalamJadwal: set("a", "b", "c"), barangDihitungBulanIni: set("a", "b", "c") }))
      .toEqual({ status: "LENGKAP", jumlahBarangBerstok: 3, jumlahDihitungDalamJadwal: 3 });
    expect(nilaiStatusGudang({ barangBerstok: berstok, barangDihitungDalamJadwal: set("a"), barangDihitungBulanIni: set("a") }).status)
      .toBe("SEBAGIAN");
    expect(nilaiStatusGudang({ barangBerstok: berstok, barangDihitungDalamJadwal: set(), barangDihitungBulanIni: set("a") }).status)
      .toBe("DI_LUAR_JADWAL");
    expect(nilaiStatusGudang({ barangBerstok: berstok, barangDihitungDalamJadwal: set(), barangDihitungBulanIni: set() }).status)
      .toBe("BELUM");
    expect(nilaiStatusGudang({ barangBerstok: set(), barangDihitungDalamJadwal: set(), barangDihitungBulanIni: set() }).status)
      .toBe("TANPA_STOK");
    // Menghitung barang yang tidak berstok tidak membuat status lengkap.
    expect(nilaiStatusGudang({ barangBerstok: set("a"), barangDihitungDalamJadwal: set("x"), barangDihitungBulanIni: set("x") }).status)
      .toBe("BELUM");
  });
});
