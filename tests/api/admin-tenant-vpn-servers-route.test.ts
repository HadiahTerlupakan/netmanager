import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  isSuperAdmin: vi.fn(),
  getTenantServerIds: vi.fn(),
  setTenantServers: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler:
    (_o: unknown, handler: (req: unknown, ctx: unknown) => unknown) =>
    (req: unknown, route: { params: Record<string, string> }) =>
      handler(req, { params: route.params, session: { user: { id: "u1" } } }),
  apiSuccess: (data: unknown) => NextResponse.json({ success: true, data }),
  ApiErrors: {
    forbidden: () => NextResponse.json({ success: false }, { status: 403 }),
    badRequest: (message: string) =>
      NextResponse.json({ success: false, error: message }, { status: 400 }),
  },
}));
vi.mock("@/lib/auth", () => ({ isSuperAdmin: mocks.isSuperAdmin }));
vi.mock("@/modules/network/factories/VpnServerServiceFactory", () => ({
  createVpnServerService: () => ({
    getTenantServerIds: mocks.getTenantServerIds,
    setTenantServers: mocks.setTenantServers,
  }),
}));

import { GET, PUT } from "@/app/api/admin/tenants/[id]/vpn-servers/route";
import {
  VpnServerInUseError,
  VpnServerUnknownError,
} from "@/modules/network/vpn";

const route = { params: { id: "t1" } } as never;
const req = (body?: unknown) => ({ json: async () => body }) as never;

describe("admin tenant vpn-servers route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSuperAdmin.mockReturnValue(true);
  });

  it("is 403 for non-superadmin on GET and PUT", async () => {
    mocks.isSuperAdmin.mockReturnValue(false);
    expect((await GET(req(), route)).status).toBe(403);
    expect((await PUT(req({ serverIds: [] }), route)).status).toBe(403);
  });

  it("GET returns the tenant's server ids", async () => {
    mocks.getTenantServerIds.mockResolvedValue(["h1"]);
    const res = await GET(req(), route);
    expect((await res.json()).data).toEqual({ serverIds: ["h1"] });
  });

  it("PUT rejects duplicate ids with 400", async () => {
    const res = await PUT(req({ serverIds: ["h1", "h1"] }), route);
    expect(res.status).toBe(400);
    expect(mocks.setTenantServers).not.toHaveBeenCalled();
  });

  it("PUT maps an unknown server to 400 and an in-use revoke to 409", async () => {
    mocks.setTenantServers.mockRejectedValueOnce(new VpnServerUnknownError());
    expect((await PUT(req({ serverIds: ["g"] }), route)).status).toBe(400);
    mocks.setTenantServers.mockRejectedValueOnce(new VpnServerInUseError([]));
    expect((await PUT(req({ serverIds: [] }), route)).status).toBe(409);
  });

  it("PUT saves the assignment", async () => {
    mocks.setTenantServers.mockResolvedValue(undefined);
    const res = await PUT(req({ serverIds: ["h1"] }), route);
    expect(res.status).toBe(200);
    expect(mocks.setTenantServers).toHaveBeenCalledWith("t1", ["h1"]);
  });
});
