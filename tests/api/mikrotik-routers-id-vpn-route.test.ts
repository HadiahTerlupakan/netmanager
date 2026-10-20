import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  getRouterById: vi.fn(),
  getRouterVpn: vi.fn(),
  updateServers: vi.fn(),
  returnToFirstServer: vi.fn(),
  isVpnConfigured: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler:
    (_o: unknown, handler: (req: unknown, ctx: unknown) => unknown) =>
    (req: unknown, route?: { params?: Record<string, string> }) =>
      handler(req, {
        params: route?.params ?? {},
        session: { user: { id: "u1", tenantId: "t1" } },
      }),
  apiSuccess: (data: unknown, options?: { status?: number }) =>
    NextResponse.json({ success: true, data }, { status: options?.status }),
  ApiErrors: {
    badRequest: (message: string) =>
      NextResponse.json({ success: false, error: message }, { status: 400 }),
  },
}));
vi.mock("@/lib/rbac", () => ({ hasPermission: mocks.hasPermission }));
vi.mock(
  "@/modules/network/services/MikroTikRouterService",
  async (importActual) => ({
    ...(await importActual<object>()),
    MikroTikRouterService: class {
      getRouterById = mocks.getRouterById;
    },
  }),
);
vi.mock("@/modules/network/factories/VpnRouterServiceFactory", () => ({
  createVpnRouterService: () => ({
    getRouterVpn: mocks.getRouterVpn,
    updateServers: mocks.updateServers,
    returnToFirstServer: mocks.returnToFirstServer,
  }),
}));
vi.mock("@/modules/network/vpn/VpnCoreClient", async (importActual) => ({
  ...(await importActual<object>()),
  isVpnConfigured: mocks.isVpnConfigured,
}));

import * as vpnRoute from "@/app/api/mikrotik-routers/[id]/vpn/route";
import * as firstServerRoute from "@/app/api/mikrotik-routers/[id]/vpn/first-server/route";
import { VpnRouterInvalidError } from "@/modules/network/vpn";
import { RouterNotFoundError } from "@/modules/network/services/mikrotik-router.access";

const params = { params: { id: "router-1" } } as never;
const req = (body?: unknown) => ({ json: async () => body }) as never;

describe("/api/mikrotik-routers/[id]/vpn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasPermission.mockImplementation(
      async (permission: string) => permission !== "mikrotik:site_only",
    );
    mocks.isVpnConfigured.mockReturnValue(true);
    mocks.getRouterById.mockResolvedValue({ id: "router-1" });
  });

  it("answers 503 when VPN is not configured", async () => {
    mocks.isVpnConfigured.mockReturnValue(false);

    const res = await vpnRoute.GET(req(), params);

    expect(res.status).toBe(503);
    expect(mocks.getRouterVpn).not.toHaveBeenCalled();
  });

  it("requires mikrotik:update to change the server list", async () => {
    mocks.hasPermission.mockImplementation(
      async (permission: string) => permission === "mikrotik:read",
    );

    const res = await vpnRoute.PUT(req({ serverIds: ["aa"] }), params);

    expect(res.status).toBe(403);
    expect(mocks.hasPermission).toHaveBeenCalledWith("mikrotik:update");
    expect(mocks.updateServers).not.toHaveBeenCalled();
  });

  it("answers 404 for a router outside the tenant", async () => {
    mocks.getRouterById.mockRejectedValue(new RouterNotFoundError("x"));

    const res = await vpnRoute.GET(req(), params);

    expect(res.status).toBe(404);
  });

  it("answers 400 for a router that does not use VPN", async () => {
    mocks.getRouterVpn.mockRejectedValue(
      new VpnRouterInvalidError("Router ini tidak memakai VPN"),
    );

    const res = await vpnRoute.GET(req(), params);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Router ini tidak memakai VPN");
  });

  it("rejects an empty or duplicated server list", async () => {
    expect((await vpnRoute.PUT(req({ serverIds: [] }), params)).status).toBe(
      400,
    );
    expect(
      (await vpnRoute.PUT(req({ serverIds: ["aa", "aa"] }), params)).status,
    ).toBe(400);
    expect(mocks.updateServers).not.toHaveBeenCalled();
  });

  it("answers 202 when the list is saved but the script is not on the router yet", async () => {
    mocks.updateServers.mockResolvedValue({ scriptStale: true });

    const res = await vpnRoute.PUT(req({ serverIds: ["aa", "bb"] }), params);

    expect(res.status).toBe(202);
    expect(mocks.updateServers).toHaveBeenCalledWith("router-1", "t1", [
      "aa",
      "bb",
    ]);
  });

  it("answers 200 when the script reached the router", async () => {
    mocks.updateServers.mockResolvedValue({ scriptStale: false });

    const res = await vpnRoute.PUT(req({ serverIds: ["aa"] }), params);

    expect(res.status).toBe(200);
  });

  it("returns the router to its first server", async () => {
    mocks.returnToFirstServer.mockResolvedValue(undefined);

    const res = await firstServerRoute.POST(req(), params);

    expect(res.status).toBe(200);
    expect(mocks.returnToFirstServer).toHaveBeenCalledWith("router-1", "t1");
  });
});
