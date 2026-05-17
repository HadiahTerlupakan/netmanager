import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import {
  buildMultiSiteWhereClause,
  buildSiteWhereClause,
  canAccessSite,
  checkSiteRestriction,
  getPrimarySiteId,
  getSiteFilter,
  getSiteFilters,
  getUserSiteIds,
  validateSiteAccess,
} from "@/modules/roles/services/SiteRestrictionService";

/** Build minimal session helper untuk test. */
function buildSession(
  overrides: Partial<{
    isSuperAdmin: boolean;
    permissions: string[];
    siteId: string | null;
    siteIds: string[];
    primarySiteId: string | null;
  }> = {},
): Session {
  return {
    user: {
      id: "user-1",
      role: overrides.isSuperAdmin ? "SUPER_ADMIN" : "ADMIN",
      isSuperAdmin: overrides.isSuperAdmin ?? false,
      permissions: overrides.permissions ?? [],
      siteId: overrides.siteId,
      siteIds: overrides.siteIds,
      primarySiteId: overrides.primarySiteId,
    },
    expires: "2099-12-31T23:59:59Z",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("SiteRestrictionService", () => {
  describe("checkSiteRestriction", () => {
    it("returns unrestricted for null session", () => {
      const result = checkSiteRestriction(null, "users");
      expect(result).toEqual({
        isRestricted: false,
        siteId: undefined,
        siteIds: [],
        userSiteId: null,
        primarySiteId: null,
      });
    });

    it("returns unrestricted for SUPER_ADMIN regardless of permissions", () => {
      const session = buildSession({
        isSuperAdmin: true,
        permissions: ["users:site_only"],
        siteId: "site-1",
        primarySiteId: "site-1",
      });
      const result = checkSiteRestriction(session, "users");
      expect(result.isRestricted).toBe(false);
      expect(result.primarySiteId).toBe("site-1");
    });

    it("returns restricted when permissions include resource:site_only", () => {
      const session = buildSession({
        permissions: ["users:site_only"],
        siteIds: ["site-1", "site-2"],
        primarySiteId: "site-1",
      });
      const result = checkSiteRestriction(session, "users");
      expect(result.isRestricted).toBe(true);
      expect(result.siteIds).toEqual(["site-1", "site-2"]);
      expect(result.siteId).toBe("site-1");
    });

    it("returns unrestricted when permissions tidak include resource:site_only", () => {
      const session = buildSession({
        permissions: ["users:read"],
        siteIds: ["site-1"],
        primarySiteId: "site-1",
      });
      const result = checkSiteRestriction(session, "users");
      expect(result.isRestricted).toBe(false);
    });

    it("does not leak restriction across resources", () => {
      const session = buildSession({
        permissions: ["users:site_only"],
        siteIds: ["site-1"],
        primarySiteId: "site-1",
      });
      // 'attendance' tidak punya site_only → unrestricted
      const attendance = checkSiteRestriction(session, "attendance");
      expect(attendance.isRestricted).toBe(false);
    });

    it("falls back ke legacy siteId saat siteIds tidak tersedia", () => {
      const session = buildSession({
        permissions: ["users:site_only"],
        siteId: "legacy-site",
      });
      const result = checkSiteRestriction(session, "users");
      expect(result.isRestricted).toBe(true);
      expect(result.siteIds).toEqual(["legacy-site"]);
      expect(result.userSiteId).toBe("legacy-site");
    });
  });

  describe("getSiteFilter (legacy single-site)", () => {
    it("returns primary siteId saat restricted", () => {
      const session = buildSession({
        permissions: ["users:site_only"],
        primarySiteId: "site-A",
        siteIds: ["site-A", "site-B"],
      });
      expect(getSiteFilter(session, "users")).toBe("site-A");
    });

    it("returns undefined saat unrestricted", () => {
      const session = buildSession({ permissions: ["users:read"] });
      expect(getSiteFilter(session, "users")).toBeUndefined();
    });
  });

  describe("getSiteFilters (multi-site)", () => {
    it("returns siteIds array saat restricted", () => {
      const session = buildSession({
        permissions: ["users:site_only"],
        siteIds: ["s-1", "s-2"],
      });
      expect(getSiteFilters(session, "users")).toEqual(["s-1", "s-2"]);
    });

    it("returns empty array saat unrestricted", () => {
      const session = buildSession({ permissions: [] });
      expect(getSiteFilters(session, "users")).toEqual([]);
    });
  });

  describe("buildMultiSiteWhereClause", () => {
    it("returns Prisma where with siteId IN clause saat restricted", () => {
      const session = buildSession({
        permissions: ["users:site_only"],
        siteIds: ["s-1", "s-2"],
      });
      expect(buildMultiSiteWhereClause(session, "users")).toEqual({
        siteId: { in: ["s-1", "s-2"] },
      });
    });

    it("returns undefined saat unrestricted (let caller skip filter)", () => {
      const session = buildSession({ permissions: [] });
      expect(buildMultiSiteWhereClause(session, "users")).toBeUndefined();
    });

    it("supports custom field name (mis. createdSiteId)", () => {
      const session = buildSession({
        permissions: ["users:site_only"],
        siteIds: ["s-1"],
      });
      expect(
        buildMultiSiteWhereClause(session, "users", "createdSiteId"),
      ).toEqual({ createdSiteId: { in: ["s-1"] } });
    });
  });

  describe("canAccessSite", () => {
    it("allows access untuk unrestricted user", () => {
      const session = buildSession({ permissions: [] });
      expect(canAccessSite(session, "users", "any-site")).toBe(true);
    });

    it("allows access saat target tidak punya site (null/undefined)", () => {
      const session = buildSession({
        permissions: ["users:site_only"],
        siteIds: ["s-1"],
      });
      expect(canAccessSite(session, "users", null)).toBe(true);
      expect(canAccessSite(session, "users", undefined)).toBe(true);
    });

    it("allows saat targetSiteId ada di user.siteIds", () => {
      const session = buildSession({
        permissions: ["users:site_only"],
        siteIds: ["s-1", "s-2"],
      });
      expect(canAccessSite(session, "users", "s-2")).toBe(true);
    });

    it("denies saat targetSiteId tidak ada di user.siteIds", () => {
      const session = buildSession({
        permissions: ["users:site_only"],
        siteIds: ["s-1"],
      });
      expect(canAccessSite(session, "users", "s-99")).toBe(false);
    });

    it("denies saat user restricted dengan empty siteIds", () => {
      const session = buildSession({
        permissions: ["users:site_only"],
        siteIds: [],
      });
      expect(canAccessSite(session, "users", "s-1")).toBe(false);
    });
  });

  describe("validateSiteAccess", () => {
    it("returns null saat akses diizinkan", () => {
      const session = buildSession({ permissions: [] });
      expect(validateSiteAccess(session, "users", "s-1")).toBeNull();
    });

    it("returns error message saat akses ditolak", () => {
      const session = buildSession({
        permissions: ["users:site_only"],
        siteIds: ["s-1"],
      });
      expect(validateSiteAccess(session, "users", "s-99")).toContain(
        "Tidak diizinkan",
      );
    });
  });

  describe("buildSiteWhereClause (legacy)", () => {
    it("returns single-site where saat restricted", () => {
      const session = buildSession({
        permissions: ["users:site_only"],
        primarySiteId: "s-1",
        siteIds: ["s-1"],
      });
      expect(buildSiteWhereClause(session, "users")).toEqual({
        siteId: "s-1",
      });
    });

    it("returns undefined saat unrestricted", () => {
      const session = buildSession({ permissions: [] });
      expect(buildSiteWhereClause(session, "users")).toBeUndefined();
    });
  });

  describe("getPrimarySiteId", () => {
    it("returns null untuk session kosong", () => {
      expect(getPrimarySiteId(null)).toBeNull();
    });

    it("returns primarySiteId bila ada", () => {
      const session = buildSession({ primarySiteId: "s-1", siteId: "s-old" });
      expect(getPrimarySiteId(session)).toBe("s-1");
    });

    it("falls back ke legacy siteId bila primarySiteId tidak ada", () => {
      const session = buildSession({ siteId: "legacy" });
      expect(getPrimarySiteId(session)).toBe("legacy");
    });
  });

  describe("getUserSiteIds", () => {
    it("returns empty array untuk session kosong", () => {
      expect(getUserSiteIds(null)).toEqual([]);
    });

    it("returns siteIds bila ada", () => {
      const session = buildSession({ siteIds: ["s-1", "s-2"] });
      expect(getUserSiteIds(session)).toEqual(["s-1", "s-2"]);
    });

    it("wraps legacy siteId jadi single-element array", () => {
      const session = buildSession({ siteId: "legacy" });
      expect(getUserSiteIds(session)).toEqual(["legacy"]);
    });
  });
});
