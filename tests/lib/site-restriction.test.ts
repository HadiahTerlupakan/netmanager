import { describe, it, expect } from "vitest";
import type { Session } from "next-auth";
import {
  checkSiteRestriction,
  canAccessSite,
  validateSiteAccess,
  buildMultiSiteWhereClause,
} from "@/modules/roles";

// Mock session factory
const mockSession = (overrides: Record<string, unknown> = {}) => ({
  user: {
    id: "user-1",
    role: "ADMIN",
    permissions: ["users:read"],
    siteId: "site-1",
    ...overrides,
  },
});

describe("Site Restriction Helper", () => {
  describe("checkSiteRestriction", () => {
    it("should return unrestricted for null session", () => {
      const result = checkSiteRestriction(null, "users");
      expect(result.isRestricted).toBe(false);
      expect(result.primarySiteId).toBeNull();
    });

    it("should return unrestricted for SUPER_ADMIN", () => {
      const session = mockSession({
        role: "SUPER_ADMIN",
        permissions: ["users:site_only"],
      });
      const result = checkSiteRestriction(
        session as unknown as Session,
        "users",
      );

      expect(result.isRestricted).toBe(false);
      expect(result.primarySiteId).toBe("site-1");
    });

    it("should return restricted with primarySiteId when user has site_only permission", () => {
      const session = mockSession({
        role: "ADMIN",
        permissions: ["users:read", "users:site_only"],
        siteId: "site-abc",
      });
      const result = checkSiteRestriction(
        session as unknown as Session,
        "users",
      );

      expect(result.isRestricted).toBe(true);
      expect(result.primarySiteId).toBe("site-abc");
      expect(result.siteIds).toEqual(["site-abc"]);
    });

    it("should return unrestricted when user does not have site_only permission", () => {
      const session = mockSession({
        role: "MANAGER",
        permissions: ["users:read", "users:create"],
        siteId: "site-abc",
      });
      const result = checkSiteRestriction(
        session as unknown as Session,
        "users",
      );

      expect(result.isRestricted).toBe(false);
      expect(result.primarySiteId).toBe("site-abc");
    });

    it("should return null primarySiteId when restricted but user has no site", () => {
      const session = mockSession({
        role: "ADMIN",
        permissions: ["users:site_only"],
        siteId: null,
      });
      const result = checkSiteRestriction(
        session as unknown as Session,
        "users",
      );

      expect(result.isRestricted).toBe(true);
      expect(result.primarySiteId).toBeNull();
      expect(result.siteIds).toEqual([]);
    });
  });

  describe("canAccessSite", () => {
    it("should allow access when not restricted", () => {
      const session = mockSession({ permissions: ["users:read"] });

      expect(
        canAccessSite(session as unknown as Session, "users", "any-site"),
      ).toBe(true);
    });

    it("should allow access when restricted and sites match", () => {
      const session = mockSession({
        permissions: ["users:site_only"],
        siteId: "site-1",
      });

      expect(
        canAccessSite(session as unknown as Session, "users", "site-1"),
      ).toBe(true);
    });

    it("should deny access when restricted and sites do not match", () => {
      const session = mockSession({
        permissions: ["users:site_only"],
        siteId: "site-1",
      });

      expect(
        canAccessSite(session as unknown as Session, "users", "site-2"),
      ).toBe(false);
    });

    it("should allow access when target has no site (backwards compat)", () => {
      const session = mockSession({
        permissions: ["users:site_only"],
        siteId: "site-1",
      });

      expect(canAccessSite(session as unknown as Session, "users", null)).toBe(
        true,
      );
      expect(
        canAccessSite(session as unknown as Session, "users", undefined),
      ).toBe(true);
    });

    it("should deny access when restricted user has no site assigned", () => {
      const session = mockSession({
        permissions: ["users:site_only"],
        siteId: null,
      });

      expect(
        canAccessSite(session as unknown as Session, "users", "site-2"),
      ).toBe(false);
    });
  });

  describe("validateSiteAccess", () => {
    it("should return null when access allowed", () => {
      const session = mockSession({ permissions: ["users:read"] });

      expect(
        validateSiteAccess(session as unknown as Session, "users", "any-site"),
      ).toBeNull();
    });

    it("should return error message when access denied", () => {
      const session = mockSession({
        permissions: ["users:site_only"],
        siteId: "site-1",
      });
      const error = validateSiteAccess(
        session as unknown as Session,
        "users",
        "site-2",
      );

      expect(error).toContain("Tidak diizinkan");
      expect(error).toContain("users");
    });
  });

  describe("buildMultiSiteWhereClause", () => {
    it("should return undefined when not restricted", () => {
      const session = mockSession({ permissions: ["users:read"] });

      expect(
        buildMultiSiteWhereClause(session as unknown as Session, "users"),
      ).toBeUndefined();
    });

    it("should return where clause with default field when restricted", () => {
      const session = mockSession({
        permissions: ["users:site_only"],
        siteId: "site-abc",
      });
      const where = buildMultiSiteWhereClause(
        session as unknown as Session,
        "users",
      );

      expect(where).toEqual({ siteId: { in: ["site-abc"] } });
    });

    it("should use custom field name", () => {
      const session = mockSession({
        permissions: ["list:site_only"],
        siteId: "site-xyz",
      });
      const where = buildMultiSiteWhereClause(
        session as unknown as Session,
        "list",
        "assignedSiteId",
      );

      expect(where).toEqual({ assignedSiteId: { in: ["site-xyz"] } });
    });
  });
});
