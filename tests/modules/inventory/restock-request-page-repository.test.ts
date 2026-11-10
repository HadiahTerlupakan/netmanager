import { describe, expect, it, vi } from "vitest";

import { InventoryPurchaseRequestRepository } from "@/modules/inventory/repositories/InventoryPurchaseRequestRepository";

function row(id: string) {
  return {
    id,
    status: "SUBMITTED",
    items: [] as unknown[],
    jasaItems: [] as unknown[],
    purchaseOrder: null as unknown,
  };
}

function setup(rows: unknown[]) {
  const findMany = vi.fn().mockResolvedValue(rows);
  const repository = new InventoryPurchaseRequestRepository({
    purchaseRequest: { findMany },
  } as never);
  return { repository, findMany };
}

describe("InventoryPurchaseRequestRepository.findPurchaseRequestPage", () => {
  it("mengambil satu baris lebih untuk tahu masih ada halaman berikutnya", async () => {
    const { repository, findMany } = setup([row("a"), row("b"), row("c")]);

    const page = await repository.findPurchaseRequestPage({
      tenantId: "tenant-1",
      siteIds: ["site-1"],
      limit: 2,
      cursor: "z",
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-1",
          gudang: { sites: { some: { id: { in: ["site-1"] } } } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 3,
        cursor: { id: "z" },
        skip: 1,
      }),
    );
    expect(page.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(page.nextCursor).toBe("b");
  });

  it("halaman terakhir tanpa cursor berikutnya; tanpa site tidak disaring", async () => {
    const { repository, findMany } = setup([row("a")]);

    const page = await repository.findPurchaseRequestPage({
      tenantId: "tenant-1",
      limit: 2,
    });

    const query = findMany.mock.calls[0][0];
    expect(query.where).toEqual({ tenantId: "tenant-1" });
    expect(query).not.toHaveProperty("cursor");
    expect(page.nextCursor).toBeNull();
  });
});
