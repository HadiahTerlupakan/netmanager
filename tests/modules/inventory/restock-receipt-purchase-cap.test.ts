import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logActivitySafe: vi.fn(),
  createGoodsReceipt: vi.fn(),
  generatePOFromPRs: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logActivitySafe: mocks.logActivitySafe,
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logActivity: vi.fn(),
  },
}));
vi.mock("@/modules/procurement", () => {
  class PurchaseOrderNotFoundError extends Error {}
  class GoodsReceiptInvalidError extends Error {}
  class GoodsReceiptExceedsPurchasedError extends Error {}
  return {
    getGoodsReceiptService: () => ({ create: mocks.createGoodsReceipt }),
    GoodsReceiptInvalidError,
    GoodsReceiptExceedsPurchasedError,
    PurchaseOrderNotFoundError,
    ProcurementService: class {},
  };
});

import { GoodsReceiptExceedsPurchasedError } from "@/modules/procurement";
import type { RestockPurchaseOrderItem } from "@/modules/inventory/domain/ports/IRestockGoodsReceiptRepository";
import { RESTOCK_RECEIPT_ELIGIBILITY_MESSAGES as MESSAGES } from "@/modules/inventory/domain/restock-receipt-eligibility";
import {
  RECEIPT_CONCURRENT_CHANGE_MESSAGE,
  RestockGoodsReceiptService,
  type ReceiveRestockRequestInput,
} from "@/modules/inventory/services/RestockGoodsReceiptService";
import { RestockItemCancellationService } from "@/modules/inventory/services/RestockItemCancellationService";

const kabel: RestockPurchaseOrderItem = {
  id: "poi-1",
  barangId: "b-1",
  quantity: 10,
  receivedQuantity: 0,
  cancelledQuantity: 0,
  purchasedQuantity: 0,
  barang: { id: "b-1", nama: "Kabel Fiber" },
};
const konektor: RestockPurchaseOrderItem = {
  id: "poi-2",
  barangId: "b-2",
  quantity: 5,
  receivedQuantity: 0,
  cancelledQuantity: 0,
  purchasedQuantity: 0,
  barang: { id: "b-2", nama: "Konektor" },
};

interface RepositoryOptions {
  status?: string;
  items?: RestockPurchaseOrderItem[];
  issuedAt?: Date | null;
  purchaseRecordCount?: number;
  goodsReceiptCount?: number;
  linkedRequests?: number;
  purchaseOrderId?: string | null;
  isWritten?: boolean;
}

function createRepository(options: RepositoryOptions = {}) {
  return {
    findPurchaseRequestForReceipt: vi.fn().mockResolvedValue({
      id: "pr-1",
      nomorRequest: "PR-20261109-0001",
      gudangId: "g-1",
      purchaseOrderId:
        options.purchaseOrderId === undefined
          ? "po-1"
          : options.purchaseOrderId,
      status: "ORDERED",
      receivableBarangIds: ["b-1", "b-2"],
    }),
    findPurchaseOrderWithItems: vi.fn().mockResolvedValue({
      id: "po-1",
      poNumber: "PO-1",
      status: options.status ?? "ORDERED",
      issuedAt:
        options.issuedAt === undefined
          ? new Date("2026-11-05T05:00:00Z")
          : options.issuedAt,
      processedById: null,
      paymentStatus: "UNPAID",
      jasaItemCount: 0,
      goodsReceiptCount: options.goodsReceiptCount ?? 0,
      purchaseRecordCount: options.purchaseRecordCount ?? 1,
      items: options.items ?? [{ ...kabel, purchasedQuantity: 4 }],
    }),
    findPurchaseOrderStatus: vi.fn().mockResolvedValue("PARTIAL"),
    hasOutstandingItems: vi.fn().mockResolvedValue(true),
    countPurchaseRequestsForPurchaseOrder: vi
      .fn()
      .mockResolvedValue(options.linkedRequests ?? 1),
    applyItemCancellations: vi.fn(),
    applyReceiptSettlement: vi.fn().mockResolvedValue(true),
    finishPurchaseOrderWithoutDelivery: vi
      .fn()
      .mockResolvedValue(options.isWritten ?? true),
    recordPurchaseOrderPurchase: vi.fn(),
    increaseItemQuantities: vi.fn().mockResolvedValue({
      purchaseOrderId: "po-1",
      increases: [],
      markedUnderpaid: false,
    }),
    undoItemQuantityIncrease: vi.fn(),
  };
}

