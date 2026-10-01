import { describe, expect, it } from "vitest";
import type { RencanaEntity } from "@/modules/presurvei/domain/entities/Rencana";
import {
  gabungSkor,
  hariKerjaBulan,
  nilaiAktivitas,
  nilaiCakupan,
  nilaiRealisasi,
  rekapRealisasi,
  tentukanPredikat,
} from "@/modules/presurvei/domain/penilaian-rules";
import type { Pencapaian } from "@/modules/presurvei/domain/target-rules";

const WIB = "Asia/Jakarta";

const rencana = (over: Partial<RencanaEntity>): RencanaEntity =>
  ({
    id: "r",
    salesId: "a",
    status: "DIRENCANAKAN",
    tanggal: "2026-09-10",
    dilaporkanAt: null,
    ...over,
  }) as RencanaEntity;

const baris = (persen: number) => ({ target: 10, tercapai: persen / 10, persen });

describe("gabungSkor", () => {
  it("rata-rata tertimbang", () => {
    expect(gabungSkor([{ nilai: 100, bobot: 30 }, { nilai: 50, bobot: 70 }])).toBe(65);
  });

  it("indikator belum terukur dikeluarkan, bobotnya dibagi ulang", () => {
    expect(gabungSkor([{ nilai: 80, bobot: 40 }, { nilai: null, bobot: 60 }])).toBe(80);
    expect(gabungSkor([{ nilai: null, bobot: 100 }])).toBeNull();
  });
});

describe("tentukanPredikat", () => {
  it.each([
    [90, "SANGAT_BAIK"],
    [85, "SANGAT_BAIK"],
    [70, "BAIK"],
    [55, "CUKUP"],
    [54, "PERLU_PEMBINAAN"],
    [null, null],
  ])("skor %s → %s", (skor, harapan) => {
    expect(tentukanPredikat(skor)).toBe(harapan);
  });
});

describe("indikator", () => {
  it("aktivitas = rata-rata capaian kunjungan & prospek; tanpa target → null", () => {
    const pencapaian: Pencapaian = { kunjungan: baris(80), prospek: baris(60), konversi: baris(10) };
    expect(nilaiAktivitas(pencapaian)).toBe(70);
    expect(nilaiAktivitas(null)).toBeNull();
  });

  it("realisasi: tepat waktu penuh, terlambat separuh, terlewat nol; mendatang & batal diabaikan", () => {
    const daftar = [
      rencana({ status: "SELESAI", tanggal: "2026-09-10", dilaporkanAt: new Date("2026-09-10T05:00:00Z") }),
      rencana({ status: "SELESAI", tanggal: "2026-09-10", dilaporkanAt: new Date("2026-09-12T05:00:00Z") }),
      rencana({ status: "DIRENCANAKAN", tanggal: "2026-09-11" }),
      rencana({ status: "DIRENCANAKAN", tanggal: "2026-09-30" }),
      rencana({ status: "BATAL", tanggal: "2026-09-11" }),
    ];
    const rekap = rekapRealisasi(daftar, "2026-09-26", WIB);

    expect(rekap).toEqual({ tepatWaktu: 1, terlambat: 1, terlewat: 1 });
    expect(nilaiRealisasi(rekap)).toBe(50);
    expect(nilaiRealisasi({ tepatWaktu: 0, terlambat: 0, terlewat: 0 })).toBeNull();
  });
});

describe("cakupan pembinaan", () => {
  it("hari kerja Senin–Sabtu sampai hari ini", () => {
    // 1 Sep 2026 = Selasa; 6 Sep = Minggu.
    expect(hariKerjaBulan(2026, 9, "2026-09-07")).toEqual([
      "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-07",
    ]);
  });

  it("persen slot anggota×hari yang punya rencana tidak batal", () => {
    const hari = ["2026-09-01", "2026-09-02"];
    const daftar = [
      rencana({ salesId: "a", tanggal: "2026-09-01" }),
      rencana({ salesId: "a", tanggal: "2026-09-01" }),
      rencana({ salesId: "b", tanggal: "2026-09-02" }),
      rencana({ salesId: "b", tanggal: "2026-09-01", status: "BATAL" }),
      rencana({ salesId: "luar-tim", tanggal: "2026-09-02" }),
    ];
    expect(nilaiCakupan(["a", "b"], daftar, hari)).toBe(50);
    expect(nilaiCakupan([], daftar, hari)).toBeNull();
  });
});
