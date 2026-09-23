import { describe, expect, it } from "vitest";

import {
  buildTargetUrl,
  kunciQueryTarget,
} from "@/app/admin/presurvei/target/periodeQuery";

describe("buildTargetUrl", () => {
  it("mengirim tahun dan bulan sebagai angka", () => {
    // Keduanya `number` bersebelahan; tertukarnya menghasilkan periode
    // "bulan 2026" yang ditolak server dengan pesan yang membingungkan.
    expect(buildTargetUrl({ tahun: 2026, bulan: 9 })).toBe(
      "/api/admin/presurvei/target?tahun=2026&bulan=9",
    );
  });

  it("tidak mengisi bulan dengan nol di depan", () => {
    // `z.coerce.number()` menerima "09", tapi URL jadi tidak konsisten dengan
    // yang dibentuk layar lain dan memecah cache query.
    expect(buildTargetUrl({ tahun: 2026, bulan: 1 })).toContain("bulan=1");
  });
});

describe("kunciQueryTarget", () => {
  it("memuat URL periode supaya tiap periode punya cache sendiri", () => {
    expect(kunciQueryTarget({ tahun: 2025, bulan: 11 })).toEqual([
      "presurvei-target-periode",
      "/api/admin/presurvei/target?tahun=2025&bulan=11",
    ]);
  });
});
