import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  testConnection: vi.fn(),
  permissions: [] as string[],
}));

vi.mock("@/lib/api", async (importActual) => ({
  ...(await importActual<object>()),
  createHandler:
    (
      _options: unknown,
      handler: (req: Request, ctx: unknown) => Promise<Response>,
    ) =>
    (req: Request) =>
      handler(req, {
        session: { user: { id: "u1", tenantId: "tenant-1" } },
        permissions: mockFns.permissions,
      }),
}));

vi.mock("@/lib/rbac", () => ({ hasPermission: mockFns.hasPermission }));

vi.mock("@/modules/network", async () => {
  const vpnHttp = await import("@/modules/network/vpn/vpnHttpErrors");
  const access =
    await import("@/modules/network/services/mikrotik-router.access");
  return {
    isRestrictedToOwnRouterSite: access.isRestrictedToOwnRouterSite,
    RouterAccessDeniedError: access.RouterAccessDeniedError,
    RouterNotFoundError: access.RouterNotFoundError,
    MikroTikRouterService: class {
      testConnection = mockFns.testConnection;
    },
    isVpnError: vpnHttp.isVpnError,
    vpnErrorResponse: vpnHttp.vpnErrorResponse,
  };
});

import { POST } from "@/app/api/mikrotik-routers/test-connection/route";
import { VpnRouterInvalidError } from "@/modules/network/vpn/errors";

function post(body: object): Promise<Response> {
  return (POST as unknown as (req: Request) => Promise<Response>)(
    new Request("http://localhost/api/mikrotik-routers/test-connection", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("POST /api/mikrotik-routers/test-connection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.hasPermission.mockResolvedValue(true);
    mockFns.permissions = ["mikrotik:read"];
  });

  it("meneruskan vpnDraftId ke service", async () => {
    mockFns.testConnection.mockResolvedValue({
      apiResult: { success: true, message: "OK" },
      routerInfo: null,
      resolvedRouterId: null,
    });

    await post({ ipAddress: "10.100.0.5", vpnDraftId: "d1", apiPort: 8728 });

    expect(mockFns.testConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        ipAddress: "10.100.0.5",
        vpnDraftId: "d1",
      }),
    );
  });

  it("menjawab 400 untuk alamat overlay yang bukan milik draft tenant", async () => {
    mockFns.testConnection.mockRejectedValue(
      new VpnRouterInvalidError("Alamat ini khusus jaringan VPN"),
    );

    const res = await post({ ipAddress: "10.100.0.5" });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Alamat ini khusus jaringan VPN");
  });

  it("meneruskan mikrotik:site_only ke service", async () => {
    mockFns.permissions = ["mikrotik:read", "mikrotik:site_only"];
    mockFns.testConnection.mockResolvedValue({
      apiResult: { success: true },
      routerInfo: null,
    });

    await post({ routerId: "r1" });

    expect(mockFns.testConnection).toHaveBeenCalledWith(
      expect.objectContaining({ routerId: "r1", restrictedToOwnSite: true }),
    );
  });

  it("role wildcard non-super tidak dianggap dibatasi", async () => {
    mockFns.permissions = ["*"];
    mockFns.testConnection.mockResolvedValue({
      apiResult: { success: true },
      routerInfo: null,
    });

    await post({ routerId: "r1" });

    expect(mockFns.testConnection).toHaveBeenCalledWith(
      expect.objectContaining({ restrictedToOwnSite: false }),
    );
  });

  it("router di luar site dijawab 403", async () => {
    const { RouterAccessDeniedError } =
      await import("@/modules/network/services/mikrotik-router.access");
    mockFns.testConnection.mockRejectedValue(new RouterAccessDeniedError("x"));

    const res = await post({ routerId: "r1" });

    expect(res.status).toBe(403);
  });
});
