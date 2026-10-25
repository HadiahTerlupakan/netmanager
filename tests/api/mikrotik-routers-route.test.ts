import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  createRouter: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler:
    (_o: unknown, handler: (req: unknown, ctx: unknown) => unknown) =>
    (req: unknown) =>
      handler(req, { session: { user: { id: "u1", tenantId: "t1" } } }),
  apiSuccess: (data: unknown, options?: { status?: number }) =>
    NextResponse.json({ success: true, data }, { status: options?.status }),
  apiError: (
    error: string,
    code: string,
    options?: { status?: number; details?: unknown },
  ) =>
    NextResponse.json(
      { success: false, error, code, details: options?.details },
      { status: options?.status },
    ),
  ApiErrors: {
    forbidden: (message?: string) =>
      NextResponse.json({ success: false, error: message }, { status: 403 }),
  },
  ErrorCodes: {
    VALIDATION_ERROR: "VALIDATION_ERROR",
    CONFLICT: "CONFLICT",
    INTERNAL_ERROR: "INTERNAL_ERROR",
  },
}));
vi.mock("@/lib/rbac", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/auth", () => ({ isSuperAdmin: () => false }));
vi.mock("@/modules/network", async () => {
  const errors = await import("@/modules/network/vpn/errors");
  const http = await import("@/modules/network/vpn/vpnHttpErrors");
  const routerErrors =
    await import("@/modules/network/domain/errors/RouterErrors");
  const access =
    await import("@/modules/network/services/mikrotik-router.access");
  return {
    ...errors,
    vpnConfiguredGuard: http.vpnConfiguredGuard,
    vpnErrorResponse: http.vpnErrorResponse,
    isVpnError: http.isVpnError,
    RouterIpConflictError: routerErrors.RouterIpConflictError,
    RouterAccessDeniedError: access.RouterAccessDeniedError,
    MikroTikRouterService: class {
      createRouter = mocks.createRouter;
    },
  };
});

import { POST } from "@/app/api/mikrotik-routers/route";
import {
  VpnDraftForbiddenError,
  VpnDraftInvalidError,
  VpnRouterActivationError,
} from "@/modules/network/vpn/errors";

const req = (body: unknown) => ({ json: async () => body }) as never;

const publicBody = {
  name: "R1",
  ipAddress: "203.0.113.5",
  apiUsername: "admin",
  apiPassword: "secret",
  apiPort: 8728,
};

const vpnBody = {
  ...publicBody,
  ipAddress: "10.100.0.10",
  rosVersion: "V7",
  connectionMode: "VPN",
  vpnServerIds: ["aa", "bb"],
  vpnDraftId: "ab01",
};

async function post(body: unknown) {
  const res = (await POST(req(body), {} as never)) as Response;
  return { status: res.status, body: await res.json() };
}

describe("POST /api/mikrotik-routers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasPermission.mockImplementation(
      async (perm: string) => perm === "mikrotik:create",
    );
    mocks.createRouter.mockResolvedValue({ id: "r1" });
    vi.stubEnv("VPN_CORE_API_URL", "https://core.example");
    vi.stubEnv("VPN_API_TOKEN", "token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("router PUBLIC tanpa field baru diteruskan apa adanya", async () => {
    const { status } = await post(publicBody);

    expect(status).toBe(201);
    expect(mocks.createRouter).toHaveBeenCalledWith(
      expect.objectContaining({ data: publicBody, tenantId: "t1" }),
    );
  });

  it("router VPN diteruskan beserta draft dan urutan server", async () => {
    const { status } = await post(vpnBody);

    expect(status).toBe(201);
    expect(mocks.createRouter.mock.calls[0][0].data).toMatchObject({
      connectionMode: "VPN",
      rosVersion: "V7",
      vpnServerIds: ["aa", "bb"],
      vpnDraftId: "ab01",
    });
  });

  it("mode VPN saat core belum dikonfigurasi -> 503", async () => {
    vi.stubEnv("VPN_API_TOKEN", "");

    const { status } = await post(vpnBody);

    expect(status).toBe(503);
    expect(mocks.createRouter).not.toHaveBeenCalled();
  });

  it.each([
    ["RouterOS v6", { rosVersion: "V6" }],
    ["tanpa server", { vpnServerIds: [] }],
    ["tanpa draft", { vpnDraftId: undefined }],
    ["id draft tidak valid", { vpnDraftId: "AB-01" }],
    ["id server tidak valid", { vpnServerIds: ["zz"] }],
    ["server ganda", { vpnServerIds: ["aa", "aa"] }],
    ["port API bukan 8728", { apiPort: 8729 }],
  ])("mode VPN %s -> 400", async (_case, overrides) => {
    const { status } = await post({ ...vpnBody, ...overrides });

    expect(status).toBe(400);
    expect(mocks.createRouter).not.toHaveBeenCalled();
  });

  it.each([
    ["draft tenant lain", new VpnDraftForbiddenError(), 403],
    [
      "alamat beda",
      new VpnDraftInvalidError("IP Router tidak cocok dengan draft VPN"),
      400,
    ],
    ["claim gagal", new VpnRouterActivationError(), 502],
  ])("%s -> %s", async (_case, error, expected) => {
    mocks.createRouter.mockRejectedValue(error);

    const { status, body } = await post(vpnBody);

    expect(status).toBe(expected);
    expect(body.error ?? body.message).toBe(error.message);
  });

  it("mode Redirect tanpa URL isolir -> 400 dengan pesan", async () => {
    const { status, body } = await post({
      ...publicBody,
      isolirMode: "REDIRECT",
      isolirUrl: "  ",
    });

    expect(status).toBe(400);
    expect(body.details.fieldErrors.isolirUrl).toEqual([
      "URL isolir wajib diisi untuk mode Redirect",
    ]);
    expect(mocks.createRouter).not.toHaveBeenCalled();
  });

  it("mode Redirect dengan URL diteruskan ke service", async () => {
    const { status } = await post({
      ...publicBody,
      isolirMode: "REDIRECT",
      isolirUrl: "https://isolir.example/info",
    });

    expect(status).toBe(201);
    expect(mocks.createRouter.mock.calls[0][0].data).toMatchObject({
      isolirMode: "REDIRECT",
      isolirUrl: "https://isolir.example/info",
    });
  });

  it("mode isolir di luar pilihan -> 400", async () => {
    const { status } = await post({ ...publicBody, isolirMode: "PROXY" });

    expect(status).toBe(400);
    expect(mocks.createRouter).not.toHaveBeenCalled();
  });

  it("galat lain tetap 500 Gagal membuat router", async () => {
    mocks.createRouter.mockRejectedValue(new Error("boom"));

    const { status, body } = await post(vpnBody);

    expect(status).toBe(500);
    expect(body.error).toBe("Gagal membuat router");
  });
});
