import { describe, expect, it } from "vitest";

import {
  buildInventoryActorFilter,
  resolveInventoryActorScope,
} from "@/modules/inventory";

describe("inventory actor scope", () => {
  it("resolves mitra scope as restricted to its site", () => {
    expect(
      resolveInventoryActorScope({
        mitra: { id: "mitra-1", siteId: "site-1" },
        isSuperAdmin: false,
      }),
    ).toEqual(
      expect.objectContaining({
        actor: { type: "mitra", id: "mitra-1" },
        allowedSiteIds: ["site-1"],
        isRestricted: true,
      }),
    );
  });

  it("builds user history filters with legacy and actor-aware ownership", () => {
    expect(buildInventoryActorFilter({ type: "user", id: "user-1" })).toEqual({
      OR: [{ userId: "user-1" }, { actorType: "user", actorId: "user-1" }],
    });
  });

  it("builds mitra history filters with strict actor ownership", () => {
    expect(buildInventoryActorFilter({ type: "mitra", id: "mitra-1" })).toEqual(
      {
        actorType: "mitra",
        actorId: "mitra-1",
      },
    );
  });

  it("resolves user scope from primary and assigned sites", () => {
    expect(
      resolveInventoryActorScope({
        user: {
          id: "user-1",
          role: {
            name: "OPERATOR",
            permission: [{ resource: "k_barang", action: "site_only" }],
          },
          sites: { id: "site-primary" },
          userSites: [{ siteId: "site-assigned" }],
        },
        isSuperAdmin: false,
      }),
    ).toEqual(
      expect.objectContaining({
        actor: { type: "user", id: "user-1", userId: "user-1" },
        allowedSiteIds: ["site-assigned", "site-primary"],
        isRestricted: true,
        userPermissions: ["k_barang:site_only"],
      }),
    );
  });
});
