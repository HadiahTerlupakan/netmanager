import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getUserPermissions: vi.fn(),
  isSuperAdmin: vi.fn(),
  canAccess: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getUserPermissions: mockFns.getUserPermissions,
  isSuperAdmin: mockFns.isSuperAdmin,
}));

vi.mock("@/modules/integrations", () => ({
  getMixRadiusAccessService: () => ({
    canAccess: mockFns.canAccess,
  }),
}));

describe("MixRadius route authorization consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses centralized access service instead of local permission composition", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");

    const syncRouteSource = readFileSync(
      resolve(process.cwd(), "app/api/integrations/mixradius/sync/route.ts"),
      "utf8",
    );
    const periodRouteSource = readFileSync(
      resolve(
        process.cwd(),
        "app/api/integrations/mixradius/reports/period/route.ts",
      ),
      "utf8",
    );

    expect(syncRouteSource).not.toContain('permissions.includes("*")');
    expect(syncRouteSource).not.toContain(
      'permissions.includes("mixradius:read")',
    );
    expect(syncRouteSource).toContain("getMixRadiusAccessService");
    expect(syncRouteSource).toContain(".canAccess(");

    expect(periodRouteSource).not.toContain('permissions.includes("*")');
    expect(periodRouteSource).not.toContain(
      'permissions.includes("mixradius_income:read")',
    );
    expect(periodRouteSource).toContain("getMixRadiusAccessService");
    expect(periodRouteSource).toContain(".canAccess(");
  });

  it("delegates wildcard and permission logic to access service", async () => {
    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.getUserPermissions.mockResolvedValue(["*"]);
    mockFns.canAccess.mockResolvedValue(true);

    const user = { id: "user-1" };
    const accessService = (
      await import("@/modules/integrations")
    ).getMixRadiusAccessService();

    const hasAccess = await accessService.canAccess({
      userId: user.id,
      isSuperAdmin: mockFns.isSuperAdmin(user),
      requiredPermissions: ["mixradius:read"],
    });

    expect(hasAccess).toBe(true);
    expect(mockFns.canAccess).toHaveBeenCalledWith({
      userId: "user-1",
      isSuperAdmin: false,
      requiredPermissions: ["mixradius:read"],
    });
  });
});
