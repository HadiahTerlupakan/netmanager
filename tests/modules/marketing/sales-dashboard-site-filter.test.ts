import { describe, expect, it } from "vitest";
import { buildDashboardSiteFilter } from "@/modules/marketing/repositories/SalesAnalyticsRepository";

describe("buildDashboardSiteFilter", () => {
  it("tanpa pembatasan: siteId yang diminta dipakai apa adanya", () => {
    expect(buildDashboardSiteFilter({ siteId: "s9" })).toBe("s9");
    expect(buildDashboardSiteFilter({ siteId: null })).toBeUndefined();
  });

  it("dibatasi tanpa siteId diminta: seluruh site yang diizinkan", () => {
    expect(buildDashboardSiteFilter({ allowedSiteIds: ["s1", "s2"] })).toEqual({
      in: ["s1", "s2"],
    });
  });

  it("dibatasi dengan siteId di dalam lingkup: site itu saja", () => {
    expect(
      buildDashboardSiteFilter({ allowedSiteIds: ["s1", "s2"], siteId: "s2" }),
    ).toBe("s2");
  });

  it("dibatasi dengan siteId di luar lingkup: hasil kosong, bukan site lain", () => {
    expect(
      buildDashboardSiteFilter({ allowedSiteIds: ["s1"], siteId: "s9" }),
    ).toEqual({ in: [] });
  });

  it("dibatasi tanpa site sama sekali: hasil kosong", () => {
    expect(buildDashboardSiteFilter({ allowedSiteIds: [] })).toEqual({
      in: [],
    });
  });
});
