import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../../setup";

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  prismaAuth: prismaMock,
}));

describe("SiteAccessRouteService superadmin detection", () => {
  let SiteAccessRouteService: typeof import("@/modules/roles/services/SiteAccessRouteService").SiteAccessRouteService;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ SiteAccessRouteService } =
      await import("@/modules/roles/services/SiteAccessRouteService"));
  });

  it("uses canonical helper for superadmin bypass", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      siteId: "site-1",
      userSites: [],
      role: {
        name: "SUPER_ADMIN",
        isSuperAdmin: true,
        isRestricted: true,
        permission: [{ resource: "pelanggan", action: "site_only" }],
      },
    } as never);

    prismaMock.sites.findMany.mockResolvedValue([
      { id: "site-1", code: "S1", name: "Site 1" },
      { id: "site-2", code: "S2", name: "Site 2" },
    ] as never);

    const service = new SiteAccessRouteService();
    const result = await service.getAccessibleSites(
      { id: "user-1", role: "SUPER_ADMIN" },
      "pelanggan",
    );

    expect(result.sites).toHaveLength(2);
    const query = prismaMock.sites.findMany.mock.calls[0][0];
    expect(query.where).toEqual({});
  });
});
