import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../setup";

const { mockRequireAdmin, mockHasPermission, mockCheckSiteRestriction } =
  vi.hoisted(() => ({
    mockRequireAdmin: vi.fn(),
    mockHasPermission: vi.fn(),
    mockCheckSiteRestriction: vi.fn(),
  }));

vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: (request: NextRequest) => mockRequireAdmin(request),
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: (permission: string) => mockHasPermission(permission),
}));

vi.mock("@/modules/roles", () => ({
  checkSiteRestriction: (session: unknown, resource: string) =>
    mockCheckSiteRestriction(session, resource),
}));

vi.mock("@/modules/mitra", () => ({ MAIN_TENANT_ID: "main-tenant" }));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  prismaAuth: prismaMock,
}));

import { GET } from "@/app/api/admin/system-logs/route";

describe("GET /api/admin/system-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRequireAdmin.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN" },
    });
    mockHasPermission.mockResolvedValue(true);
    mockCheckSiteRestriction.mockReturnValue({
      isRestricted: false,
      siteIds: [],
    });
    prismaMock.systemLog.count.mockResolvedValue(1);
    prismaMock.systemLog.findMany.mockResolvedValue([]);
  });

  it("filters logs by action when action query param is provided", async () => {
    const request = new NextRequest(
      "http://localhost/api/admin/system-logs?type=SYSTEM&action=MOBILE_ERROR_REPORT&page=1&limit=20",
    );

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(prismaMock.systemLog.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        type: "SYSTEM",
        action: "MOBILE_ERROR_REPORT",
      }),
    });
    expect(prismaMock.systemLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "SYSTEM",
          action: "MOBILE_ERROR_REPORT",
        }),
      }),
    );
  });

  it("returns forbidden when the user lacks system log permission", async () => {
    mockHasPermission.mockResolvedValue(false);

    const request = new NextRequest(
      "http://localhost/api/admin/system-logs?type=SYSTEM&action=MOBILE_ERROR_REPORT",
    );

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("system log");
    expect(prismaMock.systemLog.findMany).not.toHaveBeenCalled();
  });

  it("returns no logs when site restriction blocks access", async () => {
    mockCheckSiteRestriction.mockReturnValue({
      isRestricted: true,
      siteIds: [],
    });

    const request = new NextRequest(
      "http://localhost/api/admin/system-logs?type=SYSTEM&action=MOBILE_ERROR_REPORT&page=1&limit=20",
    );

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.logs).toEqual([]);
    expect(json.data.pagination.total).toBe(0);
    expect(prismaMock.systemLog.findMany).not.toHaveBeenCalled();
  });

  describe("tenant isolation", () => {
    const TENANT_SCOPE = (tenantId: string) => ({
      AND: [{ OR: [{ tenantId }, { user: { tenantId } }] }],
    });

    it("shows a tenant admin only the logs of their own tenant", async () => {
      mockRequireAdmin.mockResolvedValue({
        user: { id: "admin-b", role: "ADMIN", tenantId: "tenant-b" },
      });

      await GET(
        new NextRequest("http://localhost/api/admin/system-logs?type=AUTH"),
      );

      expect(prismaMock.systemLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining(TENANT_SCOPE("tenant-b")),
        }),
      );
    });

    it("lets the main tenant see logs of every tenant", async () => {
      mockRequireAdmin.mockResolvedValue({
        user: { id: "admin-main", role: "ADMIN", tenantId: "main-tenant" },
      });

      await GET(
        new NextRequest("http://localhost/api/admin/system-logs?type=AUTH"),
      );

      const where = prismaMock.systemLog.findMany.mock.calls[0]![0]!.where;
      expect(where).not.toHaveProperty("AND");
    });

    it("lets a super admin see logs of every tenant", async () => {
      mockRequireAdmin.mockResolvedValue({
        user: {
          id: "root",
          role: "SUPER_ADMIN",
          tenantId: "tenant-b",
          isSuperAdmin: true,
        },
      });

      await GET(
        new NextRequest("http://localhost/api/admin/system-logs?type=AUTH"),
      );

      const where = prismaMock.systemLog.findMany.mock.calls[0]![0]!.where;
      expect(where).not.toHaveProperty("AND");
    });
  });
});
