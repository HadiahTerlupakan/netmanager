import { describe, expect, it, vi } from "vitest";

import { MixRadiusGroupRouteService } from "@/modules/integrations/services/MixRadiusGroupRouteService";

function createMobileGroupService() {
  return new MixRadiusGroupRouteService({
    mixRadiusService: {
      getOwnerGroups: vi.fn().mockResolvedValue([
        {
          id: "group-1",
          name: "Group Timur",
          owners: ["Owner A"],
          siteId: "site-1",
          isActive: true,
        },
        {
          id: "group-2",
          name: "Group Barat",
          owners: ["Owner B"],
          siteId: "site-2",
          isActive: false,
        },
      ]),
    },
    siteService: {
      getSites: vi.fn(),
    },
  });
}

describe("MixRadiusGroupRouteService", () => {
  it("enriches admin owner groups with site names", async () => {
    const service = new MixRadiusGroupRouteService({
      mixRadiusService: {
        getOwnerGroups: vi.fn().mockResolvedValue([
          {
            id: "group-1",
            name: "Group Timur",
            owners: ["Owner A"],
            siteId: "site-1",
            isActive: true,
          },
        ]),
      },
      siteService: {
        getSites: vi
          .fn()
          .mockResolvedValue([{ id: "site-1", name: "Site Timur" }]),
      },
    });

    const result = await service.getAdminGroups("tenant-1");

    expect(result).toEqual([
      expect.objectContaining({
        id: "group-1",
        site: { name: "Site Timur" },
      }),
    ]);
  });

  it("filters mobile owner groups by site", async () => {
    const service = createMobileGroupService();

    const result = await service.getMobileGroups("site-1");

    expect(result).toEqual([
      {
        id: "group-1",
        name: "Group Timur",
        owners: ["Owner A"],
        isActive: true,
        siteId: "site-1",
      },
    ]);
  });

  it("returns no mobile groups when site is missing", async () => {
    const service = createMobileGroupService();

    const result = await service.getMobileGroups(null);

    expect(result).toEqual([]);
  });
});
