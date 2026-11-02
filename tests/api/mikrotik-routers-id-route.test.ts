import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  permissions: [] as string[],
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
        permissions: mockFns.permissions,
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
  apiError: (
    error: string,
    code: string,
    options?: { status?: number; details?: unknown },
  ) => ({
    success: false,
    error,
    code,
    details: options?.details,
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

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockFns.hasPermission,
}));

vi.mock("@/lib/auth", () => ({
  isSuperAdmin: mockFns.isSuperAdmin,
}));

vi.mock("@/modules/network", async () => {
  const vpnHttp = await import("@/modules/network/vpn/vpnHttpErrors");
  return {
    isRestrictedToOwnRouterSite: (
      await import("@/modules/network/services/mikrotik-router.access")
    ).isRestrictedToOwnRouterSite,
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
    mockFns.permissions = [];

    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:read") return true;
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
      return false;
    });
    mockFns.permissions = ["mikrotik:site_only"];

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
      return false;
    });
    mockFns.permissions = ["mikrotik:site_only"];

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

describe("GET /api/mikrotik-routers/[id] role wildcard", () => {
  it("role wildcard non-super tidak dianggap dibatasi site", async () => {
    vi.clearAllMocks();
    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.hasPermission.mockResolvedValue(true);
    mockFns.permissions = ["*"];
    mockFns.getRouterById.mockResolvedValue({ id: "router-1" });
    const { GET } = await import("@/app/api/mikrotik-routers/[id]/route");

    await (
      GET as unknown as (
        req: Request,
        ctx: { params: { id: string } },
      ) => Promise<unknown>
    )(new Request("http://localhost/api/mikrotik-routers/router-1"), {
      params: { id: "router-1" },
    });

    expect(mockFns.getRouterById).toHaveBeenCalledWith(
      expect.objectContaining({ restrictedToOwnSite: false }),
    );
  });
});

describe("PATCH /api/mikrotik-routers/[id]", () => {
  let PATCH: (typeof import("@/app/api/mikrotik-routers/[id]/route"))["PATCH"];

  beforeAll(async () => {
    ({ PATCH } = await import("@/app/api/mikrotik-routers/[id]/route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.permissions = [];

    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:update") return true;
      return false;
    });

    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.updateRouter.mockResolvedValue(undefined);
  });

  it("SUPER_ADMIN bypass site restriction saat update router", async () => {
    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:update") return true;
      return false;
    });
    mockFns.permissions = ["mikrotik:site_only"];

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
    mockFns.hasPermission.mockResolvedValue(true);
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

describe("PATCH /api/mikrotik-routers/[id] mode halaman isolir", () => {
  const patch = async (body: unknown) => {
    const { PATCH } = await import("@/app/api/mikrotik-routers/[id]/route");
    const request = new Request(
      "http://localhost/api/mikrotik-routers/router-1",
      {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      },
    );
    return (
      PATCH as unknown as (
        req: Request,
        ctx: { params: { id: string } },
      ) => Promise<{
        status?: number;
        details?: { fieldErrors: Record<string, string[]> };
      }>
    )(request, { params: { id: "router-1" } });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.permissions = [];
    mockFns.hasPermission.mockResolvedValue(true);
    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.updateRouter.mockResolvedValue(undefined);
  });

  it("menolak mode Redirect tanpa URL isolir dengan 400", async () => {
    const res = await patch({ isolirMode: "REDIRECT", isolirUrl: null });

    expect(res.status).toBe(400);
    expect(res.details?.fieldErrors.isolirUrl).toEqual([
      "URL isolir wajib diisi untuk mode Redirect",
    ]);
    expect(mockFns.updateRouter).not.toHaveBeenCalled();
  });

  it("meneruskan pindah ke halaman di router beserta URL yang dikosongkan", async () => {
    await patch({ isolirMode: "ROUTER_PAGE", isolirUrl: null });

    expect(mockFns.updateRouter).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isolirMode: "ROUTER_PAGE", isolirUrl: null },
      }),
    );
  });
});

