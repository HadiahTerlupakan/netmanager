import { describe, expect, it } from "vitest";

import { buildWorkOrderDashboardAccessFilters } from "@/modules/work-order/services/admin-work-order-dashboard.helpers";

/**
 * Dashboard Work Order dijaga permission `work_order_dashboard:*`, tetapi
 * gerbang pembatasannya membaca `workorders:site_only` dan
 * `workorders:department_only` — permission resource LAIN.
 *
 * Akibatnya role yang diberi `work_order_dashboard:site_only` (mis. lewat
 * `lib/role-templates.ts`) tanpa `workorders:site_only` melihat dashboard
 * seluruh site: pembatasan yang dinyalakan di matriks tidak menggigit.
 *
 * Kedua nama diterima, bukan salah satu: dashboard ini menampilkan data work
 * order, jadi role yang dibatasi pada `workorders` wajar ikut dibatasi di
 * dashboard-nya. Yang keliru adalah MENGABAIKAN permission resource sendiri.
 */

const SITE = "site-jaksel";
const DEPARTEMEN = "dept-teknis";

const DASAR = {
  role: "Teknisi",
  isSuperAdmin: false,
  siteId: SITE,
  departmentId: DEPARTEMEN,
};

describe("pembatasan dashboard work order membaca permission resource sendiri", () => {
  it("membatasi site lewat work_order_dashboard:site_only", () => {
    const filters = buildWorkOrderDashboardAccessFilters({
      ...DASAR,
      permissions: ["work_order_dashboard:site_only"],
    });

    expect(filters.siteId).toBe(SITE);
  });

  it("membatasi departemen lewat work_order_dashboard:department_only", () => {
    const filters = buildWorkOrderDashboardAccessFilters({
      ...DASAR,
      permissions: ["work_order_dashboard:department_only"],
    });

    expect(filters.departmentId).toBe(DEPARTEMEN);
  });

  it("tetap menghormati nama lama workorders:site_only", () => {
    const filters = buildWorkOrderDashboardAccessFilters({
      ...DASAR,
      permissions: ["workorders:site_only"],
    });

    expect(filters.siteId).toBe(SITE);
  });

  it("tetap menghormati nama lama workorders:department_only", () => {
    const filters = buildWorkOrderDashboardAccessFilters({
      ...DASAR,
      permissions: ["workorders:department_only"],
    });

    expect(filters.departmentId).toBe(DEPARTEMEN);
  });

  it("tidak membatasi apa pun tanpa permission pembatasan", () => {
    const filters = buildWorkOrderDashboardAccessFilters({
      ...DASAR,
      permissions: ["work_order_dashboard:read"],
    });

    expect(filters.siteId).toBeUndefined();
    expect(filters.departmentId).toBeUndefined();
  });

  it("super admin lolos dari pembatasan", () => {
    const filters = buildWorkOrderDashboardAccessFilters({
      ...DASAR,
      isSuperAdmin: true,
      permissions: ["work_order_dashboard:site_only"],
    });

    expect(filters.siteId).toBeUndefined();
  });
});
