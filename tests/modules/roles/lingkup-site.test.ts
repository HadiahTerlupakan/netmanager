import { describe, expect, it } from "vitest";

import {
  filterSitePrisma,
  lingkupSiteUntuk,
  siteBolehDiakses,
  tanpaDataSamaSekali,
} from "@/modules/roles/domain/lingkup-site";

/**
 * Yang dijaga ketat di sini satu hal: "dibatasi tapi tanpa site" TIDAK BOLEH
 * berarti "semua site". Itu kekeliruan yang berulang di delapan tempat terpisah
 * dan selalu berujung sama — pengguna paling terbatas justru melihat seluruh
 * tenant.
 */

const lingkup = (
  permissions: string[],
  siteIds: string[],
  isSuperAdmin = false,
) =>
  lingkupSiteUntuk({ permissions, resource: "barang", siteIds, isSuperAdmin });

describe("lingkup site", () => {
  it("tanpa permission site_only berarti tidak dibatasi", () => {
    expect(lingkup(["barang:read"], ["s1"])).toEqual({ dibatasi: false });
  });

  it("super admin tidak pernah dibatasi walau memegang site_only", () => {
    expect(lingkup(["barang:site_only"], [], true)).toEqual({
      dibatasi: false,
    });
  });

  it("site_only membatasi ke site pengguna", () => {
    expect(lingkup(["barang:site_only"], ["s1", "s2"])).toEqual({
      dibatasi: true,
      siteIds: ["s1", "s2"],
    });
  });

  it("permission resource lain tidak ikut membatasi", () => {
    expect(lingkup(["gudang:site_only"], ["s1"])).toEqual({ dibatasi: false });
  });

  it("site ganda tidak digandakan", () => {
    const hasil = lingkup(["barang:site_only"], ["s1", "s1", "s2"]);
    expect(hasil).toEqual({ dibatasi: true, siteIds: ["s1", "s2"] });
  });

  // Inti berkas ini.
  it("dibatasi tanpa site berarti tidak ada data, bukan semua data", () => {
    const hasil = lingkup(["barang:site_only"], []);

    expect(hasil).toEqual({ dibatasi: true, siteIds: [] });
    expect(tanpaDataSamaSekali(hasil)).toBe(true);
    expect(siteBolehDiakses(hasil, "s1")).toBe(false);
  });

  it("tidak dibatasi bukan berarti tanpa data", () => {
    expect(tanpaDataSamaSekali({ dibatasi: false })).toBe(false);
  });

  describe("filterSitePrisma", () => {
    it("tanpa batas menghasilkan undefined", () => {
      expect(filterSitePrisma({ dibatasi: false })).toBeUndefined();
    });

    it("dibatasi menghasilkan klausa in", () => {
      expect(filterSitePrisma({ dibatasi: true, siteIds: ["s1"] })).toEqual({
        in: ["s1"],
      });
    });

    // Gagal keras lebih baik daripada diam-diam mengembalikan query tanpa filter.
    it("melempar bila lingkupnya kosong", () => {
      expect(() => filterSitePrisma({ dibatasi: true, siteIds: [] })).toThrow(
        /tanpaDataSamaSekali/,
      );
    });
  });

  describe("siteBolehDiakses", () => {
    it("tanpa batas membolehkan apa pun, termasuk tanpa site", () => {
      expect(siteBolehDiakses({ dibatasi: false }, null)).toBe(true);
    });

    it("data tanpa site ditolak saat dibatasi", () => {
      expect(siteBolehDiakses({ dibatasi: true, siteIds: ["s1"] }, null)).toBe(
        false,
      );
    });

    it("hanya site di dalam lingkup yang lolos", () => {
      const l = { dibatasi: true as const, siteIds: ["s1", "s2"] };
      expect(siteBolehDiakses(l, "s2")).toBe(true);
      expect(siteBolehDiakses(l, "s3")).toBe(false);
    });
  });
});
