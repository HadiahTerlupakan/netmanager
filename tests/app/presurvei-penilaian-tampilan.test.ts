import { describe, expect, it } from "vitest";
import {
  anggotaTim,
  daftarIndikator,
  hitungPerPredikat,
  indikatorTerlemah,
  LABEL_INDIKATOR_SALES,
  tampilanPredikat,
} from "@/app/admin/presurvei/penilaian/tampilanPenilaian";
import type { PenilaianSales } from "@/modules/presurvei/client";

const sales = (salesId: string, kepalaSalesId: string | null, predikat: PenilaianSales["predikat"]) =>
  ({ salesId, nama: salesId, kepalaSalesId, predikat }) as PenilaianSales;

const DAFTAR = [
  sales("k", null, "BAIK"),
  sales("a", "k", "SANGAT_BAIK"),
  sales("b", "k", "PERLU_PEMBINAAN"),
  sales("c", "k", null),
  sales("x", "k2", "SANGAT_BAIK"),
];

describe("tampilan penilaian", () => {
  it("indikator terlemah melewati yang belum terukur", () => {
    const daftar = daftarIndikator(
      {
        aktivitas: { nilai: 80, bobot: 40 },
        konversi: { nilai: null, bobot: 30 },
        realisasi: { nilai: 50, bobot: 30 },
      },
      LABEL_INDIKATOR_SALES,
    );

    expect(daftar.map((baris) => baris.kunci)).toEqual(["aktivitas", "konversi", "realisasi"]);
    expect(indikatorTerlemah(daftar)?.kunci).toBe("realisasi");
    expect(indikatorTerlemah(daftar.filter((baris) => baris.nilai === null))).toBeNull();
  });

  it("anggota tim: tanpa kepalanya sendiri & tim lain, bisa disaring predikat", () => {
    expect(anggotaTim(DAFTAR, "k", "SEMUA").map((s) => s.salesId)).toEqual(["a", "b", "c"]);
    expect(anggotaTim(DAFTAR, "k", "BELUM_TERUKUR").map((s) => s.salesId)).toEqual(["c"]);
    expect(anggotaTim(DAFTAR, "k", "SANGAT_BAIK").map((s) => s.salesId)).toEqual(["a"]);
  });

  it("jumlah per predikat untuk chip filter", () => {
    expect(hitungPerPredikat(DAFTAR, "k")).toEqual({
      SEMUA: 3,
      SANGAT_BAIK: 1,
      BAIK: 0,
      CUKUP: 0,
      PERLU_PEMBINAAN: 1,
      BELUM_TERUKUR: 1,
    });
  });

  it("predikat null tampil sebagai belum terukur", () => {
    expect(tampilanPredikat(null).label).toBe("Belum terukur");
    expect(tampilanPredikat("CUKUP").label).toBe("Cukup");
  });
});
