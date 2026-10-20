import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  isSuperAdmin: vi.fn(),
  listServers: vi.fn(),
  createServer: vi.fn(),
  deleteServer: vi.fn(),
  reissue: vi.fn(),
  upgradeCommand: vi.fn(),
  listAdminPeers: vi.fn(),
  createAdminPeer: vi.fn(),
  deleteAdminPeer: vi.fn(),
  adminPeerConfig: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler:
    (_o: unknown, handler: (req: unknown, ctx: unknown) => unknown) =>
    (req: unknown, route?: { params?: Record<string, string> }) =>
      handler(req, {
        params: route?.params ?? {},
        session: { user: { id: "u1", tenantId: "t1" } },
      }),
  apiSuccess: (data: unknown, o?: { status?: number }) =>
    NextResponse.json({ success: true, data }, { status: o?.status ?? 200 }),
  ApiErrors: {
    forbidden: () => NextResponse.json({ success: false }, { status: 403 }),
    badRequest: (message: string) =>
      NextResponse.json({ success: false, error: message }, { status: 400 }),
  },
}));
vi.mock("@/lib/auth", () => ({ isSuperAdmin: mocks.isSuperAdmin }));
vi.mock("@/modules/network/factories/VpnServerServiceFactory", () => ({
  createVpnServerService: () => ({
    listServers: mocks.listServers,
    createServer: mocks.createServer,
    deleteServer: mocks.deleteServer,
    reissue: mocks.reissue,
    upgradeCommand: mocks.upgradeCommand,
    listAdminPeers: mocks.listAdminPeers,
    createAdminPeer: mocks.createAdminPeer,
    deleteAdminPeer: mocks.deleteAdminPeer,
    adminPeerConfig: mocks.adminPeerConfig,
  }),
}));

import * as serversRoute from "@/app/api/admin/vpn-servers/route";
import * as serverIdRoute from "@/app/api/admin/vpn-servers/[id]/route";
import * as reissueRoute from "@/app/api/admin/vpn-servers/[id]/reissue/route";
import * as upgradeRoute from "@/app/api/admin/vpn-servers/[id]/upgrade-command/route";
import * as peersRoute from "@/app/api/admin/vpn-admin-peers/route";
import * as peerIdRoute from "@/app/api/admin/vpn-admin-peers/[id]/route";
import * as peerConfigRoute from "@/app/api/admin/vpn-admin-peers/[id]/config/route";
import { VpnCoreError, VpnServerInUseError } from "@/modules/network/vpn";

const route = { params: { id: "x1" } };
const req = (body?: unknown) =>
  ({ json: async () => body }) as unknown as never;

const handlers: [string, (r: never, c?: never) => Promise<NextResponse>][] = [
  ["GET servers", serversRoute.GET as never],
  ["POST servers", serversRoute.POST as never],
  ["DELETE server", serverIdRoute.DELETE as never],
  ["POST reissue", reissueRoute.POST as never],
  ["GET upgrade-command", upgradeRoute.GET as never],
  ["GET peers", peersRoute.GET as never],
  ["POST peers", peersRoute.POST as never],
  ["DELETE peer", peerIdRoute.DELETE as never],
  ["GET peer config", peerConfigRoute.GET as never],
];

describe("admin VPN routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSuperAdmin.mockReturnValue(true);
    process.env.VPN_CORE_API_URL = "http://core";
    process.env.VPN_API_TOKEN = "tok";
  });

  it.each(handlers)("%s is 403 for non-superadmin", async (_n, handler) => {
    mocks.isSuperAdmin.mockReturnValue(false);
    const res = await handler(req({}), route as never);
    expect(res.status).toBe(403);
  });

  it.each(handlers)(
    "%s is 503 when VPN is not configured",
    async (_n, handler) => {
      delete process.env.VPN_CORE_API_URL;
      const res = await handler(req({}), route as never);
      expect(res.status).toBe(503);
    },
  );

  it("POST servers rejects an invalid body with 400", async () => {
    const res = await serversRoute.POST(
      req({ name: "", publicHost: "h" }) as never,
      undefined as never,
    );
    expect(res.status).toBe(400);
    expect(mocks.createServer).not.toHaveBeenCalled();
  });

  it("POST peers rejects an empty label with 400", async () => {
    const res = await peersRoute.POST(
      req({ label: "" }) as never,
      undefined as never,
    );
    expect(res.status).toBe(400);
  });

  it("POST servers creates and returns 201", async () => {
    mocks.createServer.mockResolvedValue({
      server: { id: "h" },
      installCommand: "c",
    });
    const res = await serversRoute.POST(
      req({ name: "A", publicHost: "h.example.com" }) as never,
      undefined as never,
    );
    expect(res.status).toBe(201);
    expect(mocks.createServer).toHaveBeenCalledWith({
      name: "A",
      publicHost: "h.example.com",
    });
  });

  it("DELETE server maps VpnServerInUseError to 409 with the routers", async () => {
    const routers = [{ id: "r1", name: "RB1", tenantName: "T" }];
    mocks.deleteServer.mockRejectedValue(new VpnServerInUseError(routers));
    const res = await serverIdRoute.DELETE(req() as never, route as never);
    expect(res.status).toBe(409);
    expect((await res.json()).details).toEqual({ routers });
  });

  it("maps core 404 to 404 and core timeout to 502", async () => {
    mocks.reissue.mockRejectedValue(new VpnCoreError(404, "not_found"));
    expect(
      (await reissueRoute.POST(req() as never, route as never)).status,
    ).toBe(404);
    mocks.reissue.mockRejectedValue(new VpnCoreError(504, "timeout"));
    expect(
      (await reissueRoute.POST(req() as never, route as never)).status,
    ).toBe(502);
  });

  it("GET upgrade-command returns the command as JSON", async () => {
    mocks.upgradeCommand.mockResolvedValue("docker pull x");
    const res = await upgradeRoute.GET(req() as never, route as never);
    expect((await res.json()).data).toEqual({ command: "docker pull x" });
  });

  it("GET peer config returns an attachment of plain text", async () => {
    mocks.adminPeerConfig.mockResolvedValue("[Interface]\n");
    const res = await peerConfigRoute.GET(req() as never, route as never);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="netmanager-admin-x1.conf"',
    );
    expect(await res.text()).toBe("[Interface]\n");
  });
});