describe("PATCH /api/mikrotik-routers/[id] Server isolir pada router publik", () => {
  it("dijawab 400 dengan pesan ValidationError, bukan konflik 409", async () => {
    const { ValidationError } = await import("@/lib/errors");
    mockFns.hasPermission.mockResolvedValue(true);
    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.updateRouter.mockRejectedValue(
      new ValidationError("Mode Server isolir hanya untuk router VPN"),
    );
    const { PATCH } = await import("@/app/api/mikrotik-routers/[id]/route");

    const res = (await (
      PATCH as unknown as (
        req: Request,
        ctx: { params: { id: string } },
      ) => Promise<{ status?: number; error?: string }>
    )(
      new Request("http://localhost/api/mikrotik-routers/router-1", {
        method: "PATCH",
        body: JSON.stringify({ isolirMode: "ISOLIR_SERVICE" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "router-1" } },
    )) as { status?: number; error?: string };

    expect(res.status).toBe(400);
    expect(res.error).toBe("Mode Server isolir hanya untuk router VPN");
  });
});

describe("DELETE /api/mikrotik-routers/[id]", () => {
  let DELETE: (typeof import("@/app/api/mikrotik-routers/[id]/route"))["DELETE"];

  beforeAll(async () => {
    ({ DELETE } = await import("@/app/api/mikrotik-routers/[id]/route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.permissions = [];

    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:delete") return true;
      return false;
    });

    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.deleteRouter.mockResolvedValue(undefined);
  });

  it("SUPER_ADMIN bypass site restriction saat delete router", async () => {
    mockFns.hasPermission.mockImplementation(async (permission: string) => {
      if (permission === "mikrotik:delete") return true;
      return false;
    });
    mockFns.permissions = ["mikrotik:site_only"];

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

// Regresi: GET/PATCH/DELETE dulu tidak memeriksa izin aksi sama sekali, jadi
// setiap pengguna tenant yang login (mis. Teknisi tanpa izin mikrotik) bisa
// membaca kredensial, mengubah, atau menghapus router.
describe("/api/mikrotik-routers/[id] — izin aksi wajib", () => {
  type Handler = (
    req: Request,
    ctx: { params: { id: string } },
  ) => Promise<{ status?: number }>;

  const kasus: ReadonlyArray<{
    method: "GET" | "PATCH" | "DELETE";
    permission: string;
    body?: string;
  }> = [
    { method: "GET", permission: "mikrotik:read" },
    {
      method: "PATCH",
      permission: "mikrotik:update",
      body: JSON.stringify({ name: "Router Baru" }),
    },
    { method: "DELETE", permission: "mikrotik:delete" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.permissions = [];
    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.getRouterById.mockResolvedValue({ id: "router-1" });
    mockFns.updateRouter.mockResolvedValue(undefined);
    mockFns.deleteRouter.mockResolvedValue(undefined);
  });

  async function panggil(method: "GET" | "PATCH" | "DELETE", body?: string) {
    const route = await import("@/app/api/mikrotik-routers/[id]/route");
    const handler = route[method] as unknown as Handler;
    return handler(
      new Request("http://localhost/api/mikrotik-routers/router-1", {
        method,
        body,
        headers: body ? { "content-type": "application/json" } : undefined,
      }),
      { params: { id: "router-1" } },
    );
  }

  it.each(kasus)(
    "$method tanpa $permission dijawab 403 tanpa menyentuh service",
    async ({ method, permission, body }) => {
      mockFns.hasPermission.mockResolvedValue(false);

      const res = await panggil(method, body);

      expect(res.status).toBe(403);
      expect(mockFns.hasPermission).toHaveBeenCalledWith(permission);
      expect(mockFns.getRouterById).not.toHaveBeenCalled();
      expect(mockFns.updateRouter).not.toHaveBeenCalled();
      expect(mockFns.deleteRouter).not.toHaveBeenCalled();
    },
  );

  it.each(kasus)(
    "$method hanya menerima $permission, bukan izin aksi lain",
    async ({ method, permission, body }) => {
      mockFns.hasPermission.mockImplementation(
        async (diminta: string) => diminta !== permission,
      );

      const res = await panggil(method, body);

      expect(res.status).toBe(403);
    },
  );

  it.each(kasus)(
    "$method dengan $permission diteruskan ke service",
    async ({ method, permission, body }) => {
      mockFns.hasPermission.mockImplementation(
        async (diminta: string) => diminta === permission,
      );

      const res = await panggil(method, body);

      expect(res.status).not.toBe(403);
      const service = {
        GET: mockFns.getRouterById,
        PATCH: mockFns.updateRouter,
        DELETE: mockFns.deleteRouter,
      }[method];
      expect(service).toHaveBeenCalledTimes(1);
    },
  );
});
