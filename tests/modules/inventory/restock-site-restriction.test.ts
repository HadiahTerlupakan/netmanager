import { describe, expect, it, vi } from "vitest";

import { InventoryPurchaseRequestRepository } from "@/modules/inventory/repositories/InventoryPurchaseRequestRepository";

/**
 * `restock:site_only` dideklarasikan di katalog kapabilitas dan sempat dipegang
 * Branch Manager serta Teknisi (20 pengguna aktif), tetapi
 * `findPurchaseRequests` hanya memfilter `tenantId` dan `status` — nol filter
 * site. Permintaan restock seluruh gudang terlihat oleh semua orang.
 *
 * `PurchaseRequest` tidak punya `siteId` sendiri; dimensi site-nya lewat
 * `gudangId → Gudang.sites` (relasi M2M `GudangToSite`), pola yang sudah dipakai
 * modul inventory lain.
 */

const TENANT = "tenant-1";

function createRepository() {
  const findMany = vi.fn().mockResolvedValue([]);
  const db = { purchaseRequest: { findMany } };
  return {
    findMany,
    repository: new InventoryPurchaseRequestRepository(
      db as unknown as ConstructorParameters<
        typeof InventoryPurchaseRequestRepository
      >[0],
    ),
  };
}

function whereDariPanggilan(findMany: ReturnType<typeof vi.fn>) {
  return findMany.mock.calls[0]![0].where;
}

describe("pembatasan site pada daftar permintaan restock", () => {
  it("memfilter lewat gudang milik site yang diizinkan", async () => {
    const { repository, findMany } = createRepository();

    await repository.findPurchaseRequests({
      tenantId: TENANT,
      siteIds: ["site-jaksel", "site-jaktim"],
    });

    expect(whereDariPanggilan(findMany)).toMatchObject({
      tenantId: TENANT,
      gudang: {
        sites: { some: { id: { in: ["site-jaksel", "site-jaktim"] } } },
      },
    });
  });

  it("tidak memfilter site bila tidak dibatasi", async () => {
    const { repository, findMany } = createRepository();

    await repository.findPurchaseRequests({ tenantId: TENANT });

    expect(whereDariPanggilan(findMany).gudang).toBeUndefined();
  });

  it("tetap menghormati filter status bersama pembatasan site", async () => {
    const { repository, findMany } = createRepository();

    await repository.findPurchaseRequests({
      tenantId: TENANT,
      status: "SUBMITTED",
      siteIds: ["site-jaksel"],
    });

    const where = whereDariPanggilan(findMany);
    expect(where.status).toBe("SUBMITTED");
    expect(where.gudang).toEqual({
      sites: { some: { id: { in: ["site-jaksel"] } } },
    });
  });

  it("daftar site kosong berarti tidak ada gudang yang cocok, bukan tanpa filter", async () => {
    const { repository, findMany } = createRepository();

    await repository.findPurchaseRequests({ tenantId: TENANT, siteIds: [] });

    expect(whereDariPanggilan(findMany).gudang).toEqual({
      sites: { some: { id: { in: [] } } },
    });
  });
});
