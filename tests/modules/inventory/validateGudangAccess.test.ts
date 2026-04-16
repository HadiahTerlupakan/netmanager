import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";

import { validateGudangSiteAccess } from "@/modules/inventory/utils/validation";
import { prismaMock } from "../../setup";

describe("validateGudangSiteAccess", () => {
  beforeEach(() => {
    vi.mocked(prismaMock.gudang.findUnique).mockReset();
  });

  it("returns trusted gudang sites when access is allowed", async () => {
    vi.mocked(prismaMock.gudang.findUnique).mockResolvedValueOnce({
      id: "gudang-1",
      tenantId: "tenant-1",
      sites: [{ id: "site-1" }],
    });

    const session = {
      user: {
        id: "user-1",
        role: "ADMIN",
        permissions: ["k_barang:site_only"],
        siteId: "site-1",
      },
    } as Session;

    const result = await validateGudangSiteAccess(session, "gudang-1");

    expect(result.allowed).toBe(true);
    expect(result.gudang).toEqual({
      id: "gudang-1",
      tenantId: "tenant-1",
      sites: [{ id: "site-1" }],
    });
  });
});
