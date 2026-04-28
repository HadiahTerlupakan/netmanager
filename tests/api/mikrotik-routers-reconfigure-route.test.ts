import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  reconfigureRouters: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (
    _options: unknown,
    handler: (
      req: Request,
      ctx: {
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
    return (req: Request) =>
      handler(req, {
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
  },
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockFns.hasPermission,
}));

vi.mock("@/modules/network", () => ({
  RouterReconfigureRouteService: class MockRouterReconfigureRouteService {
    reconfigureRouters = mockFns.reconfigureRouters;
  },
}));

describe("POST /api/mikrotik-routers/reconfigure", () => {
  let POST: (typeof import("@/app/api/mikrotik-routers/reconfigure/route"))["POST"];

  beforeAll(async () => {
    ({ POST } = await import("@/app/api/mikrotik-routers/reconfigure/route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:update") return true;
      if (permission === "mikrotik:site_only") return false;
      return false;
    });

    mockFns.reconfigureRouters.mockResolvedValue({ processed: 0, logs: [] });
  });

  it("hanya memproses router yang lolos site restriction", async () => {
    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:update") return true;
      if (permission === "mikrotik:site_only") return true;
      return false;
    });

    mockFns.reconfigureRouters.mockResolvedValue({ processed: 1, logs: [] });

    const request = new Request(
      "http://localhost/api/mikrotik-routers/reconfigure",
      {
        method: "POST",
        body: JSON.stringify({
          routerIds: ["router-site-a", "router-site-b"],
        }),
        headers: { "content-type": "application/json" },
      },
    );

    await (POST as unknown as (req: Request) => Promise<unknown>)(request);

    expect(mockFns.reconfigureRouters).toHaveBeenCalledWith(
      ["router-site-a", "router-site-b"],
      {
        tenantId: "tenant-1",
        userId: "admin-1",
        role: "ADMIN",
        restrictedToOwnSite: true,
      },
    );
  });

  it("mengembalikan forbidden ketika semua router ditolak oleh site restriction", async () => {
    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:update") return true;
      if (permission === "mikrotik:site_only") return true;
      return false;
    });

    mockFns.reconfigureRouters.mockRejectedValue(
      new Error("FORBIDDEN:Akses ditolak"),
    );

    const request = new Request(
      "http://localhost/api/mikrotik-routers/reconfigure",
      {
        method: "POST",
        body: JSON.stringify({
          routerIds: ["router-site-b"],
        }),
        headers: { "content-type": "application/json" },
      },
    );

    const response = await (
      POST as unknown as (req: Request) => Promise<unknown>
    )(request);

    expect(response).toEqual({
      success: false,
      error: "Akses ditolak",
      status: 403,
    });
    expect(mockFns.reconfigureRouters).toHaveBeenCalledWith(["router-site-b"], {
      tenantId: "tenant-1",
      userId: "admin-1",
      role: "ADMIN",
      restrictedToOwnSite: true,
    });
  });

  it("meneruskan routerIds ke route service", async () => {
    const request = new Request(
      "http://localhost/api/mikrotik-routers/reconfigure",
      {
        method: "POST",
        body: JSON.stringify({
          routerIds: ["router-1"],
        }),
        headers: { "content-type": "application/json" },
      },
    );

    await (POST as unknown as (req: Request) => Promise<unknown>)(request);

    expect(mockFns.reconfigureRouters).toHaveBeenCalledWith(
      ["router-1"],
      expect.objectContaining({
        tenantId: "tenant-1",
        userId: "admin-1",
        role: "ADMIN",
      }),
    );
  });
});