type RepositoryMock = ReturnType<typeof createRepository>;

function receive(
  repository: RepositoryMock,
  input: Partial<ReceiveRestockRequestInput>,
  substitution = { apply: vi.fn().mockResolvedValue({}) },
) {
  const service = new RestockGoodsReceiptService(
    repository as never,
    substitution as never,
    new RestockItemCancellationService(repository as never),
    { generatePOFromPRs: mocks.generatePOFromPRs } as never,
  );
  return service.receive({
    purchaseRequestId: "pr-1",
    receivedItems: {},
    fotoBukti: ["/bukti.webp"],
    closePO: false,
    canIncreasePurchaseOrder: true,
    actorId: "user-gudang",
    tenantId: "tenant-1",
    ...input,
  });
}

describe("Verifikasi barang sampai hanya setelah dilaporkan dibeli", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
    mocks.createGoodsReceipt.mockResolvedValue({
      id: "grn-1",
      grnNumber: "GRN-1",
    });
  });

  it("menolak barang yang belum dibeli sebelum apa pun ditulis", async () => {
    const repository = createRepository({ items: [kabel] });
    const substitution = { apply: vi.fn().mockResolvedValue({}) };

    await expect(
      receive(
        repository,
        { receivedItems: { "b-1": 1 }, substitutions: { "b-1": "b-9" } },
        substitution,
      ),
    ).rejects.toThrow(MESSAGES.notPurchasedYet);
    expect(substitution.apply).not.toHaveBeenCalled();
    expect(mocks.createGoodsReceipt).not.toHaveBeenCalled();
  });

  it("sudah ada yang dibeli dan semuanya sudah datang: pesannya tidak bilang belum ada yang dibeli", async () => {
    const repository = createRepository({
      items: [{ ...kabel, purchasedQuantity: 5, receivedQuantity: 5 }],
    });

    const attempt = receive(repository, { receivedItems: { "b-1": 1 } });
    await expect(attempt).rejects.toThrow(MESSAGES.purchasedAllArrived);
    await expect(attempt).rejects.not.toThrow(MESSAGES.notPurchasedYet);
    expect(mocks.createGoodsReceipt).not.toHaveBeenCalled();
  });

  it("menyebut batas tiap barang yang melebihi jumlah dibeli", async () => {
    const repository = createRepository({
      items: [
        { ...kabel, purchasedQuantity: 4, receivedQuantity: 1 },
        { ...konektor, purchasedQuantity: 0 },
      ],
    });

    await expect(
      receive(repository, { receivedItems: { "b-1": 5, "b-2": 1 } }),
    ).rejects.toThrow(
      [
        MESSAGES.overPurchased("Kabel Fiber", 3),
        MESSAGES.overPurchased("Konektor", 0),
      ].join("\n"),
    );
    expect(mocks.createGoodsReceipt).not.toHaveBeenCalled();
  });

  it("membaca jumlah barang pengganti dengan kunci yang sama seperti GRN", async () => {
    const repository = createRepository();

    await expect(
      receive(repository, {
        receivedItems: { "b-9": 5 },
        substitutions: { "b-1": "b-9" },
      }),
    ).rejects.toThrow(MESSAGES.overPurchased("Kabel Fiber", 4));
  });

  it("jumlah tepat sebatas yang dibeli lolos dan GRN dijaga batas dibeli", async () => {
    const repository = createRepository();

    await receive(repository, { receivedItems: { "b-1": 4 } });

    expect(mocks.createGoodsReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        isLimitedToPurchased: true,
        items: [{ purchaseOrderItemId: "poi-1", barangId: "b-1", quantity: 4 }],
      }),
    );
    expect(repository.recordPurchaseOrderPurchase).not.toHaveBeenCalled();
  });

  it("kelebihan kiriman pada pesanan lewat link ikut ditolak", async () => {
    const repository = createRepository({
      items: [{ ...kabel, purchasedQuantity: 10 }],
    });

    await expect(
      receive(repository, {
        receivedItems: { "b-1": 12 },
        overReceipts: { "b-1": "bonus dari toko" },
      }),
    ).rejects.toThrow(MESSAGES.overPurchased("Kabel Fiber", 10));
    expect(repository.increaseItemQuantities).not.toHaveBeenCalled();
  });

  it("laporan belanja yang berubah di tengah jalan menjadi pesan awam dan kenaikan pesanan dikembalikan", async () => {
    const repository = createRepository({
      // Data lama dengan kelebihan kiriman: kenaikan pesanan dicatat dulu.
      items: [kabel],
      purchaseRecordCount: 0,
    });
    mocks.createGoodsReceipt.mockRejectedValue(
      new GoodsReceiptExceedsPurchasedError("poi-1"),
    );

    await expect(
      receive(repository, {
        receivedItems: { "b-1": 12 },
        overReceipts: { "b-1": "bonus dari toko" },
      }),
    ).rejects.toThrow(MESSAGES.purchaseChanged);
    expect(repository.undoItemQuantityIncrease).toHaveBeenCalled();
  });

  it("data lama dan pesanan gabungan tetap seperti dulu", async () => {
    const legacy = createRepository({
      items: [kabel],
      purchaseRecordCount: 0,
    });
    await receive(legacy, { receivedItems: { "b-1": 10 } });
    expect(mocks.createGoodsReceipt).toHaveBeenLastCalledWith(
      expect.objectContaining({ isLimitedToPurchased: false }),
    );

    const merged = createRepository({
      status: "DRAFT",
      issuedAt: null,
      items: [kabel],
      purchaseRecordCount: 0,
      linkedRequests: 2,
    });
    await receive(merged, { receivedItems: { "b-1": 10 } });
    expect(mocks.createGoodsReceipt).toHaveBeenLastCalledWith(
      expect.objectContaining({ isLimitedToPurchased: false }),
    );
    expect(merged.recordPurchaseOrderPurchase).toHaveBeenCalled();
  });

  it("data lama tanpa tanggal beli diberi tanggal sedikit sebelum kiriman", async () => {
    const repository = createRepository({
      issuedAt: null,
      items: [kabel],
      purchaseRecordCount: 0,
    });

    await receive(repository, { receivedItems: { "b-1": 3 } });

    const [{ issuedAt }] = repository.recordPurchaseOrderPurchase.mock
      .calls[0] as [{ issuedAt: Date }];
    const [{ receivedAt }] = mocks.createGoodsReceipt.mock.calls[0] as [
      { receivedAt: Date },
    ];
    expect(receivedAt).toBeInstanceOf(Date);
    expect(receivedAt.getTime() - issuedAt.getTime()).toBe(1000);
    expect(
      repository.recordPurchaseOrderPurchase.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.createGoodsReceipt.mock.invocationCallOrder[0]);
  });

  it("pengajuan tanpa daftar belanja ditolak tanpa membuat pesanan", async () => {
    const repository = createRepository({ purchaseOrderId: null });

    await expect(
      receive(repository, { receivedItems: { "b-1": 1 } }),
    ).rejects.toThrow(MESSAGES.notPurchasedYet);
    expect(mocks.generatePOFromPRs).not.toHaveBeenCalled();
  });
});

