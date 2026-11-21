import { vi, type Mock } from "vitest";

import type {
  IncreaseItemQuantitiesInput,
  IRestockGoodsReceiptRepository,
  PurchaseOrderIncreaseUndo,
  RestockPurchaseOrderForReceipt,
  RestockPurchaseOrderItem,
  RestockPurchaseRequestForReceipt,
} from "@/modules/inventory/domain/ports/IRestockGoodsReceiptRepository";
import {
  RestockGoodsReceiptService,
  type ReceiveRestockRequestInput,
  type RestockReceiptOutcome,
} from "@/modules/inventory/services/RestockGoodsReceiptService";
import type { RestockItemSubstitutionService } from "@/modules/inventory/services/RestockItemSubstitutionService";

/*
 * Bahan tes service Masukkan Barang: pengajuan disetujui dengan pesanan
 * ORDERED berisi satu barang, semua dependency berupa mock. Modul yang
 * mengimpor berkas ini wajib me-mock `@/lib/logger` dan `@/modules/procurement`.
 */

export const kabel: RestockPurchaseOrderItem = {
  id: "poi-1",
  barangId: "b-1",
  quantity: 10,
  receivedQuantity: 0,
  cancelledQuantity: 0,
  barang: { id: "b-1", nama: "Kabel Fiber" },
};

export const konektor: RestockPurchaseOrderItem = {
  id: "poi-2",
  barangId: "b-2",
  quantity: 5,
  receivedQuantity: 0,
  cancelledQuantity: 0,
  barang: { id: "b-2", nama: "Konektor" },
};

/** Pengajuan disetujui (ORDERED) dengan baris kabel 10 dan pesanan po-1. */
export function makeRequest(
  overrides: Partial<RestockPurchaseRequestForReceipt> = {},
): RestockPurchaseRequestForReceipt {
  return {
    id: "pr-1",
    purchaseOrderId: "po-1",
    gudangId: "g-1",
    status: "ORDERED",
    nomorRequest: "PR-20261121-0001",
    lines: [
      {
        barangId: "b-1",
        jumlah: 10,
        barang: { id: "b-1", nama: "Kabel Fiber" },
      },
    ],
    jasaItems: [],
    ...overrides,
  };
}

/** Pesanan ORDERED milik satu pengajuan yang belum menerima apa pun. */
export function makeOrder(
  overrides: Partial<RestockPurchaseOrderForReceipt> = {},
): RestockPurchaseOrderForReceipt {
  return {
    id: "po-1",
    status: "ORDERED",
    paymentStatus: "UNPAID",
    jasaItemCount: 0,
    goodsReceiptIds: [],
    hasLegacyPurchases: false,
    items: [kabel],
    ...overrides,
  };
}

export interface ReceiptRepositoryMock {
  findPurchaseRequestForReceipt: Mock;
  findPurchaseOrderWithItems: Mock;
  countPurchaseRequestsForPurchaseOrder: Mock;
  closeRequest: Mock;
  cancelRequestWithoutOrder: Mock;
  findBarangCandidates: Mock;
  applyItemSubstitutions: Mock;
  increaseItemQuantities: Mock;
  undoItemQuantityIncrease: Mock;
}

export interface ReceiptFixture {
  service: RestockGoodsReceiptService;
  repository: ReceiptRepositoryMock;
  substitution: { validate: Mock; apply: Mock };
  generator: { generatePOFromPRs: Mock };
  goodsReceipts: { create: Mock };
  lock: { acquire: Mock };
  release: Mock;
}

export interface ReceiptFixtureOptions {
  request?: RestockPurchaseRequestForReceipt | null;
  order?: RestockPurchaseOrderForReceipt | null;
  linkedRequests?: number;
}

/** Service Masukkan Barang dengan repository, kunci, pembuat pesanan, dan GRN palsu. */
export function createReceiptFixture(
  options: ReceiptFixtureOptions = {},
): ReceiptFixture {
  const release = vi.fn().mockResolvedValue(undefined);
  const repository: ReceiptRepositoryMock = {
    findPurchaseRequestForReceipt: vi
      .fn()
      .mockResolvedValue(
        options.request === undefined ? makeRequest() : options.request,
      ),
    findPurchaseOrderWithItems: vi
      .fn()
      .mockResolvedValue(
        options.order === undefined ? makeOrder() : options.order,
      ),
    countPurchaseRequestsForPurchaseOrder: vi
      .fn()
      .mockResolvedValue(options.linkedRequests ?? 1),
    closeRequest: vi
      .fn()
      .mockResolvedValue({ isWritten: true, isLastOpenRequest: true }),
    cancelRequestWithoutOrder: vi.fn().mockResolvedValue(true),
    findBarangCandidates: vi.fn().mockResolvedValue([]),
    applyItemSubstitutions: vi.fn().mockResolvedValue(undefined),
    increaseItemQuantities: vi.fn(
      async (
        input: IncreaseItemQuantitiesInput,
      ): Promise<PurchaseOrderIncreaseUndo> => ({
        ...input,
        markedUnderpaid: false,
      }),
    ),
    undoItemQuantityIncrease: vi.fn().mockResolvedValue(undefined),
  };
  const substitution = {
    validate: vi.fn().mockResolvedValue(undefined),
    apply: vi.fn().mockResolvedValue({}),
  };
  const generator = {
    generatePOFromPRs: vi
      .fn()
      .mockResolvedValue([{ id: "po-1", poNumber: "PO-20261121-0001" }]),
  };
  const goodsReceipts = {
    create: vi.fn().mockResolvedValue({ id: "grn-1", grnNumber: "GRN-001" }),
  };
  const lock = { acquire: vi.fn().mockResolvedValue(release) };
  const service = new RestockGoodsReceiptService({
    repository: repository as unknown as IRestockGoodsReceiptRepository,
    substitutionService:
      substitution as unknown as RestockItemSubstitutionService,
    purchaseOrderGenerator: generator,
    goodsReceiptCreator: goodsReceipts,
    lock,
  });
  return {
    service,
    repository,
    substitution,
    generator,
    goodsReceipts,
    lock,
    release,
  };
}

/** Masukkan Barang atas pengajuan pr-1 dengan satu foto bukti bawaan. */
export function receiveWith(
  fixture: ReceiptFixture,
  input: Partial<ReceiveRestockRequestInput>,
): Promise<RestockReceiptOutcome> {
  return fixture.service.receive({
    purchaseRequestId: "pr-1",
    receivedItems: {},
    substitutions: {},
    overReceipts: {},
    fotoBukti: ["/bukti.webp"],
    canIncreasePurchaseOrder: false,
    actorId: "user-gudang",
    tenantId: "tenant-1",
    ...input,
  });
}
