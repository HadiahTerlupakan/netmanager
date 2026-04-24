import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  ensureAdminAccess: vi.fn(),
  getUserPermissions: vi.fn(),
  isSuperAdminUser: vi.fn(),
  findPayments: vi.fn(),
  findCustomers: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({
  ensureAdminAccess: routeMocks.ensureAdminAccess,
}));

vi.mock("@/lib/auth", () => ({
  getUserPermissions: routeMocks.getUserPermissions,
  isSuperAdminUser: routeMocks.isSuperAdminUser,
}));

vi.mock("@/modules/database", () => ({
  prismaBilling: {
    payment: {
      findMany: routeMocks.findPayments,
    },
  },
  prisma: {
    pelanggan: {
      findMany: routeMocks.findCustomers,
    },
  },
}));

import { GET } from "@/app/api/admin/payments/pending-manual/route";

describe("admin pending manual payments route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.ensureAdminAccess.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      siteId: "site-owned",
      primarySiteId: "site-owned",
      isSuperAdmin: false,
    });
    routeMocks.getUserPermissions.mockResolvedValue(["manual_payments:read"]);
    routeMocks.isSuperAdminUser.mockReturnValue(false);
    routeMocks.findCustomers.mockResolvedValue([{ id: "customer-owned" }]);
    routeMocks.findPayments.mockResolvedValue([]);
  });

  it("requires manual payment read permission", async () => {
    routeMocks.getUserPermissions.mockResolvedValueOnce(["finance:read"]);

    const response = await GET(
      new Request("http://localhost/api/admin/payments/pending-manual"),
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.success).toBe(false);
    expect(routeMocks.findPayments).not.toHaveBeenCalled();
  });

  it("uses the admin site when site-only users request another site", async () => {
    routeMocks.getUserPermissions.mockResolvedValueOnce([
      "manual_payments:read",
      "manual_payments:site_only",
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/admin/payments/pending-manual?siteId=site-other",
      ),
    );

    expect(response.status).toBe(200);
    expect(routeMocks.findCustomers).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { siteId: "site-owned" },
      }),
    );
    expect(routeMocks.findPayments).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          pelangganId: { in: ["customer-owned"] },
        }),
      }),
    );
  });

  it("does not expose all payments when site-only users have no site", async () => {
    routeMocks.ensureAdminAccess.mockResolvedValueOnce({
      id: "admin-1",
      role: "ADMIN",
      siteId: null,
      primarySiteId: null,
      isSuperAdmin: false,
    });
    routeMocks.getUserPermissions.mockResolvedValueOnce([
      "manual_payments:read",
      "manual_payments:site_only",
    ]);

    const response = await GET(
      new Request("http://localhost/api/admin/payments/pending-manual"),
    );

    expect(response.status).toBe(200);
    expect(routeMocks.findCustomers).not.toHaveBeenCalled();
    expect(routeMocks.findPayments).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          pelangganId: { in: [] },
        }),
      }),
    );
  });
});
