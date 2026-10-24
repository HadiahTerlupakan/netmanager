import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  listTenantServers: vi.fn(),
  createDraft: vi.fn(),
  getRouter: vi.fn(),
  createRouter: vi.fn(),
  routerScript: vi.fn(),
  now: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler:
    (_o: unknown, handler: (req: unknown, ctx: unknown) => unknown) =>
    (req: unknown, route?: { params?: Record<string, string> }) =>
      handler(req, {
        params: route?.params ?? {},
        session: { user: { id: "u1", tenantId: "t1" } },
      }),
  apiSuccess: (data: unknown, options?: { headers?: Record<string, string> }) =>
    NextResponse.json({ success: true, data }, { headers: options?.headers }),
  ApiErrors: {
    forbidden: () => NextResponse.json({ success: false }, { status: 403 }),
    badRequest: (message: string) =>
      NextResponse.json({ success: false, error: message }, { status: 400 }),
  },
}));
vi.mock("@/lib/rbac", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/modules/network/factories/VpnDraftServiceFactory", async () => {
  const { VpnDraftService } =
    await import("@/modules/network/services/VpnDraftService");
  return {
    createVpnDraftService: () =>
      new VpnDraftService(
        {
          tenantServers: async () => [
            {
              id: "aa",
              name: "A",
              publicHost: "a.example.com",
              status: "online",
              protocols: ["wireguard"],
            },
          ],
        } as never,
        mocks.now,
      ),
  };
});
vi.mock("@/modules/network/vpn/VpnCoreClient", async (importActual) => ({
  ...(await importActual<object>()),
  getVpnCoreClient: () => ({
    getRouter: mocks.getRouter,
    createRouter: mocks.createRouter,
    routerScript: mocks.routerScript,
  }),
}));

import * as serversRoute from "@/app/api/vpn-servers/route";
import * as draftRoute from "@/app/api/mikrotik-routers/vpn-draft/route";
import * as statusRoute from "@/app/api/mikrotik-routers/vpn-draft/[draftId]/status/route";

const req = (body?: unknown) => ({ json: async () => body }) as never;
const statusParams = { params: { draftId: "ab01" } } as never;
const NOW = Date.parse("2026-10-20T10:00:00.000Z");

const coreRouter = (overrides: object = {}) => ({
  id: "ab01",
  label: "nm:t1",
  address: "10.100.0.10",
  hubs: [{ hubId: "aa", name: "A", priority: 0, syncState: "synced" }],
  activeHubId: "aa",
  lastHandshakeAt: null as string | null,
  ...overrides,
});

