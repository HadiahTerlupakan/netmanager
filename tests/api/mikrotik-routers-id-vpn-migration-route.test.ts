import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  getRouterById: vi.fn(),
  enable: vi.fn(),
  testTunnel: vi.fn(),
  migrate: vi.fn(),
  revert: vi.fn(),
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
  apiSuccess: (
    data: unknown,
    options?: { status?: number; headers?: Record<string, string> },
  ) =>
    NextResponse.json(
      { success: true, data },
      { status: options?.status, headers: options?.headers },
    ),
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
vi.mock("@/modules/network/factories/VpnRouterMigrationServiceFactory", () => ({
  createVpnRouterMigrationService: () => ({
    enable: mocks.enable,
    testTunnel: mocks.testTunnel,
    migrate: mocks.migrate,
    revert: mocks.revert,
  }),
}));
vi.mock("@/modules/network/vpn/VpnCoreClient", async (importActual) => ({
  ...(await importActual<object>()),
  isVpnConfigured: mocks.isVpnConfigured,
}));

import * as enableRoute from "@/app/api/mikrotik-routers/[id]/vpn/enable/route";
import * as tunnelTestRoute from "@/app/api/mikrotik-routers/[id]/vpn/tunnel-test/route";
import * as migrateRoute from "@/app/api/mikrotik-routers/[id]/vpn/migrate/route";
import * as revertRoute from "@/app/api/mikrotik-routers/[id]/vpn/revert/route";
import {
  VpnRouterBusyError,
  VpnRouterInvalidError,
  VpnRouterMigrationError,
  VpnRouterRollbackError,
} from "@/modules/network/vpn";

const params = { params: { id: "router-1" } } as never;
const req = (body?: unknown) => ({ json: async () => body }) as never;
const migrateBody = { draftId: "c1", serverIds: ["aa"] };

const routes = [
  [
    "enable",
    () => enableRoute.POST(req({ serverIds: ["aa"] }), params),
    mocks.enable,
  ],
  [
    "tunnel-test",
    () => tunnelTestRoute.POST(req({ draftId: "c1" }), params),
    mocks.testTunnel,
  ],
  ["migrate", () => migrateRoute.POST(req(migrateBody), params), mocks.migrate],
  ["revert", () => revertRoute.POST(req(), params), mocks.revert],
] as const;

describe("/api/mikrotik-routers/[id]/vpn migration routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasPermission.mockImplementation(
      async (permission: string) => permission !== "mikrotik:site_only",
    );
    mocks.isVpnConfigured.mockReturnValue(true);
    mocks.getRouterById.mockResolvedValue({ id: "router-1" });
  });

  it.each(routes)(
    "%s answers 503 when VPN is not configured",
    async (_n, call, service) => {
      mocks.isVpnConfigured.mockReturnValue(false);

      expect((await call()).status).toBe(503);
      expect(service).not.toHaveBeenCalled();
    },
  );

  it.each(routes)("%s requires mikrotik:update", async (_n, call, service) => {
    mocks.hasPermission.mockImplementation(
      async (permission: string) => permission === "mikrotik:read",
    );

    expect((await call()).status).toBe(403);
    expect(mocks.hasPermission).toHaveBeenCalledWith("mikrotik:update");
    expect(service).not.toHaveBeenCalled();
  });

  it("rejects invalid bodies", async () => {
    expect(
      (await enableRoute.POST(req({ serverIds: [] }), params)).status,
    ).toBe(400);
    expect(
      (await tunnelTestRoute.POST(req({ draftId: "NOT-HEX" }), params)).status,
    ).toBe(400);
    expect(
      (await migrateRoute.POST(req({ serverIds: ["aa"] }), params)).status,
    ).toBe(400);
    expect(
      (
        await migrateRoute.POST(
          req({ draftId: "c1", serverIds: ["aa", "aa"] }),
          params,
        )
      ).status,
    ).toBe(400);
    expect(mocks.enable).not.toHaveBeenCalled();
    expect(mocks.testTunnel).not.toHaveBeenCalled();
    expect(mocks.migrate).not.toHaveBeenCalled();
  });

  it("returns the draft from enable", async () => {
    mocks.enable.mockResolvedValue({
      draftId: "c1",
      address: "10.100.0.10",
      script: "s",
    });

    const res = await enableRoute.POST(
      req({ serverIds: ["aa"], previousDraftId: "c0" }),
      params,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect((await res.json()).data).toEqual({
      draftId: "c1",
      address: "10.100.0.10",
      script: "s",
    });
    expect(mocks.enable).toHaveBeenCalledWith("router-1", "t1", {
      serverIds: ["aa"],
      protocol: "WIREGUARD",
      previousDraftId: "c0",
    });
  });

  it("answers 400 when a precondition fails", async () => {
    mocks.migrate.mockRejectedValue(
      new VpnRouterInvalidError("VPN memerlukan RouterOS v7"),
    );

    const res = await migrateRoute.POST(req(migrateBody), params);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("VPN memerlukan RouterOS v7");
  });

  it("answers 502 when a migration step fails", async () => {
    mocks.migrate.mockRejectedValue(
      new VpnRouterMigrationError("Gagal memasang RADIUS lewat tunnel"),
    );

    expect((await migrateRoute.POST(req(migrateBody), params)).status).toBe(
      502,
    );
  });

  it("answers 409 when another request is moving the router", async () => {
    mocks.revert.mockRejectedValue(new VpnRouterBusyError());

    const res = await revertRoute.POST(req(), params);

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe(
      "Router sedang dipindahkan oleh proses lain",
    );
  });

  it("answers 502 when a rollback could not finish", async () => {
    mocks.migrate.mockRejectedValue(
      new VpnRouterRollbackError(
        "Router tetap mode VPN, aktivasi belum selesai; hubungi admin",
      ),
    );

    expect((await migrateRoute.POST(req(migrateBody), params)).status).toBe(
      502,
    );
  });

  it("passes the cleanup warning through on success", async () => {
    mocks.revert.mockResolvedValue({
      warning: "Entri RADIUS lama belum terhapus dari router",
    });

    const res = await revertRoute.POST(req(), params);

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({
      success: true,
      warning: "Entri RADIUS lama belum terhapus dari router",
    });
    expect(mocks.revert).toHaveBeenCalledWith("router-1", "t1");
  });
});
