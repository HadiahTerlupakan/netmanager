import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  overview: vi.fn(),
  setCancelled: vi.fn(),
  enforceNow: vi.fn(),
  sync: vi.fn(),
}));

vi.mock("@/lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api-response")>(
      "@/lib/api-response",
    );
  return {
    ...actual,
    createHandler: (_options: unknown, handler: unknown) => handler,
  };
});

vi.mock("@/lib/rbac", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/logger", () => ({
  logActivitySafe: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/modules/mitra", () => ({ MAIN_TENANT_ID: "main-tenant" }));
vi.mock("@/modules/app-version", () => ({
  PlayStoreReleaseService: class {
    overview = mocks.overview;
    setCancelled = mocks.setCancelled;
    enforceNow = mocks.enforceNow;
    sync = mocks.sync;
  },
}));

import { GET } from "@/app/api/admin/app-update/min-version/route";
import { PATCH } from "@/app/api/admin/app-update/min-version/[versionCode]/route";

const ctx = (tenantId: string, params: Record<string, string> = {}) =>
  ({ session: { user: { id: "admin-1", tenantId } }, params }) as never;

describe("admin mobile minimum version API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasPermission.mockResolvedValue(true);
    mocks.overview.mockResolvedValue({
      credentialConfigured: true,
      minimum: null,
      releases: [],
    });
    mocks.setCancelled.mockResolvedValue(true);
  });

  it("shows the Play Store releases to the main tenant", async () => {
    const response = (await GET(
      new NextRequest("http://localhost/api/admin/app-update/min-version"),
      ctx("main-tenant"),
    )) as NextResponse;

    expect(response.status).toBe(200);
    expect((await response.json()).data.credentialConfigured).toBe(true);
  });

  it("refuses other tenants, since the rule applies to everyone", async () => {
    const response = (await GET(
      new NextRequest("http://localhost/api/admin/app-update/min-version"),
      ctx("other-tenant"),
    )) as NextResponse;

    expect(response.status).toBe(403);
  });

  it("cancels the lock-out of one release", async () => {
    const response = (await PATCH(
      new NextRequest("http://localhost/api/admin/app-update/min-version/50", {
        method: "PATCH",
        body: JSON.stringify({ cancelled: true }),
      }),
      ctx("main-tenant", { versionCode: "50" }),
    )) as NextResponse;

    expect(response.status).toBe(200);
    expect(mocks.setCancelled).toHaveBeenCalledWith(50, true, "admin-1");
  });

  it("requires the update permission to change it", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    const response = (await PATCH(
      new NextRequest("http://localhost/api/admin/app-update/min-version/50", {
        method: "PATCH",
        body: JSON.stringify({ cancelled: true }),
      }),
      ctx("main-tenant", { versionCode: "50" }),
    )) as NextResponse;

    expect(response.status).toBe(403);
    expect(mocks.setCancelled).not.toHaveBeenCalled();
  });

  it("enforces a release now when the admin confirms it is approved", async () => {
    mocks.enforceNow.mockResolvedValue(true);

    const response = (await PATCH(
      new NextRequest("http://localhost/api/admin/app-update/min-version/49", {
        method: "PATCH",
        body: JSON.stringify({ enforceNow: true }),
      }),
      ctx("main-tenant", { versionCode: "49" }),
    )) as NextResponse;

    expect(response.status).toBe(200);
    expect(mocks.enforceNow).toHaveBeenCalledWith(49, "admin-1");
    expect(mocks.setCancelled).not.toHaveBeenCalled();
  });
});
