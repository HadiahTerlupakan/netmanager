import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolveAdminScope: vi.fn() }));

vi.mock(
  "@/modules/attendance/services/AdminScopeResolver",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/attendance/services/AdminScopeResolver")
    >()),
    resolveAdminScope: mocks.resolveAdminScope,
  }),
);

import type { AdminScope } from "@/modules/attendance/services/AdminScopeResolver";
import {
  PRESENCE_SCOPE_PERMISSIONS,
  resolvePresenceReportScope,
  resolvePresenceReportScopeForUser,
} from "@/modules/attendance/services/presence-report-scope";

/**
 * `GET /api/admin/reports/presence` dulu hanya memakai site UTAMA admin
 * (`dbUser.siteId`). Admin ber-`site_only` dengan dua site kehilangan seluruh
 * data site keduanya, dan `siteId` query untuk site kedua itu ditimpa kembali
 * ke site utama. Sekarang lingkupnya diambil dari `resolveAdminScope`
 * (userSites, fallback site legacy).
 */

const DEPARTEMEN = "dept-teknis";

function scopeTerbatas(
  siteIds: string[],
  overrides: Partial<AdminScope> = {},
): AdminScope {
  return {
    isSuperAdmin: false,
    lingkupSite: { dibatasi: true, siteIds },
    tanpaSite: siteIds.length === 0,
    tanpaDepartemen: false,
    ...overrides,
  };
}

const TANPA_BATAS_SCOPE: AdminScope = {
  isSuperAdmin: false,
  lingkupSite: { dibatasi: false },
  tanpaSite: false,
  tanpaDepartemen: false,
};

describe("resolvePresenceReportScope — multi-site", () => {
  it("memakai SELURUH site admin bila tidak ada siteId diminta", () => {
    const scope = resolvePresenceReportScope(
      scopeTerbatas(["site-a", "site-b"]),
      {},
    );

    expect(scope).toEqual({
      siteId: { in: ["site-a", "site-b"] },
      departmentId: undefined,
      isEmpty: false,
    });
  });

  it("siteId diminta dalam lingkup hanya mempersempit ke site itu", () => {
    const scope = resolvePresenceReportScope(
      scopeTerbatas(["site-a", "site-b"]),
      { siteId: "site-b" },
    );

    expect(scope.siteId).toBe("site-b");
  });

  it("siteId diminta di luar lingkup diabaikan, tetap seluruh lingkup", () => {
    const scope = resolvePresenceReportScope(
      scopeTerbatas(["site-a", "site-b"]),
      { siteId: "site-lain" },
    );

    expect(scope.siteId).toEqual({ in: ["site-a", "site-b"] });
  });

  it("gagal tertutup bila dibatasi tetapi tanpa site", () => {
    const scope = resolvePresenceReportScope(scopeTerbatas([]), {
      siteId: "site-lain",
    });

    expect(scope.isEmpty).toBe(true);
    expect(scope.siteId).toBeUndefined();
  });

  it("gagal tertutup bila dibatasi per departemen tanpa departemen", () => {
    const scope = resolvePresenceReportScope(
      { ...TANPA_BATAS_SCOPE, tanpaDepartemen: true },
      {},
    );

    expect(scope.isEmpty).toBe(true);
  });

  it("departemen admin menimpa departemen yang diminta saat dibatasi", () => {
    const scope = resolvePresenceReportScope(
      scopeTerbatas(["site-a"], { departmentId: DEPARTEMEN }),
      { departmentId: "dept-lain" },
    );

    expect(scope.departmentId).toBe(DEPARTEMEN);
  });

  it("meneruskan filter query bila tidak dibatasi", () => {
    const scope = resolvePresenceReportScope(TANPA_BATAS_SCOPE, {
      siteId: "site-lain",
      departmentId: "dept-lain",
    });

    expect(scope).toEqual({
      siteId: "site-lain",
      departmentId: "dept-lain",
      isEmpty: false,
    });
  });

  it("tanpa filter apa pun bila tidak dibatasi dan query kosong", () => {
    const scope = resolvePresenceReportScope(TANPA_BATAS_SCOPE, {
      siteId: null,
      departmentId: null,
    });

    expect(scope.siteId).toBeUndefined();
    expect(scope.departmentId).toBeUndefined();
    expect(scope.isEmpty).toBe(false);
  });

  it("super admin meneruskan filter query apa adanya", () => {
    const scope = resolvePresenceReportScope(
      { ...TANPA_BATAS_SCOPE, isSuperAdmin: true, tanpaSite: true },
      { siteId: "site-x" },
    );

    expect(scope).toMatchObject({ siteId: "site-x", isEmpty: false });
  });
});

describe("resolvePresenceReportScopeForUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("membaca pembatas report:* MAUPUN attendance:*", async () => {
    mocks.resolveAdminScope.mockResolvedValue(scopeTerbatas(["site-a"]));
    const user = { id: "admin-1" };

    const scope = await resolvePresenceReportScopeForUser(user, {});

    expect(mocks.resolveAdminScope).toHaveBeenCalledWith(user, {
      siteOnly: PRESENCE_SCOPE_PERMISSIONS.site_only,
      departmentOnly: PRESENCE_SCOPE_PERMISSIONS.department_only,
    });
    expect(PRESENCE_SCOPE_PERMISSIONS.site_only).toEqual([
      "report:site_only",
      "attendance:site_only",
    ]);
    expect(scope.siteId).toEqual({ in: ["site-a"] });
  });
});
