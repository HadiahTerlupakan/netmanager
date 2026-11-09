import { describe, expect, it, vi } from "vitest";

import type { PurchaseRequestEntity } from "@/modules/procurement/domain/entities/PurchaseRequest";
import { ProcurementService } from "@/modules/procurement/services/ProcurementService";
import { SupplierNotActiveError } from "@/modules/procurement/services/SupplierService";

function barangLine(id: string, supplierId: string | null) {
  return {
    id,
    barangId: `barang-${id}`,
    jumlah: 1,
    hargaPerUnit: 100,
    totalHarga: 100,
    tenantId: "tenant-1",
    barang: { id: `barang-${id}`, nama: `Barang ${id}`, supplierId },
  };
}

function purchaseRequest(
  items: ReturnType<typeof barangLine>[],
): PurchaseRequestEntity {
  return {
    id: "pr-1",
    tenantId: "tenant-1",
    status: "APPROVED",
    purchaseOrderId: null,
    items,
    jasaItems: [],
  };
}

function createService(
  request: PurchaseRequestEntity,
  statuses: Record<string, string>,
) {
  const procurementRepository = {
    findApprovedPRs: vi.fn().mockResolvedValue([request]),
    generatePONumber: vi.fn().mockResolvedValue("PO-1"),
    createPOWithItems: vi.fn(async (input: { supplierId: string | null }) => ({
      id: "po-1",
      poNumber: "PO-1",
      supplierId: input.supplierId,
      status: "DRAFT",
      totalAmount: 0,
      createdAt: new Date(),
      items: [],
    })),
  };
  const supplierRepository = {
    findById: vi.fn(async (id: string) => ({
      id,
      status: statuses[id] ?? "ACTIVE",
      blacklistReason: null,
    })),
  };
  const service = new ProcurementService(
    procurementRepository as never,
    supplierRepository as never,
  );
  return { service, procurementRepository, supplierRepository };
}

describe("ProcurementService supplier grouping", () => {
  it("refuses a PR whose substituted barang belongs to an inactive second supplier", async () => {
    const request = purchaseRequest([
      barangLine("a", "supplier-1"),
      barangLine("b", "supplier-2"),
    ]);
    const { service, procurementRepository } = createService(request, {
      "supplier-2": "BLACKLISTED",
    });

    await expect(
      service.generatePOFromPRs(["pr-1"], "user-1"),
    ).rejects.toBeInstanceOf(SupplierNotActiveError);
    expect(procurementRepository.createPOWithItems).not.toHaveBeenCalled();
  });

  it("orders a mixed-supplier PR from the supplier with the most lines, whatever the line order", async () => {
    const lines = [
      barangLine("a", "supplier-2"),
      barangLine("b", "supplier-1"),
      barangLine("c", "supplier-1"),
    ];

    for (const order of [lines, [...lines].reverse()]) {
      const { service, procurementRepository } = createService(
        purchaseRequest(order),
        {},
      );
      await service.generatePOFromPRs(["pr-1"], "user-1");
      expect(procurementRepository.createPOWithItems).toHaveBeenCalledWith(
        expect.objectContaining({ supplierId: "supplier-1" }),
      );
    }
  });

  it("breaks a tie between suppliers by id so the choice is stable", async () => {
    const { service, procurementRepository } = createService(
      purchaseRequest([
        barangLine("a", "supplier-b"),
        barangLine("b", "supplier-a"),
      ]),
      {},
    );

    await service.generatePOFromPRs(["pr-1"], "user-1");

    expect(procurementRepository.createPOWithItems).toHaveBeenCalledWith(
      expect.objectContaining({ supplierId: "supplier-a" }),
    );
  });
});