describe("tenant VPN routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasPermission.mockResolvedValue(true);
    mocks.now.mockReturnValue(NOW);
    process.env.VPN_CORE_API_URL = "http://core";
    process.env.VPN_API_TOKEN = "tok";
  });

  it("GET /api/vpn-servers is 403 without mikrotik:read", async () => {
    mocks.hasPermission.mockResolvedValue(false);
    const res = await serversRoute.GET(req(), undefined as never);
    expect(res.status).toBe(403);
    expect(mocks.hasPermission).toHaveBeenCalledWith("mikrotik:read");
  });

  it("GET /api/vpn-servers returns the tenant's servers", async () => {
    const res = await serversRoute.GET(req(), undefined as never);
    expect((await res.json()).data.servers).toEqual([
      {
        id: "aa",
        name: "A",
        publicHost: "a.example.com",
        status: "online",
        protocols: ["wireguard"],
      },
    ]);
  });

  it("POST vpn-draft is 403 without mikrotik:create", async () => {
    mocks.hasPermission.mockResolvedValue(false);
    const res = await draftRoute.POST(
      req({ serverIds: ["aa"] }),
      undefined as never,
    );
    expect(res.status).toBe(403);
    expect(mocks.hasPermission).toHaveBeenCalledWith("mikrotik:create");
    expect(mocks.createRouter).not.toHaveBeenCalled();
  });

  it("POST vpn-draft is 503 when VPN is not configured", async () => {
    delete process.env.VPN_CORE_API_URL;
    const res = await draftRoute.POST(
      req({ serverIds: ["aa"] }),
      undefined as never,
    );
    expect(res.status).toBe(503);
  });

  it.each([
    ["no servers", { serverIds: [] }],
    ["duplicate servers", { serverIds: ["aa", "aa"] }],
    ["short password", { serverIds: ["aa"], apiPassword: "short" }],
    [
      "password with a quote",
      { serverIds: ["aa"], apiPassword: `${"a".repeat(24)}"` },
    ],
    ["bad username", { serverIds: ["aa"], apiUsername: "admin" }],
  ])("POST vpn-draft rejects %s with 400", async (_n, body) => {
    const res = await draftRoute.POST(req(body), undefined as never);
    expect(res.status).toBe(400);
    expect(mocks.createRouter).not.toHaveBeenCalled();
  });

  it("POST vpn-draft maps an unavailable server to 400 with the fixed message", async () => {
    const res = await draftRoute.POST(
      req({ serverIds: ["ee"] }),
      undefined as never,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(
      "Server VPN tidak tersedia untuk tenant ini",
    );
  });

  it("POST vpn-draft maps another tenant's previous draft to 403", async () => {
    mocks.getRouter.mockResolvedValue(coreRouter({ label: "nm:other" }));
    const res = await draftRoute.POST(
      req({ serverIds: ["aa"], previousDraftId: "ee" }),
      undefined as never,
    );
    expect(res.status).toBe(403);
  });

  it("POST vpn-draft returns the draft with a script", async () => {
    mocks.createRouter.mockResolvedValue(coreRouter());
    mocks.routerScript.mockResolvedValue("# core\n");
    const res = await draftRoute.POST(
      req({ serverIds: ["aa"] }),
      undefined as never,
    );
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const data = (await res.json()).data;
    expect(data.draftId).toBe("ab01");
    expect(data.script).toContain("# core");
  });

  it("POST vpn-draft forwards the chosen protocol and rejects an unknown one", async () => {
    mocks.createRouter.mockResolvedValue(coreRouter());
    mocks.routerScript.mockResolvedValue("# core\n");
    const bad = await draftRoute.POST(
      req({ serverIds: ["aa"], protocol: "PPTP" }),
      undefined as never,
    );
    expect(bad.status).toBe(400);
    const wg = await draftRoute.POST(
      req({ serverIds: ["aa"] }),
      undefined as never,
    );
    expect(wg.status).toBe(200);
    expect(mocks.createRouter).toHaveBeenCalledWith(
      expect.objectContaining({ protocol: "wireguard" }),
    );
  });

  it("status is tunnel_up for a fresh handshake and waiting for a stale one", async () => {
    mocks.getRouter.mockResolvedValueOnce(
      coreRouter({ lastHandshakeAt: new Date(NOW - 60_000).toISOString() }),
    );
    let res = await statusRoute.GET(req(), statusParams);
    expect((await res.json()).data.stage).toBe("tunnel_up");
    mocks.getRouter.mockResolvedValueOnce(
      coreRouter({ lastHandshakeAt: new Date(NOW - 600_000).toISOString() }),
    );
    res = await statusRoute.GET(req(), statusParams);
    expect((await res.json()).data.stage).toBe("waiting");
  });

  it("status rejects a non-hex draft id with 400", async () => {
    const res = await statusRoute.GET(req(), {
      params: { draftId: "../x" },
    } as never);
    expect(res.status).toBe(400);
    expect(mocks.getRouter).not.toHaveBeenCalled();
  });

  it("POST vpn-draft rejects non-hex ids with 400", async () => {
    for (const body of [
      { serverIds: ["../a"] },
      { serverIds: ["aa"], previousDraftId: "../a" },
    ]) {
      const res = await draftRoute.POST(req(body), undefined as never);
      expect(res.status).toBe(400);
    }
  });

  it("status is 403 without mikrotik:create", async () => {
    mocks.hasPermission.mockResolvedValue(false);
    const res = await statusRoute.GET(req(), statusParams);
    expect(res.status).toBe(403);
  });
});
