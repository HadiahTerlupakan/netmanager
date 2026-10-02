import { describe, expect, it } from "vitest";

import { ADMIN_MENU_CONFIG } from "@/lib/menu-config";

/** Bagian sidebar sebuah menu = `section` terakhir yang muncul sebelum/pada menu itu. */
function bagianMenu(code: string): string | undefined {
  let bagian: string | undefined;
  for (const item of ADMIN_MENU_CONFIG) {
    if (item.section) bagian = item.section;
    if (item.code === code) return bagian;
  }
  return undefined;
}

describe("menu Investor di sidebar admin", () => {
  it("berada di bagian Keuangan (bukan terselip di SDM di bawah Mitra)", () => {
    expect(bagianMenu("INVESTORS")).toBe("Keuangan");
    expect(bagianMenu("MITRA")).toBe("SDM");
  });

  it("berisi Daftar Investor, Setoran Masuk, dan Bagi Hasil", () => {
    const investor = ADMIN_MENU_CONFIG.find((item) => item.code === "INVESTORS");
    expect(investor?.children?.map((anak) => anak.path)).toEqual([
      "/admin/investors",
      "/admin/investors/deposits",
      "/admin/investors/profit-shares",
    ]);
  });
});
