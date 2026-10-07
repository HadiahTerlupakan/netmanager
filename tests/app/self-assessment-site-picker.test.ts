import { describe, expect, it, vi } from "vitest";

// Komponen klien menarik useApi saat diimpor; yang diuji di sini fungsi murni.
vi.mock("@/lib/hooks/useApi", () => ({
  useApi: () => ({ data: undefined as unknown }),
}));

import {
  kelompokkanPerWilayah,
  TANPA_WILAYAH,
} from "@/app/admin/regulasi/self-assessment/SelfAssessmentClient";

/**
 * Pemilih site dikelompokkan per kabupaten/kota karena Lampiran laporan
 * beragregasi dengan dimensi yang sama — pilihan dan pelaporan jadi sejalan.
 *
 * Site tanpa kabupaten/kota sengaja ditaruh paling bawah: Komdigi meminta
 * rincian per wilayah, jadi site itu perlu dibereskan, bukan sekadar dipilih.
 */

const site = (id: string, name: string, kabupatenKota?: string | null) => ({
  id,
  name,
  kabupatenKota,
});

describe("kelompokkanPerWilayah", () => {
  it("mengelompokkan site menurut kabupaten/kota", () => {
    const hasil = kelompokkanPerWilayah([
      site("1", "Site A", "Bandung"),
      site("2", "Site B", "Bandung"),
      site("3", "Site C", "Cimahi"),
    ]);

    expect(
      hasil.map(([wilayah, anggota]) => [wilayah, anggota.length]),
    ).toEqual([
      ["Bandung", 2],
      ["Cimahi", 1],
    ]);
  });

  it("mengurutkan wilayah menurut abjad Indonesia", () => {
    const hasil = kelompokkanPerWilayah([
      site("1", "A", "Surabaya"),
      site("2", "B", "Bandung"),
      site("3", "C", "Malang"),
    ]);

    expect(hasil.map(([wilayah]) => wilayah)).toEqual([
      "Bandung",
      "Malang",
      "Surabaya",
    ]);
  });

  it("menaruh site tanpa wilayah di urutan terakhir", () => {
    const hasil = kelompokkanPerWilayah([
      site("1", "Tanpa", null),
      site("2", "Ada", "Zamrud"),
    ]);

    expect(hasil.map(([wilayah]) => wilayah)).toEqual([
      "Zamrud",
      TANPA_WILAYAH,
    ]);
  });

  it("memperlakukan wilayah kosong dan spasi sama dengan tanpa wilayah", () => {
    const hasil = kelompokkanPerWilayah([
      site("1", "A", ""),
      site("2", "B", "   "),
      site("3", "C", undefined),
    ]);

    expect(hasil).toHaveLength(1);
    expect(hasil[0][0]).toBe(TANPA_WILAYAH);
    expect(hasil[0][1]).toHaveLength(3);
  });

  it("tanpa site sama sekali menghasilkan daftar kosong", () => {
    expect(kelompokkanPerWilayah([])).toEqual([]);
  });
});
