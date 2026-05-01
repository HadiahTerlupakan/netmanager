import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  checkSiteRestriction: vi.fn(),
  getAdminUsers: vi.fn(),
  apiRequest: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();

  return {
    ...actual,
    createHandler: (_options: unknown, handler: unknown) => handler,
    apiSuccess: (data: unknown, meta?: unknown) =>
      NextResponse.json({ success: true, data, ...((meta as object) || {}) }),
  };
});

vi.mock("@/modules/roles", () => ({
  checkSiteRestriction: mockFns.checkSiteRestriction,
}));

vi.mock("@/modules/users", () => ({
  AdminUserRouteService: class {
    getAdminUsers = mockFns.getAdminUsers;
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    apiRequest: mockFns.apiRequest,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logActivity: vi.fn(),
  },
}));

vi.mock("@/lib/validations/user", () => ({
  createUserSchema: {},
}));

vi.mock("@/modules/database", () => ({
  prisma: {},
  prismaAuth: {},
}));

vi.mock("@/modules/mitra", () => ({
  getTenantAdminRoleId: vi.fn(),
}));

import { GET } from "@/app/api/admin/users/route";

describe("admin users route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFns.getAdminUsers.mockResolvedValue({
      users: [],
      meta: { total: 0, active: 0, inactive: 0 },
    });
  });

  it("does not apply primary site filtering when users:site_only is disabled", async () => {
    mockFns.checkSiteRestriction.mockReturnValue({
      isRestricted: false,
      primarySiteId: "site-1",
    });

    const response = await GET(
      new NextRequest("http://localhost/api/admin/users", {
        method: "GET",
      }),
      {
        session: {
          user: {
            id: "admin-1",
            tenantId: "tenant-1",
            isSuperAdmin: false,
          },
        },
        permissions: ["users:read"],
      } as never,
    );

    expect(response.status).toBe(200);
    expect(mockFns.getAdminUsers).toHaveBeenCalledWith(
      {
        user: {
          id: "admin-1",
          isSuperAdmin: false,
          tenantId: "tenant-1",
        },
      },
      {
        limit: null,
        page: null,
        roleName: null,
        search: null,
        status: null,
        tenantId: null,
      },
      ["users:read"],
    );
  });
});