describe("Tutup sisa yang tidak jadi dibeli", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  it("alasan wajib diisi", async () => {
    const repository = createRepository();

    await expect(
      receive(repository, {
        fotoBukti: [],
        closeUnpurchased: true,
        closeReason: "  ",
      }),
    ).rejects.toThrow(MESSAGES.closeReasonMissing);
    expect(
      repository.finishPurchaseOrderWithoutDelivery,
    ).not.toHaveBeenCalled();
  });

  it("tidak bisa digabung dengan barang datang", async () => {
    const repository = createRepository();

    await expect(
      receive(repository, {
        receivedItems: { "b-1": 1 },
        closeUnpurchased: true,
        closeReason: "Barang habis di toko",
      }),
    ).rejects.toThrow(MESSAGES.closeWithDelivery);
    expect(repository.findPurchaseRequestForReceipt).not.toHaveBeenCalled();
  });

  it("mencoret hanya yang belum dibeli, dijaga jumlah dibeli, lalu mencabut link", async () => {
    const repository = createRepository({
      items: [
        { ...kabel, purchasedQuantity: 4, receivedQuantity: 1 },
        { ...konektor, purchasedQuantity: 5 },
      ],
    });

    const result = await receive(repository, {
      fotoBukti: [],
      closeUnpurchased: true,
      closeReason: "Barang habis di toko",
    });

    expect(repository.finishPurchaseOrderWithoutDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        settlement: "KEEP_OPEN",
        revokeRequestLinks: true,
        cancellations: [
          {
            purchaseOrderItemId: "poi-1",
            cancelledQuantity: 6,
            reason: "Barang habis di toko",
            expected: {
              quantity: 10,
              receivedQuantity: 1,
              cancelledQuantity: 0,
              purchasedQuantity: 4,
            },
          },
        ],
      }),
    );
    expect(mocks.createGoodsReceipt).not.toHaveBeenCalled();
    expect(result.goodsReceipt).toBeNull();
    expect(mocks.logActivitySafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "FINISH_WITHOUT_DELIVERY",
        details: expect.objectContaining({
          tidakJadiDibeli: [{ barangId: "b-1", jumlah: 6 }],
          alasan: "Barang habis di toko",
        }),
      }),
    );
  });

  it("membatalkan pengajuan bila belum ada yang dibeli maupun datang", async () => {
    const repository = createRepository({
      status: "DRAFT",
      issuedAt: null,
      purchaseRecordCount: 0,
      items: [kabel],
    });

    const result = await receive(repository, {
      fotoBukti: [],
      closeUnpurchased: true,
      closeReason: "Tidak jadi dibutuhkan",
    });

    expect(repository.finishPurchaseOrderWithoutDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ settlement: "CANCEL_ORDER" }),
    );
    expect(result.purchaseRequestStatus).toBe("CANCELLED");
  });

  it("menolak bila semua sudah dibeli", async () => {
    const repository = createRepository({
      items: [{ ...kabel, purchasedQuantity: 10 }],
    });

    await expect(
      receive(repository, {
        fotoBukti: [],
        closeUnpurchased: true,
        closeReason: "Barang habis di toko",
      }),
    ).rejects.toThrow(MESSAGES.nothingUnpurchased);
  });

  it("laporan belanja yang masuk bersamaan membatalkan penutupan", async () => {
    const repository = createRepository({ isWritten: false });

    await expect(
      receive(repository, {
        fotoBukti: [],
        closeUnpurchased: true,
        closeReason: "Barang habis di toko",
      }),
    ).rejects.toThrow(RECEIPT_CONCURRENT_CHANGE_MESSAGE);
  });

  it("pengajuan tanpa daftar belanja tetap bisa ditutup", async () => {
    const repository = createRepository({
      purchaseOrderId: null,
      status: "DRAFT",
      issuedAt: null,
      purchaseRecordCount: 0,
      items: [kabel],
    });
    mocks.generatePOFromPRs.mockResolvedValue([{ id: "po-1" }]);

    await receive(repository, {
      fotoBukti: [],
      closeUnpurchased: true,
      closeReason: "Tidak jadi dibutuhkan",
    });

    expect(mocks.generatePOFromPRs).toHaveBeenCalled();
    expect(repository.finishPurchaseOrderWithoutDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ settlement: "CANCEL_ORDER" }),
    );
  });
});
