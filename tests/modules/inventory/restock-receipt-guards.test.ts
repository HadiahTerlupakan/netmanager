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

import { GoodsReceiptExceedsRemainingError } from "@/modules/procurement";
import {
  ENTRY_LINES_MISMATCH_MESSAGE,
  ENTRY_NOT_FINISHED_MESSAGE,
  ENTRY_PHOTO_MISSING_MESSAGE,
  NOTHING_ENTERED_MESSAGE,
  RECEIPT_CONCURRENT_CHANGE_MESSAGE,
} from "@/modules/inventory/services/RestockGoodsReceiptService";
import { RESTOCK_MESSAGES } from "@/modules/inventory/services/restock-messages";
import { RESTOCK_REQUEST_BUSY_MESSAGE } from "@/modules/inventory/services/restock-request-lock";

import {
  createReceiptFixture,
  kabel,
  konektor,
  makeOrder,
  makeRequest,
  receiveWith,
  type ReceiptFixture,
} from "./restock-receipt-fixtures";

function expectNothingWritten(fixture: ReceiptFixture): void {
  expect(fixture.generator.generatePOFromPRs).not.toHaveBeenCalled();
  expect(fixture.substitution.apply).not.toHaveBeenCalled();
  expect(fixture.repository.increaseItemQuantities).not.toHaveBeenCalled();
  expect(fixture.goodsReceipts.create).not.toHaveBeenCalled();
  expect(fixture.repository.closeRequest).not.toHaveBeenCalled();
}

