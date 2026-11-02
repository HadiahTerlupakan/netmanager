import { describe, expect, it } from "vitest";

import {
  irisanSiteDiminta,
  siteDefaultLingkup,
  type LingkupSite,
} from "@/modules/roles/domain/lingkup-site";

const TAK_DIBATASI: LingkupSite = { dibatasi: false };
const DUA_SITE: LingkupSite = { dibatasi: true, siteIds: ["s1", "s2"] };
const SATU_SITE: LingkupSite = { dibatasi: true, siteIds: ["s1"] };
const TANPA_SITE: LingkupSite = { dibatasi: true, siteIds: [] };

describe("irisanSiteDiminta", () => {
  it("tak dibatasi memakai permintaan apa adanya", () => {
    expect(irisanSiteDiminta(TAK_DIBATASI, "s9")).toEqual({ siteId: "s9" });
    expect(irisanSiteDiminta(TAK_DIBATASI, undefined)).toEqual({});
    expect(irisanSiteDiminta(TAK_DIBATASI, null)).toEqual({});
    expect(irisanSiteDiminta(TAK_DIBATASI, "")).toEqual({});
  });

  it("dibatasi tanpa permintaan berarti seluruh site lingkup", () => {
    expect(irisanSiteDiminta(DUA_SITE, undefined)).toEqual({
      siteId: { in: ["s1", "s2"] },
    });
  });

  it("dibatasi hanya meloloskan site dalam lingkup", () => {
    expect(irisanSiteDiminta(DUA_SITE, "s2")).toEqual({ siteId: "s2" });
    expect(irisanSiteDiminta(DUA_SITE, "s3")).toBeNull();
  });

  it("lingkup kosong tidak pernah meloloskan data", () => {
    expect(irisanSiteDiminta(TANPA_SITE, undefined)).toBeNull();
    expect(irisanSiteDiminta(TANPA_SITE, "s1")).toBeNull();
  });
});

describe("siteDefaultLingkup", () => {
  it("dibatasi dengan tepat satu site memakai site itu", () => {
    expect(siteDefaultLingkup(SATU_SITE)).toBe("s1");
  });

  it("tanpa bawaan untuk banyak site, tanpa site, atau tak dibatasi", () => {
    expect(siteDefaultLingkup(DUA_SITE)).toBeNull();
    expect(siteDefaultLingkup(TANPA_SITE)).toBeNull();
    expect(siteDefaultLingkup(TAK_DIBATASI)).toBeNull();
  });
});
