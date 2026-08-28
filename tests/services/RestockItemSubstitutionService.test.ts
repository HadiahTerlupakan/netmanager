/**
 * Unit tests untuk substitusi barang saat verifikasi kedatangan restock.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ApplyItemSubstitutionInput,
  IRestockGoodsReceiptRepository,
  RestockPurchaseOrderItem,
} from "@/modules/inventory/domain/ports/IRestockGoodsReceiptRepository";
import {
  RestockItemSubstitutionService,
  RestockSubstitutionInvalidError,
} from "@/modules/inventory/services/RestockItemSubstitutionService";

vi.mock("@/lib/logger", () => ({
  logger: { logActivity: vi.fn().mockResolvedValue(undefined) },
}));

const purchaseOrderItems: RestockPurchaseOrderItem[] = [
  {
    id: "po-item-1",
    barangId: "barang-1",
    quantity: 5,
    receivedQuantity: 0,
    cancelledQuantity: 0,
    barang: { id: "barang-1", nama: "Kabel Fiber" },
  },
  {
    id: "po-item-2",
    barangId: "barang-2",
    quantity: 3,
    receivedQuantity: 1,
    cancelledQuantity: 0,
    barang: { id: "barang-2", nama: "Kabel Dropcore" },
  },
];

function createService(overrides?: {
  candidateIds?: string[];
  applyItemSubstitutions?: ReturnType<typeof vi.fn>;
}) {
  const applyItemSubstitutions =
    overrides?.applyItemSubstitutions ?? vi.fn().mockResolvedValue(undefined);
  const candidateIds = overrides?.candidateIds ?? ["barang-9"];
  const repository = {
    findBarangCandidates: vi.fn(async (barangIds: string[]) =>
      barangIds
        .filter((id) => candidateIds.includes(id))
        .map((id) => ({ id, nama: id })),
    ),
    applyItemSubstitutions,
  } as unknown as IRestockGoodsReceiptRepository;

  return {
    service: new RestockItemSubstitutionService(repository),
    applyItemSubstitutions,
  };
}

const baseInput = {
  purchaseOrderId: "po-1",
  purchaseOrderItems,
  tenantId: "tenant-1",
  actorId: "user-1",
  referenceNumber: "PR-001",
};

describe("RestockItemSubstitutionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mengganti barang PO ketika barang yang datang berbeda", async () => {
    const { service, applyItemSubstitutions } = createService();

    const applied = await service.apply({
      ...baseInput,
      substitutions: { "barang-1": "barang-9" },
    });

    expect(applied).toEqual({ "barang-1": "barang-9" });
    expect(applyItemSubstitutions).toHaveBeenCalledWith({
      purchaseOrderId: "po-1",
      tenantId: "tenant-1",
      substitutions: [
        {
          purchaseOrderItemId: "po-item-1",
          fromBarangId: "barang-1",
          toBarangId: "barang-9",
        },
      ],
    } satisfies ApplyItemSubstitutionInput);
  });

  it("mengabaikan substitusi kosong atau yang sama dengan barang asli", async () => {
    const { service, applyItemSubstitutions } = createService();

    const applied = await service.apply({
      ...baseInput,
      substitutions: { "barang-1": "barang-1", "barang-2": "" },
    });

    expect(applied).toEqual({});
    expect(applyItemSubstitutions).not.toHaveBeenCalled();
  });

  it("menolak penggantian item yang sudah diterima sebagian", async () => {
    const { service } = createService();

    await expect(
      service.apply({
        ...baseInput,
        substitutions: { "barang-2": "barang-9" },
      }),
    ).rejects.toThrow(RestockSubstitutionInvalidError);
  });

  it("menolak barang asli yang tidak ada di purchase order", async () => {
    const { service } = createService();

    await expect(
      service.apply({
        ...baseInput,
        substitutions: { "barang-404": "barang-9" },
      }),
    ).rejects.toThrow("tidak ada di Purchase Order");
  });

  it("menolak barang pengganti yang sudah ada di pesanan yang sama", async () => {
    const { service } = createService({ candidateIds: ["barang-2"] });

    await expect(
      service.apply({
        ...baseInput,
        substitutions: { "barang-1": "barang-2" },
      }),
    ).rejects.toThrow("sudah ada di pesanan ini");
  });

  it("menolak barang pengganti yang tidak ada di master barang tenant", async () => {
    const { service } = createService({ candidateIds: [] });

    await expect(
      service.apply({
        ...baseInput,
        substitutions: { "barang-1": "barang-9" },
      }),
    ).rejects.toThrow("tidak ditemukan pada master barang");
  });
});