describe("RestockGoodsReceiptService — penjaga Masukkan Barang", () => {
  beforeEach(() => mocks.logActivitySafe.mockReset());

  describe("status pengajuan", () => {
    it("pengajuan yang belum disetujui ditolak 409", async () => {
      const fixture = createReceiptFixture({
        request: makeRequest({ status: "SUBMITTED", purchaseOrderId: null }),
      });

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 10 },
      });

      expect(outcome).toEqual({
        success: false,
        code: "CONFLICT",
        error:
          "Pengajuan ini belum disetujui. Barangnya bisa dimasukkan setelah atasan menyetujuinya.",
      });
      expectNothingWritten(fixture);
    });

    it.each([
      ["RECEIVED", "Pengajuan ini sudah selesai"],
      ["CANCELLED", "Pengajuan ini sudah dibatalkan"],
      ["REJECTED", "Pengajuan ini sudah ditolak"],
    ])("pengajuan berstatus %s ditolak 409", async (status, message) => {
      const fixture = createReceiptFixture({
        request: makeRequest({ status }),
      });

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 10 },
      });

      expect(outcome).toMatchObject({
        success: false,
        code: "CONFLICT",
        error: expect.stringContaining(message),
      });
      expectNothingWritten(fixture);
    });

    it("pengajuan yang semua barangnya sudah tuntas dianggap selesai", async () => {
      const fixture = createReceiptFixture({
        order: makeOrder({ items: [{ ...kabel, receivedQuantity: 10 }] }),
      });

      const outcome = await receiveWith(fixture, { receivedItems: {} });

      expect(outcome).toMatchObject({
        code: "CONFLICT",
        error: expect.stringContaining("sudah selesai"),
      });
    });

    it("pengajuan jasa saja ditolak 409 dan diarahkan ke Konfirmasi Jasa", async () => {
      const fixture = createReceiptFixture({
        request: makeRequest({
          lines: [],
          jasaItems: [{ statusKonfirmasi: "PENDING" }],
        }),
        order: makeOrder({ items: [], jasaItemCount: 1 }),
      });

      const outcome = await receiveWith(fixture, { receivedItems: {} });

      expect(outcome).toMatchObject({
        success: false,
        code: "CONFLICT",
        error: expect.stringContaining("Konfirmasi Jasa"),
      });
      expectNothingWritten(fixture);
    });

    it("pengajuan yang sudah dihapus dijawab 404", async () => {
      const fixture = createReceiptFixture({ request: null });

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 10 },
      });

      expect(outcome).toEqual({
        success: false,
        code: "NOT_FOUND",
        error: RESTOCK_MESSAGES.requestNotFound,
      });
    });
  });

  describe("isian", () => {
    const twoLines = {
      request: makeRequest({
        lines: [
          { barangId: "b-1", jumlah: 10, barang: kabel.barang },
          { barangId: "b-2", jumlah: 5, barang: konektor.barang },
        ],
      }),
      order: makeOrder({ items: [kabel, konektor] }),
    };

    it.each([
      ["baris yang masih bersisa tidak dikirim", { "b-1": 10 }],
      ["ada barang di luar pengajuan", { "b-1": 10, "b-2": 5, "b-x": 1 }],
    ])("menolak bila %s", async (_label, receivedItems) => {
      const fixture = createReceiptFixture(twoLines);

      const outcome = await receiveWith(fixture, { receivedItems });

      expect(outcome).toEqual({
        success: false,
        code: "INVALID",
        error: ENTRY_LINES_MISMATCH_MESSAGE,
      });
      expectNothingWritten(fixture);
    });

    it("barang pengganti hanya untuk barang yang dimasukkan", async () => {
      const fixture = createReceiptFixture(twoLines);

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 0, "b-2": 5 },
        substitutions: { "b-1": "b-9" },
      });

      expect(outcome).toMatchObject({
        code: "INVALID",
        error: ENTRY_LINES_MISMATCH_MESSAGE,
      });
      expectNothingWritten(fixture);
    });

    it("semua 0 pada pengajuan yang belum menerima apa pun diarahkan ke Batalkan", async () => {
      const fixture = createReceiptFixture();

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 0 },
      });

      expect(outcome).toEqual({
        success: false,
        code: "INVALID",
        error:
          "Isi jumlah barang yang masuk. Bila tidak ada barang yang datang, batalkan pengajuan.",
      });
      expect(NOTHING_ENTERED_MESSAGE).toBe(
        "Isi jumlah barang yang masuk. Bila tidak ada barang yang datang, batalkan pengajuan.",
      );
      expectNothingWritten(fixture);
    });

    it("foto bukti wajib bila ada barang yang masuk", async () => {
      const fixture = createReceiptFixture();

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 4 },
        fotoBukti: [],
      });

      expect(outcome).toEqual({
        success: false,
        code: "INVALID",
        error: ENTRY_PHOTO_MISSING_MESSAGE,
      });
      expectNothingWritten(fixture);
    });

    it("kelebihan tanpa alasan ditolak dengan angka yang jelas", async () => {
      const fixture = createReceiptFixture();

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 12 },
        canIncreasePurchaseOrder: true,
      });

      expect(outcome).toMatchObject({
        code: "INVALID",
        error: expect.stringContaining(
          "Kabel Fiber datang 12, padahal sisa pesanannya cuma 10.",
        ),
      });
      expectNothingWritten(fixture);
    });

    it("kelebihan dari akun tanpa izin mengubah pesanan ditolak 403 dengan nama barangnya", async () => {
      const fixture = createReceiptFixture();

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 12 },
        overReceipts: { "b-1": "Supplier kirim lebih" },
      });

      expect(outcome).toMatchObject({
        success: false,
        code: "FORBIDDEN",
        error: expect.stringContaining(
          "Kabel Fiber datang lebih banyak dari pesanan",
        ),
      });
      expectNothingWritten(fixture);
    });
  });

  describe("kunci pengajuan", () => {
    it("pengajuan yang sedang diproses ditolak 409 tanpa membaca apa pun", async () => {
      const fixture = createReceiptFixture();
      fixture.lock.acquire.mockResolvedValue(null);

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 10 },
      });

      expect(outcome).toEqual({
        success: false,
        code: "CONFLICT",
        error: RESTOCK_REQUEST_BUSY_MESSAGE,
      });
      expect(fixture.lock.acquire).toHaveBeenCalledWith("pr-1");
      expect(
        fixture.repository.findPurchaseRequestForReceipt,
      ).not.toHaveBeenCalled();
    });

    it("status dibaca sesudah kunci didapat, dan kunci dilepas sesudah selesai", async () => {
      const fixture = createReceiptFixture();

      await receiveWith(fixture, { receivedItems: { "b-1": 10 } });

      expect(fixture.lock.acquire.mock.invocationCallOrder[0]).toBeLessThan(
        fixture.repository.findPurchaseRequestForReceipt.mock
          .invocationCallOrder[0],
      );
      expect(fixture.release).toHaveBeenCalledTimes(1);
    });

    it("kunci tetap dilepas saat GRN gagal tak terduga, dan kenaikan pesanan dikembalikan", async () => {
      const fixture = createReceiptFixture();
      fixture.goodsReceipts.create.mockRejectedValue(new Error("db down"));

      await expect(
        receiveWith(fixture, {
          receivedItems: { "b-1": 12 },
          overReceipts: { "b-1": "Supplier kirim lebih" },
          canIncreasePurchaseOrder: true,
        }),
      ).rejects.toThrow("db down");

      expect(fixture.repository.undoItemQuantityIncrease).toHaveBeenCalledWith({
        purchaseOrderId: "po-1",
        increases: [{ purchaseOrderItemId: "poi-1", extraQuantity: 2 }],
        markedUnderpaid: false,
      });
      expect(fixture.repository.closeRequest).not.toHaveBeenCalled();
      expect(fixture.release).toHaveBeenCalledTimes(1);
    });
  });

  describe("perubahan bersamaan", () => {
    it("GRN menolak karena sisa pesanan berubah: 409, kenaikan pesanan dikembalikan", async () => {
      const fixture = createReceiptFixture();
      const cause = new GoodsReceiptExceedsRemainingError("poi-1");
      fixture.goodsReceipts.create.mockRejectedValue(cause);

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 12 },
        overReceipts: { "b-1": "Supplier kirim lebih" },
        canIncreasePurchaseOrder: true,
      });

      expect(outcome).toEqual({
        success: false,
        code: "CONFLICT",
        error: RECEIPT_CONCURRENT_CHANGE_MESSAGE,
        cause,
      });
      expect(fixture.repository.undoItemQuantityIncrease).toHaveBeenCalled();
      expect(fixture.repository.closeRequest).not.toHaveBeenCalled();
    });

    /** Log RECEIVE untuk GRN yang tersimpan tetapi pengajuannya belum tertutup. */
    function expectUnfinishedEntryLogged(): void {
      expect(mocks.logActivitySafe).toHaveBeenCalledTimes(1);
      expect(mocks.logActivitySafe).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "RECEIVE",
          details: expect.objectContaining({
            goodsReceiptId: "grn-1",
            grnNumber: "GRN-001",
            items: [{ barangId: "b-1", quantity: 6 }],
            tidakDimasukkan: [],
            pengajuanSelesai: false,
          }),
        }),
      );
    }

    it("penutupan yang ditolak sesudah GRN: 409 tanpa mengajak memasukkan ulang, dan GRN-nya tetap dicatat", async () => {
      const fixture = createReceiptFixture();
      fixture.repository.closeRequest.mockResolvedValue({ isWritten: false });

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 6 },
      });

      expect(outcome).toEqual({
        success: false,
        code: "CONFLICT",
        error: ENTRY_NOT_FINISHED_MESSAGE,
      });
      expect(ENTRY_NOT_FINISHED_MESSAGE).toContain(
        "Jangan masukkan barang yang sama lagi",
      );
      expect(ENTRY_NOT_FINISHED_MESSAGE).toContain(
        '"Selesaikan tanpa barang tambahan"',
      );
      expectUnfinishedEntryLogged();
    });

    it("penutupan yang gagal karena gangguan server sesudah GRN: 409 beserta penyebabnya, bukan 500", async () => {
      const fixture = createReceiptFixture();
      const cause = new Error("Transaction already closed (P2028)");
      fixture.repository.closeRequest.mockRejectedValue(cause);

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 6 },
      });

      expect(outcome).toEqual({
        success: false,
        code: "CONFLICT",
        error: ENTRY_NOT_FINISHED_MESSAGE,
        cause,
      });
      expect(fixture.goodsReceipts.create).toHaveBeenCalledTimes(1);
      expectUnfinishedEntryLogged();
      expect(fixture.release).toHaveBeenCalledTimes(1);
    });

    it("jalan pemulihannya ada: sesudah GRN tersimpan, semua 0 tanpa foto menutup pengajuan tanpa GRN kedua", async () => {
      const fixture = createReceiptFixture();
      fixture.repository.closeRequest.mockRejectedValueOnce(
        new Error("timeout"),
      );
      await receiveWith(fixture, { receivedItems: { "b-1": 6 } });
      fixture.repository.findPurchaseOrderWithItems.mockResolvedValue(
        makeOrder({
          status: "PARTIAL",
          goodsReceiptIds: ["grn-1"],
          items: [{ ...kabel, receivedQuantity: 6 }],
        }),
      );

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
      expect(fixture.goodsReceipts.create).toHaveBeenCalledTimes(1);
    });

    it("penutupan tanpa barang tambahan yang ditolak tidak mengubah apa pun dan tidak dicatat", async () => {
      const fixture = createReceiptFixture({
        order: makeOrder({ items: [{ ...kabel, receivedQuantity: 6 }] }),
      });
      fixture.repository.closeRequest.mockResolvedValue({ isWritten: false });

      const outcome = await receiveWith(fixture, {
        receivedItems: { "b-1": 0 },
        fotoBukti: [],
      });

      expect(outcome).toEqual({
        success: false,
        code: "CONFLICT",
        error: RECEIPT_CONCURRENT_CHANGE_MESSAGE,
      });
      expect(mocks.logActivitySafe).not.toHaveBeenCalled();
    });

    it("gangguan server saat menutup tanpa GRN dilempar ulang: tidak ada yang tertulis, aman dicoba lagi", async () => {
      const fixture = createReceiptFixture({
        order: makeOrder({ items: [{ ...kabel, receivedQuantity: 6 }] }),
      });
      fixture.repository.closeRequest.mockRejectedValue(new Error("db down"));

      await expect(
        receiveWith(fixture, { receivedItems: { "b-1": 0 }, fotoBukti: [] }),
      ).rejects.toThrow("db down");

      expect(mocks.logActivitySafe).not.toHaveBeenCalled();
      expect(fixture.release).toHaveBeenCalledTimes(1);
    });
  });
});
