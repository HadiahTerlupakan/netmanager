import { describe, expect, expectTypeOf, it } from "vitest";
import type { ReportSiteFilter } from "@/modules/attendance/domain/report-site-filter";
import {
  filterSiteDalamScope,
  type AdminScope,
} from "@/modules/attendance/services/AdminScopeResolver";
import type { OvertimeSiteFilter } from "@/modules/overtime/domain/ports/IOvertimeRepository";
import { TANPA_BATAS, type FilterKolomSite } from "@/modules/roles/client";

const SITE_A = "site-a";
const SITE_B = "site-b";

/**
 * Bentuk filter site hanya didefinisikan sekali (`FilterKolomSite`). Tes tipe
 * ini gagal di typecheck bila salah satu alias diubah tanpa yang lain.
 */
describe("FilterKolomSite sebagai satu-satunya bentuk filter site", () => {
  it("ReportSiteFilter dan OvertimeSiteFilter adalah alias FilterKolomSite", () => {
    expectTypeOf<ReportSiteFilter>().toEqualTypeOf<FilterKolomSite>();
    expectTypeOf<OvertimeSiteFilter>().toEqualTypeOf<FilterKolomSite>();
  });

  it("filterSiteDalamScope mengembalikan FilterKolomSite", () => {
    expectTypeOf(filterSiteDalamScope).returns.toEqualTypeOf<
      FilterKolomSite | undefined
    >();
  });

  it("filter dari lingkup dibatasi dapat diteruskan ke rantai laporan", () => {
    const filter = filterSiteDalamScope(
      {
        isSuperAdmin: false,
        lingkupSite: { dibatasi: true, siteIds: [SITE_A, SITE_B] },
        tanpaSite: false,
        tanpaDepartemen: false,
      } satisfies AdminScope,
      undefined,
    );
    const untukLaporan: ReportSiteFilter | undefined = filter;
    const untukLembur: OvertimeSiteFilter | undefined = filter;
    expect(untukLaporan).toEqual({ in: [SITE_A, SITE_B] });
    expect(untukLembur).toEqual(untukLaporan);
  });

  it("lingkup tidak dibatasi meneruskan site yang diminta apa adanya", () => {
    const filter = filterSiteDalamScope(
      {
        isSuperAdmin: false,
        lingkupSite: TANPA_BATAS,
        tanpaSite: false,
        tanpaDepartemen: false,
      } satisfies AdminScope,
      SITE_A,
    );
    expect(filter).toBe(SITE_A);
  });
});
