import { describe, expect, it, vi } from "vitest";

import type { IPurchaseOrderRepository } from "@/modules/procurement/domain/ports/IPurchaseOrderRepository";
import {
  PurchaseOrderIsRestockError,
  PurchaseOrderNotEditableError,
  PurchaseOrderService,
} from "@/modules/procurement/services/PurchaseOrderService";

function setup({
  status = "DRAFT",
  restockRequestCount = 0,
}: { status?: string; restockRequestCount?: number } = {}) {
  const repository = {
    findById: vi.fn().mockResolvedValue({ id: "po-1", status }),
    findByIdWithRelations: vi.fn().mockResolvedValue({
      id: "po-1",
      status,
      items: [],
      jasaItems: [],
      supplier: null,
    }),
    countLinkedRestockRequests: vi.fn().mockResolvedValue(restockRequestCount),
    processToOrdered: vi.fn().mockResolvedValue({ id: "po-1" }),
  };
  const service = new PurchaseOrderService(
    repository as unknown as IPurchaseOrderRepository,
    {} as never,
    {} as never,
  );
  return { repository, service };
}

describe("PurchaseOrderService.process — pesanan restock", () => {
  it("menolak pesanan milik pengajuan restock tanpa mengisi tanggal beli", async () => {
    const { repository, service } = setup({ restockRequestCount: 1 });

    const attempt = service.process("po-1", "admin-1");

    await expect(attempt).rejects.toBeInstanceOf(PurchaseOrderIsRestockError);
    // Route memetakan galat ini ke 409 lewat kelas induknya.
    await expect(attempt).rejects.toBeInstanceOf(PurchaseOrderNotEditableError);
    await expect(attempt).rejects.toThrow("link belanja");
    expect(repository.processToOrdered).not.toHaveBeenCalled();
  });

  it("pesanan biasa tetap bisa diproses", async () => {
    const { repository, service } = setup();

    await service.process("po-1", "admin-1");

    expect(repository.countLinkedRestockRequests).toHaveBeenCalledWith("po-1");
    expect(repository.processToOrdered).toHaveBeenCalledWith("po-1", "admin-1");
  });

  it("detail memberi tanda pesanan restock supaya tombol proses disembunyikan", async () => {
    const restock = setup({ restockRequestCount: 2 });
    const regular = setup();

    await expect(restock.service.getById("po-1")).resolves.toMatchObject({
      isRestockOrder: true,
    });
    await expect(regular.service.getById("po-1")).resolves.toMatchObject({
      isRestockOrder: false,
    });
  });
});
