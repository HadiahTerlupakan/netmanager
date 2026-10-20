import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  getRouterById: vi.fn(),
  updateRouter: vi.fn(),
  deleteRouter: vi.fn(),
  isSuperAdmin: vi.fn(),
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
            isSuperAdmin?: boolean;
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
  apiError: (error: string, code: string, options?: { status?: number }) => ({
    success: false,
    error,
    code,
    status: options?.status ?? 500,
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
  ErrorCodes: {
    VALIDATION_ERROR: "VALIDATION_ERROR",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    CONFLICT: "CONFLICT",
  },
}));

vi.mock("@/lib/validations/mikrotik", () => ({
  mikrotikRouterUpdateSchema: {
    safeParse: (data: unknown) => ({
      success: true,
      data,
    }),
  },
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockFns.hasPermission,
}));

vi.mock("@/lib/auth", () => ({
  isSuperAdmin: mockFns.isSuperAdmin,
}));

vi.mock("@/modules/network", async () => {
  const vpnHttp = await import("@/modules/network/vpn/vpnHttpErrors");
  return {
    MikroTikRouterService: class MockMikroTikRouterService {
      getRouterById = mockFns.getRouterById;
      updateRouter = mockFns.updateRouter;
      deleteRouter = mockFns.deleteRouter;
    },
    RouterAccessDeniedError: class RouterAccessDeniedError extends Error {},
    RouterNotFoundError: class RouterNotFoundError extends Error {},
    isVpnError: vpnHttp.isVpnError,
    vpnErrorResponse: vpnHttp.vpnErrorResponse,
  };
});

describe("GET /api/mikrotik-routers/[id]", () => {
  let GET: (typeof import("@/app/api/mikrotik-routers/[id]/route"))["GET"];

  beforeAll(async () => {
    ({ GET } = await import("@/app/api/mikrotik-routers/[id]/route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:read") return true;
      if (permission === "mikrotik:site_only") return false;
      return false;
    });

    mockFns.isSuperAdmin.mockReturnValue(false);

    mockFns.getRouterById.mockResolvedValue({
      id: "router-1",
      name: "Router Test",
      ipAddress: "192.168.1.1",
    });
  });

  it("SUPER_ADMIN bypass site restriction meskipun punya mikrotik:site_only permission", async () => {
    // Setup: SUPER_ADMIN dengan site_only permission
    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:read") return true;
      if (permission === "mikrotik:site_only") return true; // Punya site_only
      return false;
    });

    mockFns.isSuperAdmin.mockReturnValue(true); // Tapi dia SUPER_ADMIN

    const request = new Request(
      "http://localhost/api/mikrotik-routers/router-1",
      {
        method: "GET",
      },
    );

    await (
      GET as unknown as (
        req: Request,
        ctx: { params: { id: string } },
      ) => Promise<unknown>
    )(request, { params: { id: "router-1" } });

    // Verify: restrictedToOwnSite harus false karena SUPER_ADMIN
    expect(mockFns.getRouterById).toHaveBeenCalledWith({
      id: "router-1",
      tenantId: "tenant-1",
      userId: "admin-1",
      restrictedToOwnSite: false, // ✅ SUPER_ADMIN tidak terkena site restriction
    });
  });

  it("non-SUPER_ADMIN dengan site_only permission tetap terkena site restriction", async () => {
    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:read") return true;
      if (permission === "mikrotik:site_only") return true;
      return false;
    });

    mockFns.isSuperAdmin.mockReturnValue(false); // Bukan SUPER_ADMIN

    const request = new Request(
      "http://localhost/api/mikrotik-routers/router-1",
      {
        method: "GET",
      },
    );

    await (
      GET as unknown as (
        req: Request,
        ctx: { params: { id: string } },
      ) => Promise<unknown>
    )(request, { params: { id: "router-1" } });

    expect(mockFns.getRouterById).toHaveBeenCalledWith({
      id: "router-1",
      tenantId: "tenant-1",
      userId: "admin-1",
      restrictedToOwnSite: true, // ✅ Non-SUPER_ADMIN terkena site restriction
    });
  });
});

