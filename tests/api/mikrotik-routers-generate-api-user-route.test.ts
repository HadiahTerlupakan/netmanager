import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  generateApiUser: vi.fn(),
  isSuperAdmin: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (
    _options: unknown,
    handler: (
      req: Request,
      ctx: {
        params: { id: string };
        session: {
          user: {
            id: string;
            role: string;
            tenantId: string;
          };
        };
      },
    ) => unknown,
  ) => {
    return (req: Request, ctx: { params: { id: string } }) =>
      handler(req, {
        params: ctx.params,
        session: {
          user: {
            id: "admin-1",
            role: "ADMIN",
            tenantId: "tenant-1",
          },
        },
      } as never);
  },
  apiSuccess: (data: unknown) => ({
    success: true,
    data,
  }),
  ApiErrors: {
    forbidden: (message: string) => ({
      success: false,
      error: message,
      status: 403,
    }),
    notFound: (message: string) => ({
      success: false,
      error: message,
      status: 404,
    }),
  },
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockFns.hasPermission,
}));

vi.mock("@/lib/auth", () => ({
  isSuperAdmin: mockFns.isSuperAdmin,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mockFns.loggerError,
  },
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      ...((data as object) ?? {}),
      status: init?.status ?? 200,
    }),
  },
}));

vi.mock("@/modules/network", () => ({
  MikroTikRouterService: class MockMikroTikRouterService {
    generateApiUser = mockFns.generateApiUser;
  },
  RouterAccessDeniedError: class RouterAccessDeniedError extends Error {},
  RouterNotFoundError: class RouterNotFoundError extends Error {},
}));

describe("POST /api/mikrotik-routers/[id]/generate-api-user", () => {
  let POST: (typeof import("@/app/api/mikrotik-routers/[id]/generate-api-user/route"))["POST"];

  beforeAll(async () => {
    ({ POST } =
      await import("@/app/api/mikrotik-routers/[id]/generate-api-user/route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:update") return true;
      if (permission === "mikrotik:site_only") return false;
      return false;
    });

    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.generateApiUser.mockResolvedValue({
      success: true,
      username: "api-router-1",
      logs: [],
    });
  });

  it("SUPER_ADMIN bypass site restriction saat generate API user", async () => {
    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:update") return true;
      if (permission === "mikrotik:site_only") return true;
      return false;
    });

    mockFns.isSuperAdmin.mockReturnValue(true);

    const request = new Request(
      "http://localhost/api/mikrotik-routers/router-1/generate-api-user",
      { method: "POST" },
    );

    await (
      POST as unknown as (
        req: Request,
        ctx: { params: { id: string } },
      ) => Promise<unknown>
    )(request, { params: { id: "router-1" } });

    expect(mockFns.generateApiUser).toHaveBeenCalledWith({
      id: "router-1",
      userId: "admin-1",
      tenantId: "tenant-1",
      restrictedToOwnSite: false,
    });
  });

  it("non-SUPER_ADMIN dengan site_only permission tetap terkena site restriction", async () => {
    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:update") return true;
      if (permission === "mikrotik:site_only") return true;
      return false;
    });

    mockFns.isSuperAdmin.mockReturnValue(false);

    const request = new Request(
      "http://localhost/api/mikrotik-routers/router-1/generate-api-user",
      { method: "POST" },
    );

    await (
      POST as unknown as (
        req: Request,
        ctx: { params: { id: string } },
      ) => Promise<unknown>
    )(request, { params: { id: "router-1" } });

    expect(mockFns.generateApiUser).toHaveBeenCalledWith({
      id: "router-1",
      userId: "admin-1",
      tenantId: "tenant-1",
      restrictedToOwnSite: true,
    });
  });
});
