import { describe, expect, it } from "vitest";

import { daftarTahunPilihan } from "@/components/ui/MonthSelect";

describe("daftarTahunPilihan", () => {
  it("menawarkan 3 tahun ke belakang dan 1 ke depan, terbaru dulu", () => {
    expect(daftarTahunPilihan(2026, 2026)).toEqual([2027, 2026, 2025, 2024, 2023]);
  });

  it("tetap memuat tahun nilai saat ini walau di luar rentang", () => {
    expect(daftarTahunPilihan(2019, 2026)).toEqual([2027, 2026, 2025, 2024, 2023, 2019]);
  });
});