describe("PATCH /api/mikrotik-routers/[id]", () => {
  let PATCH: (typeof import("@/app/api/mikrotik-routers/[id]/route"))["PATCH"];

  beforeAll(async () => {
    ({ PATCH } = await import("@/app/api/mikrotik-routers/[id]/route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:update") return true;
      if (permission === "mikrotik:site_only") return false;
      return false;
    });

    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.updateRouter.mockResolvedValue(undefined);
  });

  it("SUPER_ADMIN bypass site restriction saat update router", async () => {
    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:update") return true;
      if (permission === "mikrotik:site_only") return true;
      return false;
    });

    mockFns.isSuperAdmin.mockReturnValue(true);

    const request = new Request(
      "http://localhost/api/mikrotik-routers/router-1",
      {
        method: "PATCH",
        body: JSON.stringify({
          name: "Updated Router",
          ipAddress: "192.168.1.2",
          apiPort: 8728,
          apiUsername: "admin",
          apiPassword: "password",
        }),
        headers: { "content-type": "application/json" },
      },
    );

    await (
      PATCH as unknown as (
        req: Request,
        ctx: { params: { id: string } },
      ) => Promise<unknown>
    )(request, { params: { id: "router-1" } });

    expect(mockFns.updateRouter).toHaveBeenCalledWith({
      id: "router-1",
      data: expect.any(Object),
      userId: "admin-1",
      tenantId: "tenant-1",
      restrictedToOwnSite: false, // ✅ SUPER_ADMIN bypass
    });
  });
});

describe("PATCH /api/mikrotik-routers/[id] router VPN", () => {
  it("menjawab 400 dengan pesan saat field terkunci router VPN diubah", async () => {
    const { PATCH } = await import("@/app/api/mikrotik-routers/[id]/route");
    const { VpnRouterInvalidError } =
      await import("@/modules/network/vpn/errors");
    mockFns.hasPermission.mockResolvedValue(false);
    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.updateRouter.mockRejectedValue(
      new VpnRouterInvalidError(
        "Alamat dan kredensial router VPN dikelola otomatis",
      ),
    );
    const request = new Request(
      "http://localhost/api/mikrotik-routers/router-1",
      {
        method: "PATCH",
        body: JSON.stringify({ ipAddress: "203.0.113.9" }),
        headers: { "content-type": "application/json" },
      },
    );

    const res = (await (
      PATCH as unknown as (
        req: Request,
        ctx: { params: { id: string } },
      ) => Promise<Response>
    )(request, { params: { id: "router-1" } })) as Response;

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(
      "Alamat dan kredensial router VPN dikelola otomatis",
    );
  });
});

describe("DELETE /api/mikrotik-routers/[id]", () => {
  let DELETE: (typeof import("@/app/api/mikrotik-routers/[id]/route"))["DELETE"];

  beforeAll(async () => {
    ({ DELETE } = await import("@/app/api/mikrotik-routers/[id]/route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:delete") return true;
      if (permission === "mikrotik:site_only") return false;
      return false;
    });

    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.deleteRouter.mockResolvedValue(undefined);
  });

  it("SUPER_ADMIN bypass site restriction saat delete router", async () => {
    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:delete") return true;
      if (permission === "mikrotik:site_only") return true;
      return false;
    });

    mockFns.isSuperAdmin.mockReturnValue(true);

    const request = new Request(
      "http://localhost/api/mikrotik-routers/router-1",
      {
        method: "DELETE",
      },
    );

    await (
      DELETE as unknown as (
        req: Request,
        ctx: { params: { id: string } },
      ) => Promise<unknown>
    )(request, { params: { id: "router-1" } });

    expect(mockFns.deleteRouter).toHaveBeenCalledWith({
      id: "router-1",
      userId: "admin-1",
      tenantId: "tenant-1",
      restrictedToOwnSite: false, // ✅ SUPER_ADMIN bypass
    });
  });
});
