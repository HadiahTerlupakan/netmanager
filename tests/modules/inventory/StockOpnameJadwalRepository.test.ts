import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/database", () => ({ prisma: {} }));

import { StockOpnameJadwalRepository } from "@/modules/inventory/repositories/StockOpnameJadwalRepository";

describe("StockOpnameJadwalRepository.findSiteIdsPengguna", () => {
  it("menyaring tenant dan menggabungkan site utama dengan UserSite tanpa duplikat", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      siteId: "s1",
      userSites: [{ siteId: "s1" }, { siteId: "s2" }],
    });
    const repository = new StockOpnameJadwalRepository({ user: { findFirst } } as never);

    expect(await repository.findSiteIdsPengguna("t-1", "u-1")).toEqual(["s1", "s2"]);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u-1", tenantId: "t-1" } }),
    );
  });

  it("mengembalikan daftar kosong bila pengguna bukan milik tenant", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new StockOpnameJadwalRepository({ user: { findFirst } } as never);

    expect(await repository.findSiteIdsPengguna("t-1", "u-lain")).toEqual([]);
  });
});
