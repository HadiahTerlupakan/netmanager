import { describe, expect, it } from "vitest";
import {
  resolveSalesAllowedSiteIds,
  SALES_SITE_SCOPE_RESOURCE,
} from "@/modules/marketing/services/SalesSiteScopeService";

const dashboard = SALES_SITE_SCOPE_RESOURCE.dashboard;
const overview = SALES_SITE_SCOPE_RESOURCE.overview;

describe("resolveSalesAllowedSiteIds", () => {
  it("role wildcard `*` tidak dianggap dibatasi", () => {
    expect(
      resolveSalesAllowedSiteIds({
        user: { role: "ADMIN", siteIds: ["s1"] },
        permissions: ["*"],
        resource: dashboard,
      }),
    ).toBeUndefined();
  });

  it("sales_dashboard:site_only mengunci ke site pengguna", () => {
    expect(
      resolveSalesAllowedSiteIds({
        user: { role: "ADMIN", siteIds: ["s1", "s2"] },
        permissions: ["sales_dashboard:read", "sales_dashboard:site_only"],
        resource: dashboard,
      }),
    ).toEqual(["s1", "s2"]);
  });

  it("site_only resource lain tidak ikut membatasi", () => {
    expect(
      resolveSalesAllowedSiteIds({
        user: { role: "ADMIN", siteIds: ["s1"] },
        permissions: ["sales_dashboard:site_only"],
        resource: overview,
      }),
    ).toBeUndefined();
  });

  it("sales:site_only memakai siteId legacy bila siteIds kosong", () => {
    expect(
      resolveSalesAllowedSiteIds({
        user: { role: "ADMIN", siteIds: [], siteId: "legacy" },
        permissions: ["sales:site_only"],
        resource: overview,
      }),
    ).toEqual(["legacy"]);
  });

  it("dibatasi tanpa site sama sekali gagal tertutup (daftar kosong)", () => {
    expect(
      resolveSalesAllowedSiteIds({
        user: { role: "ADMIN" },
        permissions: ["sales:site_only"],
        resource: overview,
      }),
    ).toEqual([]);
  });

  it("super admin tidak dibatasi", () => {
    expect(
      resolveSalesAllowedSiteIds({
        user: { role: "SUPER_ADMIN" },
        permissions: ["sales_dashboard:site_only"],
        resource: dashboard,
      }),
    ).toBeUndefined();
  });
});
