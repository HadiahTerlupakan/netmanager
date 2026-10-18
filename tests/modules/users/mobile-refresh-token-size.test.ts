import { beforeAll, describe, expect, it, vi } from "vitest";

// Peran "admin" produksi memegang 1.046 izin. Token hasil refresh dulu
// membawa seluruh daftar itu (~27 KB), melewati batas header 16 KB server,
// sehingga setiap request sesudah refresh pertama dibalas 431.
const ADMIN_PERMISSION_COUNT = 1046;
const NODE_MAX_HEADER_BYTES = 16 * 1024;

const dbUser = {
  tokenVersion: 0,
  isActive: true,
  isSales: false,
  siteId: "site-1",
  tenantId: "tenant-1",
  userSites: [{ siteId: "site-1" }],
  role: {
    name: "admin",
    isSuperAdmin: false,
    accessAdminPanel: true,
    permission: Array.from({ length: ADMIN_PERMISSION_COUNT }, (_, i) => ({
      resource: `resource_${i}`,
      action: "approve_request",
    })),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {},
  prismaAuth: {
    user: { findUnique: vi.fn(async () => dbUser), update: vi.fn() },
    pelanggan: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/prisma-mitra", () => ({
  prismaMitraAuth: { mitra: { findUnique: vi.fn() } },
}));

function claimsOf(token: string) {
  return JSON.parse(
    Buffer.from(token.split(".")[1]!, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
}

describe("mobile refresh token", () => {
  beforeAll(() => {
    process.env.NEXTAUTH_SECRET ??= "test-secret-at-least-32-characters-long";
  });

  it("stays far below the server header limit for a role with many permissions", async () => {
    const { signMobileRefreshToken } = await import("@/lib/mobile-auth");
    const { tryRefreshMobileToken } =
      await import("@/modules/users/services/MobileAuthRouteService");

    let refreshToken = await signMobileRefreshToken({
      id: "user-1",
      email: "admin@example.com",
      name: "Admin",
      role: "admin",
      appVersionCode: 49,
      appVersionName: "1.0.9",
      tenantId: "tenant-1",
      isSuperAdmin: false,
      accessAdminPanel: true,
    });

    let accessToken = "";
    for (let round = 0; round < 3; round++) {
      const result = (await tryRefreshMobileToken(refreshToken, 49)) as {
        kind: string;
        token?: string;
        refreshToken?: string;
      };
      expect(result.kind).toBe("success");
      accessToken = result.token!;
      refreshToken = result.refreshToken!;
    }

    expect(`Bearer ${accessToken}`.length).toBeLessThan(
      NODE_MAX_HEADER_BYTES / 8,
    );
    expect(claimsOf(accessToken)).not.toHaveProperty("permissions");
    expect(claimsOf(accessToken)).toMatchObject({
      sub: "user-1",
      role: "admin",
      tenantId: "tenant-1",
      appVersionCode: 49,
    });
  });

  it("still authorizes with the permissions read from the database", async () => {
    const { signMobileRefreshToken, verifyMobileToken } =
      await import("@/lib/mobile-auth");
    const { tryRefreshMobileToken } =
      await import("@/modules/users/services/MobileAuthRouteService");

    const refreshToken = await signMobileRefreshToken({
      id: "user-1",
      role: "admin",
      appVersionCode: 49,
      tenantId: "tenant-1",
    });
    const result = (await tryRefreshMobileToken(refreshToken, 49)) as {
      token: string;
    };

    const payload = await verifyMobileToken(result.token);
    expect(payload?.permissions).toHaveLength(ADMIN_PERMISSION_COUNT);
  });
});
