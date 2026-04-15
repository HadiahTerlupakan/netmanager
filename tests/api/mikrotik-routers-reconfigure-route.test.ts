import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  getRouterById: vi.fn(),
  provisionRadius: vi.fn(),
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

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

vi.mock("@/modules/network", () => ({
  RouterAccessDeniedError: class MockRouterAccessDeniedError extends Error {},
  MikroTikRouterService: class MockMikroTikRouterService {
    getRouterById = mockFns.getRouterById;
  },
  MikroTikProvisioningService: class MockMikroTikProvisioningService {
    provisionRadius = mockFns.provisionRadius;
  },
}));

describe("POST /api/mikrotik-routers/reconfigure", () => {
  let POST: (typeof import("@/app/api/mikrotik-routers/reconfigure/route"))["POST"];
  let RouterAccessDeniedError: (typeof import("@/modules/network"))["RouterAccessDeniedError"];

  beforeAll(async () => {
    ({ POST } = await import("@/app/api/mikrotik-routers/reconfigure/route"));
    ({ RouterAccessDeniedError } = await import("@/modules/network"));
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:update") return true;
      if (permission === "mikrotik:site_only") return false;
      return false;
    });

    prismaMock.settings.findMany.mockResolvedValue([]);
    prismaMock.mikroTikRouter.findMany.mockResolvedValue([]);
    mockFns.provisionRadius.mockResolvedValue({ success: true, logs: [] });
  });

  it("hanya memproses router yang lolos site restriction", async () => {
    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:update") return true;
      if (permission === "mikrotik:site_only") return true;
      return false;
    });

    prismaMock.mikroTikRouter.findMany.mockResolvedValue([
      {
        id: "router-site-a",
        name: "Router Site A",
        ipAddress: "10.10.10.1",
        apiPort: 8728,
        apiUsername: "master-a",
        apiPassword: "master-pass-a",
        pingStatus: "online",
      },
      {
        id: "router-site-b",
        name: "Router Site B",
        ipAddress: "10.10.10.2",
        apiPort: 8728,
        apiUsername: "master-b",
        apiPassword: "master-pass-b",
        pingStatus: "online",
      },
    ]);

    mockFns.getRouterById
      .mockResolvedValueOnce({
        id: "router-site-a",
        name: "Router Site A",
        ipAddress: "10.10.10.1",
        apiPort: 8728,
        apiUsername: "master-a",
        apiPassword: "master-pass-a",
        pingStatus: "online",
      })
      .mockRejectedValueOnce(new Error("Akses ditolak"));

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

    expect(mockFns.provisionRadius).toHaveBeenCalledTimes(1);
  });

  it("mengembalikan forbidden ketika semua router ditolak oleh site restriction", async () => {
    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:update") return true;
      if (permission === "mikrotik:site_only") return true;
      return false;
    });

    mockFns.getRouterById.mockRejectedValue(
      new RouterAccessDeniedError("Akses ditolak"),
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
    expect(mockFns.provisionRadius).not.toHaveBeenCalled();
  });

  it("memprioritaskan generated credentials saat provisioning", async () => {
    prismaMock.mikroTikRouter.findMany.mockResolvedValue([
      {
        id: "router-1",
        name: "Router 1",
        ipAddress: "10.10.10.10",
        apiPort: 8728,
        apiUsername: "master-user",
        apiPassword: "master-pass",
        apiUsernameGenerated: "generated-user",
        apiPasswordGenerated: "generated-pass",
        pingStatus: "online",
      },
    ]);

    mockFns.getRouterById.mockResolvedValue({
      id: "router-1",
      name: "Router 1",
      ipAddress: "10.10.10.10",
      apiPort: 8728,
      apiUsername: "master-user",
      apiPassword: "master-pass",
      apiUsernameGenerated: "generated-user",
      apiPasswordGenerated: "generated-pass",
      pingStatus: "online",
    });

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

    expect(mockFns.provisionRadius).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "generated-user",
        password: "generated-pass",
      }),
      null,
      "testing123",
      undefined,
    );
  });
});
