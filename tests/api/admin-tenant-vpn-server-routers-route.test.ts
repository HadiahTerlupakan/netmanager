import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  isSuperAdmin: vi.fn(),
  append: vi.fn(),
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
    appendServerToTenantRouters: mocks.append,
  }),
}));

import { POST } from "@/app/api/admin/tenants/[id]/vpn-servers/[serverId]/routers/route";
import { VpnServerNotAvailableError } from "@/modules/network/vpn";

const route = (serverId: string) =>
  ({ params: { id: "t1", serverId } }) as never;
const req = {} as never;

describe("admin tenant vpn-server routers route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSuperAdmin.mockReturnValue(true);
  });

  it("is 403 for non-superadmin", async () => {
    mocks.isSuperAdmin.mockReturnValue(false);
    expect((await POST(req, route("a1"))).status).toBe(403);
    expect(mocks.append).not.toHaveBeenCalled();
  });

  it("rejects a malformed server id with 400", async () => {
    expect((await POST(req, route("NOT HEX"))).status).toBe(400);
    expect(mocks.append).not.toHaveBeenCalled();
  });

  it("returns the updated count", async () => {
    mocks.append.mockResolvedValue({ updated: 4 });
    const res = await POST(req, route("a1"));
    expect((await res.json()).data).toEqual({ updated: 4 });
    expect(mocks.append).toHaveBeenCalledWith("t1", "a1");
  });

  it("maps an unavailable server to 400", async () => {
    mocks.append.mockRejectedValue(new VpnServerNotAvailableError());
    expect((await POST(req, route("a1"))).status).toBe(400);
  });
});
