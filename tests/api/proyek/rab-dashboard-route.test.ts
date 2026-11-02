import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TestUser = {
  id: string;
  role?: string;
  isSuperAdmin?: boolean;
  siteId?: string | null;
  siteIds?: string[];
};

const mocks = vi.hoisted(() => ({
  user: { id: "u1" } as TestUser,
  permissions: [] as string[],
  hasPermission: vi.fn(),
  getDashboardMetrics: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler:
    (_o: unknown, handler: (req: unknown, ctx: unknown) => unknown) =>
    (req: unknown) =>
      handler(req, {
        session: { user: mocks.user },
        permissions: mocks.permissions,
      }),
  apiSuccess: (data: unknown) => NextResponse.json({ success: true, data }),
  ApiErrors: {
    forbidden: (message?: string) =>
      NextResponse.json({ success: false, error: message }, { status: 403 }),
  },
}));
vi.mock("@/lib/rbac", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/modules/proyek", async () => {
  const access =
    await import("@/modules/proyek/services/RabProjectSiteAccessService");
  return {
    resolveRabSiteScope: access.resolveRabSiteScope,
    RabProjectRouteService: class {
      getDashboardMetrics = mocks.getDashboardMetrics;
    },
  };
});

import { GET } from "@/app/api/proyek/dashboard/route";

async function getDashboard() {
  const res = (await (GET as unknown as (req: unknown) => Promise<Response>)(
    {},
  )) as Response;
  return res.status;
}

describe("GET /api/proyek/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "u1", role: "FINANCE", siteIds: ["s1"] };
    mocks.permissions = ["expense:read"];
    mocks.hasPermission.mockImplementation(async (perm: string) =>
      mocks.permissions.includes(perm),
    );
    mocks.getDashboardMetrics.mockResolvedValue({});
  });

  it("menolak pengguna tanpa expense:read", async () => {
    mocks.permissions = [];

    expect(await getDashboard()).toBe(403);
    expect(mocks.getDashboardMetrics).not.toHaveBeenCalled();
  });

  it("role wildcard non-super tetap boleh, tetapi tidak dianggap super admin dan tidak dibatasi", async () => {
    mocks.permissions = ["*"];
    mocks.hasPermission.mockResolvedValue(true);

    expect(await getDashboard()).toBe(200);
    expect(mocks.getDashboardMetrics).toHaveBeenCalledWith({
      dibatasi: false,
    });
  });

  it("role wildcard yang juga memegang expense:site_only tetap dibatasi ke site-nya", async () => {
    mocks.permissions = ["*", "expense:site_only"];
    mocks.hasPermission.mockResolvedValue(true);

    expect(await getDashboard()).toBe(200);
    expect(mocks.getDashboardMetrics).toHaveBeenCalledWith({
      dibatasi: true,
      siteIds: ["s1"],
    });
  });

  it("expense:site_only memakai siteId legacy dan gagal tertutup tanpa site", async () => {
    mocks.permissions = ["expense:read", "expense:site_only"];
    mocks.user = { id: "u1", role: "FINANCE", siteIds: [], siteId: "legacy" };
    await getDashboard();
    expect(mocks.getDashboardMetrics).toHaveBeenLastCalledWith({
      dibatasi: true,
      siteIds: ["legacy"],
    });

    mocks.user = { id: "u1", role: "FINANCE" };
    await getDashboard();
    expect(mocks.getDashboardMetrics).toHaveBeenLastCalledWith({
      dibatasi: true,
      siteIds: [],
    });
  });

  it("super admin lolos tanpa expense:read dan tidak dibatasi", async () => {
    mocks.user = { id: "u1", role: "SUPER_ADMIN" };
    mocks.permissions = ["expense:site_only"];
    mocks.hasPermission.mockResolvedValue(false);

    expect(await getDashboard()).toBe(200);
    expect(mocks.getDashboardMetrics).toHaveBeenCalledWith({
      dibatasi: false,
    });
  });
});
