import { describe, expect, it, vi } from "vitest";

import { InventoryRouteService } from "@/modules/inventory";

function createService(siteId: string | undefined) {
  const repository = {
    findUserSiteId: vi.fn().mockResolvedValue(siteId),
  };

  return {
    repository,
    service: new InventoryRouteService(repository as never),
  };
}

describe("InventoryRouteService", () => {
  it("mengambil site user ketika permission inventory dibatasi site", async () => {
    const { repository, service } = createService("site-1");

    const result = await service.resolveRestrictedSiteId({
      userId: "user-1",
      permissions: ["gudang:site_only"],
      isSuperAdmin: false,
      restrictedPermissions: ["gudang:site_only", "k_barang:site_only"],
    });

    expect(repository.findUserSiteId).toHaveBeenCalledWith("user-1");
    expect(result).toBe("site-1");
  });

  it("tidak mengambil site ketika user super admin", async () => {
    const { repository, service } = createService("site-1");

    const result = await service.resolveRestrictedSiteId({
      userId: "user-1",
      permissions: ["gudang:site_only"],
      isSuperAdmin: true,
      restrictedPermissions: ["gudang:site_only", "k_barang:site_only"],
    });

    expect(repository.findUserSiteId).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
