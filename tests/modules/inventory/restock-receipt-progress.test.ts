import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ logActivitySafe: vi.fn() }));

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
vi.mock("@/modules/procurement", () => ({
  GoodsReceiptExceedsRemainingError: class extends Error {},
  GoodsReceiptInvalidError: class extends Error {},
  PurchaseOrderNotFoundError: class extends Error {},
  PurchaseRequestAlreadyOrderedError: class extends Error {},
  PurchaseRequestNotOrderableError: class extends Error {},
  SupplierNotActiveError: class extends Error {},
}));

import {
  PurchaseRequestAlreadyOrderedError,
  PurchaseRequestNotOrderableError,
  SupplierNotActiveError,
} from "@/modules/procurement";
import { NOT_ENTERED_CANCEL_REASON } from "@/modules/inventory/domain/restock-request-status";
import {
  PURCHASE_ORDER_NOT_GENERATED_MESSAGE,
  RECEIPT_CONCURRENT_CHANGE_MESSAGE,
} from "@/modules/inventory/services/RestockGoodsReceiptService";
import { RestockSubstitutionInvalidError } from "@/modules/inventory/services/RestockItemSubstitutionService";

import {
  createReceiptFixture,
  kabel,
  konektor,
  makeOrder,
  makeRequest,
  receiveWith,
} from "./restock-receipt-fixtures";

