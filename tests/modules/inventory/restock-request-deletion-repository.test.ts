import { describe, expect, it, vi, type Mock } from "vitest";

import { InventoryPurchaseRequestRepository } from "@/modules/inventory/repositories/InventoryPurchaseRequestRepository";

interface DeletionDbMock {
  purchaseRequest: { deleteMany: Mock };
}

function createDb(deletedCount: number): DeletionDbMock {
  return {
    purchaseRequest: {
      deleteMany: vi.fn().mockResolvedValue({ count: deletedCount }),
    },
  };
}

/**
 * Hapus pengajuan bersyarat di database: syaratnya ada di baris pengajuan
 * sendiri, jadi pesanan yang dibuat bersamaan (persetujuan, Generate PO,
 * Masukkan Barang) membuat penghapusan tidak mengenai apa pun.
 */
describe("InventoryPurchaseRequestRepository.deletePurchaseRequestIfDeletable", () => {
  it("menghapus hanya pengajuan tanpa pesanan, belum Sudah Dimasukkan, dan tanpa jasa yang selesai", async () => {
    const db = createDb(1);

    const isDeleted = await new InventoryPurchaseRequestRepository(
      db as never,
    ).deletePurchaseRequestIfDeletable("pr-1", "tenant-1");

    expect(isDeleted).toBe(true);
    expect(db.purchaseRequest.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "pr-1",
        tenantId: "tenant-1",
        purchaseOrderId: null,
        status: { not: "RECEIVED" },
        jasaItems: {
          none: {
            statusKonfirmasi: "SELESAI",
            statusApproval: { not: "REJECTED" },
          },
        },
      },
    });
  });

  it("mengembalikan false bila pengajuannya sudah berubah dan tidak ada yang terhapus", async () => {
    const db = createDb(0);

    await expect(
      new InventoryPurchaseRequestRepository(
        db as never,
      ).deletePurchaseRequestIfDeletable("pr-1", "tenant-1"),
    ).resolves.toBe(false);
  });
});
