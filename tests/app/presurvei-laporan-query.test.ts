import { describe, expect, it } from "vitest";

import {
  buildLaporanUrl,
  kunciQueryLaporan,
} from "@/app/admin/presurvei/laporan/laporanQuery";

describe("buildLaporanUrl", () => {
  it("meminta endpoint laporan dengan tahun dan bulan periode", () => {
    // Param dicocokkan ke `app/api/admin/presurvei/laporan/route.ts:16-19`.
    expect(buildLaporanUrl({ tahun: 2025, bulan: 11 })).toBe(
      "/api/admin/presurvei/laporan?tahun=2025&bulan=11",
    );
  });
});

describe("kunciQueryLaporan", () => {
  it("memuat URL periode supaya tiap periode punya cache sendiri", () => {
    expect(kunciQueryLaporan({ tahun: 2024, bulan: 2 })).toEqual([
      "presurvei-laporan-periode",
      "/api/admin/presurvei/laporan?tahun=2024&bulan=2",
    ]);
  });
});
