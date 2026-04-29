import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  compare: vi.fn(),
  checkRateLimit: vi.fn(),
  redisGet: vi.fn(),
  redisSetex: vi.fn(),
  redisDel: vi.fn(),
  userFindUnique: vi.fn(),
  getToken: vi.fn(),
  verifyMobileToken: vi.fn(),
  prismaAdapter: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  compare: mockFns.compare,
}));

vi.mock("@/lib/redis", () => ({
  checkRateLimit: mockFns.checkRateLimit,
  redis: {
    get: mockFns.redisGet,
    setex: mockFns.redisSetex,
    del: mockFns.redisDel,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prismaAuth: {
    user: {
      findUnique: mockFns.userFindUnique,
    },
  },
}));

vi.mock("next-auth/jwt", () => ({
  getToken: mockFns.getToken,
}));

vi.mock("@/lib/mobile-auth", () => ({
  verifyMobileToken: mockFns.verifyMobileToken,
}));

vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: mockFns.prismaAdapter,
}));

vi.mock("next-auth", () => ({
  default: () => ({ GET: vi.fn(), POST: vi.fn() }),
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: () => ({
    id: "credentials",
    name: "Credentials",
    type: "credentials",
  }),
}));

import { authConfig, verifyAuth } from "@/lib/auth";

describe("auth session permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.redisGet.mockResolvedValue(null);
    mockFns.redisSetex.mockResolvedValue("OK");
    mockFns.redisDel.mockResolvedValue(1);
    mockFns.verifyMobileToken.mockResolvedValue(null);
    mockFns.checkRateLimit.mockResolvedValue({ success: true, remaining: 10 });
    mockFns.prismaAdapter.mockReturnValue({});
  });

  it("hydrates session.user.permissions from runtime permission source", async () => {
    mockFns.userFindUnique
      .mockResolvedValueOnce({
        tokenVersion: 1,
        isActive: true,
        role: {
          name: "ADMIN",
          accessAdminPanel: true,
          accessEmployeePanel: true,
          isSuperAdmin: false,
          canApproveRab: false,
          canReceiveWhatsappApproval: false,
          permission: [{ id: "perm-1" }],
        },
        departments: { name: "Ops" },
        isSales: false,
        siteId: "site-1",
        tenantId: "tenant-1",
        tenant: { name: "Tenant One" },
        userSites: [{ siteId: "site-1" }],
      })
      .mockResolvedValueOnce({
        role: {
          isSuperAdmin: false,
          name: "ADMIN",
          permission: [{ resource: "users", action: "read" }],
        },
      });

    const session = await authConfig.callbacks?.session?.({
      session: {
        user: {
          email: "admin@example.com",
        },
        expires: new Date(Date.now() + 60_000).toISOString(),
      },
      token: {
        id: "user-1",
        tokenVersion: 1,
        siteIds: ["site-1"],
        departmentId: "dept-1",
      },
    } as never);

    expect(
      (session as { user?: { permissions?: string[] } } | undefined)?.user
        ?.permissions,
    ).toEqual(["users:read"]);
  });

  it("hydrates verifyAuth web permissions from getUserPermissions instead of token payload", async () => {
    mockFns.getToken.mockResolvedValue({
      id: "user-1",
      email: "admin@example.com",
      name: "Admin One",
      tenantId: "tenant-1",
      role: "ADMIN",
      siteId: "site-1",
      siteIds: ["site-1"],
      primarySiteId: "site-1",
      isSuperAdmin: false,
      canApproveRab: false,
      canReceiveWhatsappApproval: false,
    });
    mockFns.userFindUnique.mockResolvedValueOnce({
      role: {
        isSuperAdmin: false,
        name: "ADMIN",
        permission: [{ resource: "users", action: "read" }],
      },
    });

    const session = await verifyAuth(
      new NextRequest("http://localhost/admin/users"),
    );

    expect(session?.permissions).toEqual(["users:read"]);
  });
});
