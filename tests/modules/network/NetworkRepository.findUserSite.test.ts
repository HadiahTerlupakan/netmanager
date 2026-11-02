import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.findUnique } },
}));

import { NetworkRepository } from "@/modules/network/repositories/NetworkRepository";

// Regresi: `findUserSite` dulu hanya mengambil `User.siteId` legacy, sehingga
// lingkup `mikrotik:site_only` mengabaikan site tambahan di `userSites`.
describe("NetworkRepository.findUserSite", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mengembalikan site legacy beserta seluruh userSites (utama dulu)", async () => {
    mocks.findUnique.mockResolvedValue({
      siteId: "site-a",
      userSites: [{ siteId: "site-b" }, { siteId: "site-a" }],
    });

    const result = await new NetworkRepository().findUserSite("u1");

    expect(result).toEqual({ siteId: "site-a", siteIds: ["site-b", "site-a"] });
    const args = mocks.findUnique.mock.calls[0][0];
    expect(args.where).toEqual({ id: "u1" });
    expect(args.select.userSites.orderBy).toEqual([
      { isPrimary: "desc" },
      { createdAt: "asc" },
    ]);
  });

  it("pengguna tidak ditemukan → null", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(
      new NetworkRepository().findUserSite("u1"),
    ).resolves.toBeNull();
  });
});
