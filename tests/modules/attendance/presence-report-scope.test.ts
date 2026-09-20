import { describe, expect, it } from "vitest";

import { resolvePresenceReportScope } from "@/modules/attendance/services/presence-report-scope";

/**
 * `GET /api/admin/reports/presence` menerima `attendance:read` MAUPUN
 * `report:read`, tetapi pembatasan cakupannya dulu hanya membaca
 * `attendance:site_only` / `attendance:department_only`.
 *
 * Akibatnya role yang diberi `report:read` + `report:site_only` — kombinasi yang
 * wajar dipilih dari matriks Hak Akses — membaca laporan kehadiran SELURUH site
 * tanpa pembatasan apa pun. Di produksi `report:site_only` dipegang KACAB PKP,
 * SALES, dan Teknisi (16 pengguna aktif).
 */

const SITE = "site-jaksel";
const DEPARTEMEN = "dept-teknis";

const PENGGUNA = { userSiteId: SITE, userDepartmentId: DEPARTEMEN };

describe("cakupan laporan kehadiran", () => {
  it("membatasi site lewat report:site_only", () => {
    const scope = resolvePresenceReportScope({
      ...PENGGUNA,
      permissions: ["report:read", "report:site_only"],
      requestedSiteId: "site-lain",
    });

    expect(scope.siteId).toBe(SITE);
    expect(scope.isEmpty).toBe(false);
  });

  it("tetap membatasi lewat attendance:site_only", () => {
    const scope = resolvePresenceReportScope({
      ...PENGGUNA,
      permissions: ["attendance:site_only"],
      requestedSiteId: "site-lain",
    });

    expect(scope.siteId).toBe(SITE);
  });

  it("membatasi departemen lewat report:department_only", () => {
    const scope = resolvePresenceReportScope({
      ...PENGGUNA,
      permissions: ["report:department_only"],
      requestedDepartmentId: "dept-lain",
    });

    expect(scope.departmentId).toBe(DEPARTEMEN);
  });

  it("mengabaikan filter query saat dibatasi", () => {
    const scope = resolvePresenceReportScope({
      ...PENGGUNA,
      permissions: ["report:site_only", "report:department_only"],
      requestedSiteId: "site-lain",
      requestedDepartmentId: "dept-lain",
    });

    expect(scope.siteId).toBe(SITE);
    expect(scope.departmentId).toBe(DEPARTEMEN);
  });

  it("mengembalikan hasil kosong bila dibatasi tapi pengguna tanpa site", () => {
    const scope = resolvePresenceReportScope({
      userSiteId: null,
      userDepartmentId: DEPARTEMEN,
      permissions: ["report:site_only"],
    });

    expect(scope.isEmpty).toBe(true);
    expect(scope.siteId).toBeNull();
  });

  it("meneruskan filter query bila tidak dibatasi", () => {
    const scope = resolvePresenceReportScope({
      ...PENGGUNA,
      permissions: ["report:read"],
      requestedSiteId: "site-lain",
      requestedDepartmentId: "dept-lain",
    });

    expect(scope.siteId).toBe("site-lain");
    expect(scope.departmentId).toBe("dept-lain");
    expect(scope.isEmpty).toBe(false);
  });

  it("tanpa filter apa pun bila tidak dibatasi dan query kosong", () => {
    const scope = resolvePresenceReportScope({
      ...PENGGUNA,
      permissions: [],
    });

    expect(scope.siteId).toBeNull();
    expect(scope.departmentId).toBeNull();
  });
});
