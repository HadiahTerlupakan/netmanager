import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  getRouterById: vi.fn(),
  previewScript: vi.fn(),
  apply: vi.fn(),
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
vi.mock("@/modules/network/factories/VpnRouterProtocolServiceFactory", () => ({
  createVpnRouterProtocolService: () => ({
    previewScript: mocks.previewScript,
    apply: mocks.apply,
  }),
}));
vi.mock("@/modules/network/vpn/VpnCoreClient", async (importActual) => ({
  ...(await importActual<object>()),
  isVpnConfigured: mocks.isVpnConfigured,
}));

import * as scriptRoute from "@/app/api/mikrotik-routers/[id]/vpn/protocol-script/route";
import * as protocolRoute from "@/app/api/mikrotik-routers/[id]/vpn/protocol/route";
import {
  VpnRouterInvalidError,
  VpnServerNotAvailableError,
} from "@/modules/network/vpn";
import { RouterNotFoundError } from "@/modules/network/services/mikrotik-router.access";

const params = { params: { id: "router-1" } } as never;
const req = (body?: unknown) => ({ json: async () => body }) as never;

describe("/api/mikrotik-routers/[id]/vpn/protocol-script dan /protocol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasPermission.mockImplementation(
      async (permission: string) => permission !== "mikrotik:site_only",
    );
    mocks.isVpnConfigured.mockReturnValue(true);
    mocks.getRouterById.mockResolvedValue({ id: "router-1" });
  });

  it("rute protocol-script butuh mikrotik:update dan router milik tenant", async () => {
    mocks.hasPermission.mockImplementation(
      async (permission: string) => permission === "mikrotik:read",
    );
    const denied = await scriptRoute.POST(req({ protocol: "L2TP" }), params);
    expect(denied.status).toBe(403);
    expect(mocks.hasPermission).toHaveBeenCalledWith("mikrotik:update");

    mocks.hasPermission.mockImplementation(
      async (permission: string) => permission !== "mikrotik:site_only",
    );
    mocks.getRouterById.mockRejectedValue(new RouterNotFoundError("x"));
    const missing = await scriptRoute.POST(req({ protocol: "L2TP" }), params);
    expect(missing.status).toBe(404);
    expect(mocks.getRouterById).toHaveBeenCalledWith(
      expect.objectContaining({ id: "router-1", tenantId: "t1" }),
    );

    expect(mocks.previewScript).not.toHaveBeenCalled();
  });

  it("mengembalikan teks script untuk protokol terpilih", async () => {
    mocks.previewScript.mockResolvedValue("/interface l2tp-client add");

    const res = await scriptRoute.POST(req({ protocol: "L2TP" }), params);

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({
      script: "/interface l2tp-client add",
    });
    expect(mocks.previewScript).toHaveBeenCalledWith("router-1", "t1", "L2TP");
  });

  it("menolak protokol yang tidak dikenal atau kosong", async () => {
    for (const body of [{ protocol: "PPTP" }, {}]) {
      expect((await scriptRoute.POST(req(body), params)).status).toBe(400);
      expect((await protocolRoute.POST(req(body), params)).status).toBe(400);
    }
    expect(mocks.previewScript).not.toHaveBeenCalled();
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("menjawab 400 untuk server yang tidak mendukung protokol", async () => {
    mocks.previewScript.mockRejectedValue(new VpnServerNotAvailableError());

    const res = await scriptRoute.POST(req({ protocol: "L2TP" }), params);

    expect(res.status).toBe(400);
  });

  it("rute protocol butuh mikrotik:update", async () => {
    mocks.hasPermission.mockImplementation(
      async (permission: string) => permission === "mikrotik:read",
    );

    const res = await protocolRoute.POST(req({ protocol: "L2TP" }), params);

    expect(res.status).toBe(403);
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("menerapkan protokol dan menolak protokol saat ini", async () => {
    mocks.apply.mockResolvedValue(undefined);
    const ok = await protocolRoute.POST(req({ protocol: "L2TP" }), params);
    expect(ok.status).toBe(200);
    expect(mocks.apply).toHaveBeenCalledWith("router-1", "t1", "L2TP");

    mocks.apply.mockRejectedValue(
      new VpnRouterInvalidError("Router sudah memakai protokol ini"),
    );
    const same = await protocolRoute.POST(req({ protocol: "L2TP" }), params);
    expect(same.status).toBe(400);
    expect((await same.json()).error).toBe("Router sudah memakai protokol ini");
  });
});
