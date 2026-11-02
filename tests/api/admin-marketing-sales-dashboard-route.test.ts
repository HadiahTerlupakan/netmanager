import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: {} as Record<string, unknown>,
  rolePermissions: [] as string[],
  hasPermission: vi.fn(),
  getSalesDashboard: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: async () => ({ user: mocks.user }),
}));
vi.mock("@/lib/rbac", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/auth", () => ({
  isSuperAdmin: (user?: { role?: string | null }) =>
    user?.role === "SUPER_ADMIN",
  getUserPermissions: async () => mocks.rolePermissions,
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/modules/feature-flags", () => ({
  getFeatureFlagService: () => ({ isEnabled: async () => true }),
}));
vi.mock("@/modules/marketing", () => ({
  SALES_SITE_SCOPE_RESOURCE: {
    overview: "sales",
    dashboard: "sales_dashboard",
  },
  resolveSalesAllowedSiteIds: (
    input: Parameters<typeof resolveSalesAllowedSiteIds>[0],
  ) => resolveSalesAllowedSiteIds(input),
  AdminSalesRouteService: class {
    getSalesDashboard = mocks.getSalesDashboard;
  },
}));

import { resolveSalesAllowedSiteIds } from "@/modules/marketing/services/SalesSiteScopeService";

import { GET } from "@/app/api/admin/marketing/sales-dashboard/route";

const request = () =>
  new NextRequest("http://localhost/api/admin/marketing/sales-dashboard");

describe("GET /api/admin/marketing/sales-dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "u1", role: "ADMIN", tenantId: "t1", siteIds: ["s1"] };
    mocks.hasPermission.mockResolvedValue(true);
    mocks.getSalesDashboard.mockResolvedValue({});
  });

  it("role wildcard `*` tidak dianggap dibatasi meski hasPermission mengembangkan `*`", async () => {
    mocks.rolePermissions = ["*"];

    const res = await GET(request());

    expect(res.status).toBe(200);
    expect(mocks.getSalesDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ allowedSiteIds: undefined }),
    );
  });

  it("sales_dashboard:site_only pada role mengunci ke site pengguna", async () => {
    mocks.rolePermissions = [
      "sales_dashboard:read",
      "sales_dashboard:site_only",
    ];

    await GET(request());

    expect(mocks.getSalesDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ allowedSiteIds: ["s1"] }),
    );
  });

  it("dibatasi tanpa site mendapat daftar kosong", async () => {
    mocks.user = { id: "u1", role: "ADMIN", tenantId: "t1" };
    mocks.rolePermissions = ["sales_dashboard:site_only"];

    await GET(request());

    expect(mocks.getSalesDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ allowedSiteIds: [] }),
    );
  });
});
