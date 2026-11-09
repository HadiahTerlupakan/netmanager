import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logActivitySafe: vi.fn(),
  createGoodsReceipt: vi.fn(),
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
  return {
    getGoodsReceiptService: () => ({ create: mocks.createGoodsReceipt }),
    GoodsReceiptInvalidError,
    PurchaseOrderNotFoundError,
    ProcurementService: class {},
  };
});

import type { RestockPurchaseOrderItem } from "@/modules/inventory/domain/ports/IRestockGoodsReceiptRepository";
import {
  NOTHING_RECEIVED_MESSAGE,
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
  barang: { id: "b-1", nama: "Kabel Fiber" },
};
const konektor: RestockPurchaseOrderItem = {
  id: "poi-2",
  barangId: "b-2",
  quantity: 5,
  receivedQuantity: 0,
  cancelledQuantity: 0,
  barang: { id: "b-2", nama: "Konektor" },
};

function createRepository(options: {
  status?: string;
  items?: RestockPurchaseOrderItem[];
  statusAfter?: string;
  hasOutstanding?: boolean;
  linkedRequests?: number;
  processedById?: string | null;
  issuedAt?: Date | null;
  receivableBarangIds?: string[];
  hasOutstandingOnRequest?: boolean;
  jasaItemCount?: number;
  paymentStatus?: string;
  isWritten?: boolean;
}) {
  return {
    findPurchaseRequestForReceipt: vi.fn().mockResolvedValue({
      id: "pr-1",
      nomorRequest: "PR-20261108-0001",
      gudangId: "g-1",
      purchaseOrderId: "po-1",
      status: "ORDERED",
      receivableBarangIds: options.receivableBarangIds ?? ["b-1", "b-2"],
    }),
    findPurchaseOrderWithItems: vi.fn().mockResolvedValue({
      id: "po-1",
      poNumber: "PO-20261108-0001",
      status: options.status ?? "ORDERED",
      processedById: options.processedById ?? null,
      issuedAt: options.issuedAt ?? null,
      paymentStatus: options.paymentStatus ?? "UNPAID",
      jasaItemCount: options.jasaItemCount ?? 0,
      goodsReceiptCount: 0,
      items: options.items ?? [kabel],
    }),
    findPurchaseOrderStatus: vi
      .fn()
      .mockResolvedValue(options.statusAfter ?? options.status ?? "ORDERED"),
    hasOutstandingItems: vi.fn((_poId: string, barangIds?: string[]) =>
      Promise.resolve(
        barangIds
          ? (options.hasOutstandingOnRequest ?? options.hasOutstanding ?? true)
          : (options.hasOutstanding ?? true),
      ),
    ),
    countPurchaseRequestsForPurchaseOrder: vi
      .fn()
      .mockResolvedValue(options.linkedRequests ?? 1),
    applyItemCancellations: vi.fn(),
    applyReceiptSettlement: vi.fn().mockResolvedValue(true),
    finishPurchaseOrderWithoutDelivery: vi
      .fn()
      .mockResolvedValue(options.isWritten ?? true),
    recordPurchaseOrderPurchase: vi.fn(),
  };
}

type RepositoryMock = ReturnType<typeof createRepository>;

function createService(repository: RepositoryMock) {
  return new RestockGoodsReceiptService(
    repository as never,
    { apply: vi.fn().mockResolvedValue({}) } as never,
    new RestockItemCancellationService(repository as never),
    {} as never,
  );
}

function receive(
  repository: RepositoryMock,
  input: Partial<ReceiveRestockRequestInput>,
) {
  return createService(repository).receive({
    purchaseRequestId: "pr-1",
    receivedItems: {},
    fotoBukti: [],
    closePO: false,
    canIncreasePurchaseOrder: false,
    actorId: "user-gudang",
    tenantId: "tenant-1",
    ...input,
  });
}

