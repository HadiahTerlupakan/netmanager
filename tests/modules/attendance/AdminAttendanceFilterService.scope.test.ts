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

import { buildAdminAttendanceWhere } from "@/modules/attendance/services/AdminAttendanceFilterService";

const ADMIN = { id: "admin-1", tenantId: "t1" } as never;

function scopeMultiSite(siteIds: string[]) {
  return {
    isSuperAdmin: false,
    lingkupSite: { dibatasi: true, siteIds },
    tanpaSite: siteIds.length === 0,
    tanpaDepartemen: false,
  };
}

// Regresi multi-site: daftar absensi admin dulu hanya memakai site utama.
describe("buildAdminAttendanceWhere — lingkup site multi-site", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menyaring ke SELURUH site admin", async () => {
    mocks.resolveAdminScope.mockResolvedValue(
      scopeMultiSite(["site-a", "site-b"]),
    );

    const where = await buildAdminAttendanceWhere(ADMIN, {} as never, "UTC");

    expect(where.user).toMatchObject({
      siteId: { in: ["site-a", "site-b"] },
    });
  });

  it("site yang diminta dipakai bila termasuk lingkup", async () => {
    mocks.resolveAdminScope.mockResolvedValue(
      scopeMultiSite(["site-a", "site-b"]),
    );

    const where = await buildAdminAttendanceWhere(
      ADMIN,
      { siteId: "site-b" } as never,
      "UTC",
    );

    expect(where.user).toMatchObject({ siteId: "site-b" });
  });

  it("site di luar lingkup yang diminta diabaikan", async () => {
    mocks.resolveAdminScope.mockResolvedValue(
      scopeMultiSite(["site-a", "site-b"]),
    );

    const where = await buildAdminAttendanceWhere(
      ADMIN,
      { siteId: "site-x" } as never,
      "UTC",
    );

    expect(where.user).toMatchObject({
      siteId: { in: ["site-a", "site-b"] },
    });
  });

  it("dibatasi tanpa site: tidak ada absensi yang cocok", async () => {
    mocks.resolveAdminScope.mockResolvedValue(scopeMultiSite([]));

    const where = await buildAdminAttendanceWhere(ADMIN, {} as never, "UTC");

    expect(where.user).toEqual({ id: { in: [] } });
  });
});