describe("RestockGoodsReceiptService — Lapor Barang Sampai", () => {
  beforeEach(() => mocks.logActivitySafe.mockReset());

  describe("pengajuan yang sudah disetujui dan punya pesanan", () => {
    it("memasukkan semua barang: GRN dibuat, pesanan dan pengajuan selesai tanpa sisa", async () => {
      const fixture = createReceiptFixture();

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 10 },
      });

      expect(outcome).toEqual({
        success: true,
        data: {
          goodsReceipt: { id: "grn-1", grnNumber: "GRN-001" },
          purchaseRequestStatus: "RECEIVED",
          notEntered: [],
        },
      });
      expect(fixture.goodsReceipts.create).toHaveBeenCalledWith({
        purchaseOrderId: "po-1",
        gudangId: "g-1",
        receivedById: "user-gudang",
        tenantId: "tenant-1",
        fotoBukti: ["/bukti.webp"],
        notes: "Penerimaan dari Pre Request PR-20261121-0001",
        items: [
          { purchaseOrderItemId: "poi-1", barangId: "b-1", quantity: 10 },
        ],
      });
      expect(fixture.repository.closeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          purchaseOrderId: "po-1",
          purchaseRequestId: "pr-1",
          ifOtherRequestsOpen: "SETTLE_REQUEST",
          ifLastOpenRequest: { settlement: "SETTLE_ORDER", cancellations: [] },
          actorId: "user-gudang",
        }),
      );
      expect(fixture.generator.generatePOFromPRs).not.toHaveBeenCalled();
    });

    it("mencoret sisa yang tidak dimasukkan dengan alasan baku, dijaga angka sesudah GRN", async () => {
      const fixture = createReceiptFixture();

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 6 },
      });

      expect(fixture.repository.closeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          ifLastOpenRequest: {
            settlement: "SETTLE_ORDER",
            cancellations: [
              {
                purchaseOrderItemId: "poi-1",
                cancelledQuantity: 4,
                reason: NOT_ENTERED_CANCEL_REASON,
                expected: {
                  quantity: 10,
                  receivedQuantity: 6,
                  cancelledQuantity: 0,
                },
              },
            ],
          },
        }),
      );
      expect(outcome).toMatchObject({
        success: true,
        data: {
          notEntered: [
            { barangId: "b-1", barangName: "Kabel Fiber", quantity: 4 },
          ],
        },
      });
      // GRN dulu: GRN mensyaratkan sisa pesanan masih ada.
      expect(
        fixture.goodsReceipts.create.mock.invocationCallOrder[0],
      ).toBeLessThan(
        fixture.repository.closeRequest.mock.invocationCallOrder[0],
      );
    });

    it("barang yang tidak datang sama sekali dicoret seluruhnya dan tidak masuk GRN", async () => {
      const fixture = createReceiptFixture({
        request: makeRequest({
          lines: [
            { barangId: "b-1", jumlah: 10, barang: kabel.barang },
            { barangId: "b-2", jumlah: 5, barang: konektor.barang },
          ],
        }),
        order: makeOrder({ items: [kabel, konektor] }),
      });

      await receiveWith(fixture, { receivedItems: { "b-1": 10, "b-2": 0 } });

      expect(fixture.goodsReceipts.create).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            { purchaseOrderItemId: "poi-1", barangId: "b-1", quantity: 10 },
          ],
        }),
      );
      expect(fixture.repository.closeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          ifLastOpenRequest: expect.objectContaining({
            cancellations: [
              expect.objectContaining({
                purchaseOrderItemId: "poi-2",
                cancelledQuantity: 5,
                expected: {
                  quantity: 5,
                  receivedQuantity: 0,
                  cancelledQuantity: 0,
                },
              }),
            ],
          }),
        }),
      );
    });

    it("kelebihan beralasan menaikkan pesanan sebelum GRN dan tidak menyisakan apa pun untuk dicoret", async () => {
      const fixture = createReceiptFixture();

      await receiveWith(fixture, {
        receivedItems: { "b-1": 12 },
        overReceipts: { "b-1": "Supplier kirim lebih" },
        canIncreasePurchaseOrder: true,
      });

      expect(fixture.repository.increaseItemQuantities).toHaveBeenCalledWith({
        purchaseOrderId: "po-1",
        increases: [{ purchaseOrderItemId: "poi-1", extraQuantity: 2 }],
      });
      expect(
        fixture.repository.increaseItemQuantities.mock.invocationCallOrder[0],
      ).toBeLessThan(fixture.goodsReceipts.create.mock.invocationCallOrder[0]);
      expect(fixture.goodsReceipts.create).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            { purchaseOrderItemId: "poi-1", barangId: "b-1", quantity: 12 },
          ],
          notes:
            "Penerimaan dari Pre Request PR-20261121-0001. Kelebihan kiriman: Kabel Fiber +2 (Supplier kirim lebih)",
        }),
      );
      expect(fixture.repository.closeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          ifLastOpenRequest: { settlement: "SETTLE_ORDER", cancellations: [] },
        }),
      );
    });

    it("mencatat barang pengganti ke GRN dengan barang penggantinya", async () => {
      const fixture = createReceiptFixture();
      fixture.substitution.apply.mockResolvedValue({ "b-1": "b-9" });

      await receiveWith(fixture, {
        receivedItems: { "b-1": 10 },
        substitutions: { "b-1": "b-9" },
      });

      expect(fixture.substitution.apply).toHaveBeenCalledWith({
        purchaseOrderId: "po-1",
        purchaseOrderItems: [kabel],
        substitutions: { "b-1": "b-9" },
        tenantId: "tenant-1",
        actorId: "user-gudang",
        referenceNumber: "PR-20261121-0001",
      });
      expect(fixture.substitution.validate).not.toHaveBeenCalled();
      expect(fixture.goodsReceipts.create).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            { purchaseOrderItemId: "poi-1", barangId: "b-9", quantity: 10 },
          ],
        }),
      );
    });
  });

  describe("pengajuan lama yang sudah pernah menerima sebagian", () => {
    const partlyReceived = {
      request: makeRequest(),
      order: makeOrder({
        goodsReceiptIds: ["grn-lama"],
        items: [{ ...kabel, receivedQuantity: 6 }],
      }),
    };

    it("boleh diselesaikan tanpa barang tambahan: tanpa GRN, tanpa foto, sisanya dicoret", async () => {
      const fixture = createReceiptFixture(partlyReceived);

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 0 },
        fotoBukti: [],
      });

      expect(outcome).toEqual({
        success: true,
        data: {
          goodsReceipt: null,
          purchaseRequestStatus: "RECEIVED",
          notEntered: [
            { barangId: "b-1", barangName: "Kabel Fiber", quantity: 4 },
          ],
        },
      });
      expect(fixture.goodsReceipts.create).not.toHaveBeenCalled();
      expect(fixture.repository.closeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          ifLastOpenRequest: {
            settlement: "SETTLE_ORDER",
            cancellations: [
              expect.objectContaining({
                cancelledQuantity: 4,
                expected: {
                  quantity: 10,
                  receivedQuantity: 6,
                  cancelledQuantity: 0,
                },
              }),
            ],
          },
        }),
      );
    });

    it("isian awal memakai sisa pesanan: hanya baris yang masih bersisa yang wajib diisi", async () => {
      const fixture = createReceiptFixture({
        request: makeRequest({
          lines: [
            { barangId: "b-1", jumlah: 10, barang: kabel.barang },
            { barangId: "b-2", jumlah: 5, barang: konektor.barang },
          ],
        }),
        order: makeOrder({
          items: [kabel, { ...konektor, receivedQuantity: 5 }],
        }),
      });

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 10 },
      });

      expect(outcome.success).toBe(true);
    });
  });

  describe("pengajuan yang pesanannya gagal dibuat saat persetujuan", () => {
    const approvedWithoutOrder = makeRequest({
      status: "APPROVED",
      purchaseOrderId: null,
    });

    it("membuat pesanan lewat jalur persetujuan lalu memasukkan barang ke pesanan itu", async () => {
      const fixture = createReceiptFixture();
      fixture.repository.findPurchaseRequestForReceipt
        .mockResolvedValueOnce(approvedWithoutOrder)
        .mockResolvedValueOnce(makeRequest());

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 10 },
      });

      expect(outcome.success).toBe(true);
      expect(fixture.generator.generatePOFromPRs).toHaveBeenCalledWith(
        ["pr-1"],
        "user-gudang",
      );
      expect(
        fixture.generator.generatePOFromPRs.mock.invocationCallOrder[0],
      ).toBeLessThan(fixture.goodsReceipts.create.mock.invocationCallOrder[0]);
      expect(fixture.goodsReceipts.create).toHaveBeenCalledWith(
        expect.objectContaining({ purchaseOrderId: "po-1" }),
      );
      expect(mocks.logActivitySafe).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({ pesananDibuatOtomatis: true }),
        }),
      );
    });

    it("memeriksa isian sebelum membuat pesanan", async () => {
      const fixture = createReceiptFixture({ request: approvedWithoutOrder });

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 10 },
        fotoBukti: [],
      });

      expect(outcome).toMatchObject({ success: false, code: "INVALID" });
      expect(fixture.generator.generatePOFromPRs).not.toHaveBeenCalled();
    });

    it("memeriksa barang pengganti terhadap baris pengajuan sebelum membuat pesanan", async () => {
      const fixture = createReceiptFixture({ request: approvedWithoutOrder });
      fixture.substitution.validate.mockRejectedValue(
        new RestockSubstitutionInvalidError(
          "Barang pengganti tidak ditemukan.",
        ),
      );

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 10 },
        substitutions: { "b-1": "b-9" },
      });

      expect(outcome).toEqual({
        success: false,
        code: "INVALID",
        error: "Barang pengganti tidak ditemukan.",
      });
      expect(fixture.substitution.validate).toHaveBeenCalledWith({
        purchaseOrderItems: [
          {
            id: "b-1",
            barangId: "b-1",
            quantity: 10,
            receivedQuantity: 0,
            cancelledQuantity: 0,
            barang: kabel.barang,
          },
        ],
        substitutions: { "b-1": "b-9" },
        tenantId: "tenant-1",
      });
      expect(fixture.generator.generatePOFromPRs).not.toHaveBeenCalled();
    });

    it("pesanan gagal dibuat: tidak ada barang yang masuk, penyebabnya ikut untuk log", async () => {
      const fixture = createReceiptFixture({ request: approvedWithoutOrder });
      const cause = new Error("koneksi putus");
      fixture.generator.generatePOFromPRs.mockRejectedValue(cause);

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 10 },
      });

      expect(outcome).toEqual({
        success: false,
        code: "FAILED",
        error: PURCHASE_ORDER_NOT_GENERATED_MESSAGE,
        cause,
      });
      expect(fixture.goodsReceipts.create).not.toHaveBeenCalled();
    });

    it("toko yang tidak aktif ditolak 409 dengan pesan yang menyebut tokonya", async () => {
      const fixture = createReceiptFixture({ request: approvedWithoutOrder });
      fixture.generator.generatePOFromPRs.mockRejectedValue(
        new SupplierNotActiveError("supplier-1", "INACTIVE"),
      );

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 10 },
      });

      expect(outcome).toMatchObject({
        success: false,
        code: "CONFLICT",
        error: expect.stringContaining(
          "toko untuk barang ini sedang tidak aktif",
        ),
      });
    });

    it.each([
      ["sudah diklaim pesanan lain", new PurchaseRequestAlreadyOrderedError()],
      [
        "tidak lagi berstatus disetujui",
        new PurchaseRequestNotOrderableError(),
      ],
    ])(
      "pengajuan yang %s saat pesanan dibuat ditolak 409 tanpa barang masuk",
      async (_label, cause) => {
        const fixture = createReceiptFixture({ request: approvedWithoutOrder });
        fixture.generator.generatePOFromPRs.mockRejectedValue(cause);

        const outcome = await receiveWith(fixture, {
          receivedItems: { "b-1": 10 },
        });

        expect(outcome).toEqual({
          success: false,
          code: "CONFLICT",
          error: RECEIPT_CONCURRENT_CHANGE_MESSAGE,
          cause,
        });
        expect(fixture.goodsReceipts.create).not.toHaveBeenCalled();
      },
    );
  });
});