describe("RestockGoodsReceiptService — perjalanan pesanan", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
    mocks.createGoodsReceipt.mockResolvedValue({
      id: "grn-1",
      grnNumber: "GRN-001",
    });
  });

  describe("barang datang", () => {
    it("mencatat pembeli dan tanggal beli saat kiriman pertama pada pesanan gabungan DRAFT", async () => {
      const repository = createRepository({
        status: "DRAFT",
        statusAfter: "PARTIAL",
        linkedRequests: 2,
      });

      await receive(repository, {
        receivedItems: { "b-1": 6 },
        fotoBukti: ["/bukti.webp"],
      });

      expect(repository.recordPurchaseOrderPurchase).toHaveBeenCalledWith({
        purchaseOrderId: "po-1",
        processedById: "user-gudang",
        issuedAt: expect.any(Date),
      });
      // Pencatatan dilakukan setelah GRN berhasil.
      expect(mocks.createGoodsReceipt.mock.invocationCallOrder[0]).toBeLessThan(
        repository.recordPurchaseOrderPurchase.mock.invocationCallOrder[0],
      );
    });

    it("tidak menimpa pembeli dan tanggal yang sudah tercatat", async () => {
      const issuedAt = new Date("2026-11-01T08:00:00Z");
      const repository = createRepository({
        status: "DRAFT",
        processedById: "user-belanja",
        issuedAt,
        linkedRequests: 2,
      });

      await receive(repository, {
        receivedItems: { "b-1": 6 },
        fotoBukti: ["/bukti.webp"],
      });

      expect(repository.recordPurchaseOrderPurchase).toHaveBeenCalledWith({
        purchaseOrderId: "po-1",
        processedById: "user-belanja",
        issuedAt,
      });
    });

    it("tidak mencatat ulang tanggal beli pada pesanan yang sudah dibeli", async () => {
      const repository = createRepository({
        status: "ORDERED",
        issuedAt: new Date("2026-11-01T05:00:00Z"),
        items: [{ ...kabel, purchasedQuantity: 10 }],
      });

      await receive(repository, {
        receivedItems: { "b-1": 6 },
        fotoBukti: ["/bukti.webp"],
      });

      expect(repository.recordPurchaseOrderPurchase).not.toHaveBeenCalled();
    });

    it("menandai semua pengajuan di pesanan yang sama selesai saat pesanan lengkap", async () => {
      const repository = createRepository({
        status: "PARTIAL",
        statusAfter: "RECEIVED",
        hasOutstanding: false,
        linkedRequests: 2,
      });

      const result = await receive(repository, {
        receivedItems: { "b-1": 10 },
        fotoBukti: ["/bukti.webp"],
      });

      expect(repository.applyReceiptSettlement).toHaveBeenCalledWith(
        expect.objectContaining({ settlement: "SETTLE_ORDER" }),
      );
      expect(result).toMatchObject({
        goodsReceipt: { id: "grn-1" },
        purchaseOrderStatus: "RECEIVED",
        purchaseRequestStatus: "RECEIVED",
      });
    });

    it("membiarkan pesanan berjalan bila sisanya masih ditunggu", async () => {
      const repository = createRepository({ statusAfter: "PARTIAL" });

      const result = await receive(repository, {
        receivedItems: { "b-1": 6 },
        fotoBukti: ["/bukti.webp"],
      });

      expect(repository.applyReceiptSettlement).toHaveBeenCalledWith(
        expect.objectContaining({ settlement: "KEEP_OPEN" }),
      );
      expect(result).toMatchObject({
        purchaseOrderStatus: "PARTIAL",
        purchaseRequestStatus: "ORDERED",
      });
    });

    it("menyelesaikan pengajuan ini saja bila barangnya tuntas di pesanan gabungan", async () => {
      const repository = createRepository({
        statusAfter: "PARTIAL",
        linkedRequests: 2,
        receivableBarangIds: ["b-1"],
        hasOutstanding: true,
        hasOutstandingOnRequest: false,
      });

      const result = await receive(repository, {
        receivedItems: { "b-1": 10 },
        fotoBukti: ["/bukti.webp"],
      });

      expect(repository.hasOutstandingItems).toHaveBeenCalledWith("po-1", [
        "b-1",
      ]);
      expect(repository.applyReceiptSettlement).toHaveBeenCalledWith(
        expect.objectContaining({ settlement: "SETTLE_REQUEST" }),
      );
      expect(result).toMatchObject({
        purchaseOrderStatus: "PARTIAL",
        purchaseRequestStatus: "RECEIVED",
      });
    });

    it("mengisi alasan bawaan untuk sisa yang tidak datang saat pesanan ditutup", async () => {
      const repository = createRepository({ items: [kabel, konektor] });

      await receive(repository, {
        receivedItems: { "b-1": 6 },
        cancellations: { "b-2": "Barang habis di toko" },
        fotoBukti: ["/bukti.webp"],
        closePO: true,
      });

      expect(repository.applyItemCancellations).toHaveBeenCalledWith(
        expect.objectContaining({
          cancellations: [
            {
              purchaseOrderItemId: "poi-2",
              cancelledQuantity: 5,
              reason: "Barang habis di toko",
            },
            {
              purchaseOrderItemId: "poi-1",
              cancelledQuantity: 4,
              reason: "Toko tidak mengirim sisanya",
            },
          ],
        }),
      );
    });

    it("tidak mencoret barang pengajuan lain saat menutup pesanan gabungan", async () => {
      const repository = createRepository({
        items: [kabel, konektor],
        linkedRequests: 2,
        receivableBarangIds: ["b-1"],
      });

      await receive(repository, {
        receivedItems: { "b-1": 6 },
        fotoBukti: ["/bukti.webp"],
        closePO: true,
      });

      expect(repository.applyItemCancellations).toHaveBeenCalledWith(
        expect.objectContaining({
          cancellations: [
            {
              purchaseOrderItemId: "poi-1",
              cancelledQuantity: 4,
              reason: "Toko tidak mengirim sisanya",
            },
          ],
        }),
      );
    });

    it("tetap menyimpan kiriman walau tanggal beli gagal dicatat", async () => {
      const repository = createRepository({
        status: "DRAFT",
        linkedRequests: 2,
      });
      repository.recordPurchaseOrderPurchase.mockRejectedValue(
        new Error("koneksi putus"),
      );

      const result = await receive(repository, {
        receivedItems: { "b-1": 6 },
        fotoBukti: ["/bukti.webp"],
      });

      expect(result.goodsReceipt).toMatchObject({ id: "grn-1" });
      expect(repository.applyReceiptSettlement).toHaveBeenCalled();
    });

    it("menolak pesanan yang sudah selesai sebelum stok berubah", async () => {
      const repository = createRepository({ status: "RECEIVED" });

      await expect(
        receive(repository, {
          receivedItems: { "b-1": 1 },
          fotoBukti: ["/bukti.webp"],
        }),
      ).rejects.toThrow("sudah selesai");
      expect(mocks.createGoodsReceipt).not.toHaveBeenCalled();
    });
  });

  describe("tidak ada barang yang datang", () => {
    it("menolak dengan pesan yang tidak menyuruh membatalkan pesanan", async () => {
      const repository = createRepository({});

      await expect(
        receive(repository, { receivedItems: { "b-1": 0 } }),
      ).rejects.toThrow(NOTHING_RECEIVED_MESSAGE);
      expect(NOTHING_RECEIVED_MESSAGE).toBe(
        "Belum ada jumlah barang yang diisi. Kalau barangnya belum datang, simpan nanti saat barang tiba.",
      );
      expect(mocks.createGoodsReceipt).not.toHaveBeenCalled();
    });

    it("membatalkan pesanan milik pengajuan ini saja yang belum menerima apa pun", async () => {
      const repository = createRepository({});

      const result = await receive(repository, {
        receivedItems: { "b-1": 0 },
        closePO: true,
      });

      expect(mocks.createGoodsReceipt).not.toHaveBeenCalled();
      expect(repository.applyItemCancellations).not.toHaveBeenCalled();
      expect(
        repository.finishPurchaseOrderWithoutDelivery,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          purchaseOrderId: "po-1",
          purchaseRequestId: "pr-1",
          settlement: "CANCEL_ORDER",
          cancellations: [
            {
              purchaseOrderItemId: "poi-1",
              cancelledQuantity: 10,
              reason: "Toko tidak mengirim sisanya",
              expected: {
                quantity: 10,
                receivedQuantity: 0,
                cancelledQuantity: 0,
              },
            },
          ],
        }),
      );
      expect(result).toEqual({
        goodsReceipt: null,
        purchaseOrderStatus: "CANCELLED",
        purchaseRequestStatus: "CANCELLED",
      });
      expect(mocks.logActivitySafe).toHaveBeenCalledWith(
        expect.objectContaining({ action: "FINISH_WITHOUT_DELIVERY" }),
      );
    });

    it("memakai alasan yang dipilih petugas tanpa perlu foto", async () => {
      const repository = createRepository({});

      await receive(repository, {
        receivedItems: {},
        cancellations: { "b-1": "Harga terlalu mahal" },
      });

      expect(
        repository.finishPurchaseOrderWithoutDelivery,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          settlement: "CANCEL_ORDER",
          cancellations: [
            expect.objectContaining({
              purchaseOrderItemId: "poi-1",
              cancelledQuantity: 10,
              reason: "Harga terlalu mahal",
            }),
          ],
        }),
      );
    });

    it.each([
      ["punya baris jasa", { jasaItemCount: 1 }],
      ["sudah dibayar", { paymentStatus: "PAID" }],
      ["dibayar sebagian", { paymentStatus: "PARTIAL" }],
    ])(
      "menyelesaikan (bukan membatalkan) pesanan yang %s",
      async (_label, extra) => {
        const repository = createRepository(extra);

        const result = await receive(repository, {
          receivedItems: { "b-1": 0 },
          closePO: true,
        });

        expect(
          repository.finishPurchaseOrderWithoutDelivery,
        ).toHaveBeenCalledWith(
          expect.objectContaining({ settlement: "SETTLE_ORDER" }),
        );
        expect(result).toMatchObject({
          purchaseOrderStatus: "RECEIVED",
          purchaseRequestStatus: "RECEIVED",
        });
      },
    );

    it("pada pesanan gabungan hanya mencoret dan menyelesaikan pengajuan ini", async () => {
      const ont = { ...konektor, barang: { id: "b-2", nama: "ONT" } };
      const repository = createRepository({
        items: [kabel, ont],
        linkedRequests: 2,
        receivableBarangIds: ["b-1"],
      });

      const result = await receive(repository, {
        receivedItems: { "b-1": 0 },
        closePO: true,
      });

      expect(
        repository.finishPurchaseOrderWithoutDelivery,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          settlement: "SETTLE_REQUEST",
          cancellations: [
            expect.objectContaining({ purchaseOrderItemId: "poi-1" }),
          ],
        }),
      );
      expect(result).toMatchObject({
        goodsReceipt: null,
        purchaseOrderStatus: "ORDERED",
        purchaseRequestStatus: "RECEIVED",
      });
    });

    it("menyelesaikan pesanan gabungan yang semua sisanya milik pengajuan ini", async () => {
      const repository = createRepository({
        linkedRequests: 2,
        receivableBarangIds: ["b-1"],
      });

      const result = await receive(repository, {
        receivedItems: { "b-1": 0 },
        closePO: true,
      });

      expect(
        repository.finishPurchaseOrderWithoutDelivery,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ settlement: "SETTLE_ORDER" }),
      );
      expect(result.purchaseRequestStatus).toBe("RECEIVED");
    });

    it("menyelesaikan pesanan yang sebelumnya sudah menerima sebagian", async () => {
      const repository = createRepository({
        status: "PARTIAL",
        items: [{ ...kabel, receivedQuantity: 6 }],
      });

      const result = await receive(repository, {
        receivedItems: { "b-1": 0 },
        closePO: true,
      });

      expect(
        repository.finishPurchaseOrderWithoutDelivery,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          settlement: "SETTLE_ORDER",
          cancellations: [expect.objectContaining({ cancelledQuantity: 4 })],
        }),
      );
      expect(result.purchaseRequestStatus).toBe("RECEIVED");
    });

    it("tetap menunggu barang lain bila hanya satu barang yang tidak jadi datang", async () => {
      const repository = createRepository({ items: [kabel, konektor] });

      const result = await receive(repository, {
        receivedItems: {},
        cancellations: { "b-2": "Tidak jadi dibutuhkan" },
      });

      expect(
        repository.finishPurchaseOrderWithoutDelivery,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ settlement: "KEEP_OPEN" }),
      );
      expect(result).toMatchObject({
        goodsReceipt: null,
        purchaseRequestStatus: "ORDERED",
      });
    });

    it("menolak tanpa menulis apa pun bila pesanan berubah bersamaan", async () => {
      const repository = createRepository({ isWritten: false });

      await expect(
        receive(repository, { receivedItems: { "b-1": 0 }, closePO: true }),
      ).rejects.toThrow(RECEIPT_CONCURRENT_CHANGE_MESSAGE);
      expect(mocks.logActivitySafe).not.toHaveBeenCalled();
    });
  });
});
