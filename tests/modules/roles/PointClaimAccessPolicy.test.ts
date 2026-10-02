import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prismaAuth: {} }));
vi.mock("@/lib/prisma-mitra", () => ({ prismaMitraAuth: {} }));

import {
  canDeletePointClaim,
  canManagePointClaim,
  canReadAllPointClaims,
  hasCashoutPermission,
} from "@/modules/roles/services/PointClaimAccessPolicy";

function akses(permissions: string[], isSuperAdmin = false) {
  return { permissions, isSuperAdmin };
}

describe("hasCashoutPermission", () => {
  it("teknisi dengan m_canvasing:create saja tidak dapat izin cashout", () => {
    expect(hasCashoutPermission(akses(["m_canvasing:read", "m_canvasing:create"]))).toBe(false);
  });

  it("izin m_canvasing:cashout, wildcard, atau super admin memberi izin", () => {
    expect(hasCashoutPermission(akses(["m_canvasing:cashout"]))).toBe(true);
    expect(hasCashoutPermission(akses(["*"]))).toBe(true);
    expect(hasCashoutPermission(akses([], true))).toBe(true);
  });
});

describe("canReadAllPointClaims", () => {
  it("pemegang canvasing:read / point_claims:read / super admin boleh", () => {
    expect(canReadAllPointClaims(akses(["canvasing:read"]))).toBe(true);
    expect(canReadAllPointClaims(akses(["point_claims:read"]))).toBe(true);
    expect(canReadAllPointClaims(akses([], true))).toBe(true);
  });

  it("sales dengan izin mobile saja tidak boleh", () => {
    expect(canReadAllPointClaims(akses(["m_canvasing:read"]))).toBe(false);
  });
});

describe("canManagePointClaim", () => {
  it.each([["point_claims:update"], ["canvasing:update"], ["marketing:update"], ["*"]])(
    "%s boleh mengelola claim",
    (izin) => {
      expect(canManagePointClaim(akses([izin]))).toBe(true);
    },
  );

  it("izin baca saja tidak boleh mengelola", () => {
    expect(canManagePointClaim(akses(["point_claims:read"]))).toBe(false);
  });
});

describe("canDeletePointClaim", () => {
  it("hanya point_claims:delete atau super admin", () => {
    expect(canDeletePointClaim(akses(["point_claims:delete"]))).toBe(true);
    expect(canDeletePointClaim(akses([], true))).toBe(true);
    expect(canDeletePointClaim(akses(["point_claims:update"]))).toBe(false);
  });
});
