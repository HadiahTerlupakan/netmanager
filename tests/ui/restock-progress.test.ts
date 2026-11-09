import { describe, expect, it } from "vitest";

import {
  canDeleteRestockRequest,
  describeGoodsReceiptContents,
  getRestockGoodsReceipts,
  getRestockLineProgress,
  getRestockProgress,
  getRestockProgressActions,
  getRestockPurchaseStep,
  isRestockPurchased,
} from "@/app/admin/inventory/restock/restockProgress";
import type {
  PurchaseRequest,
  PurchaseRequestItem,
} from "@/app/admin/inventory/restock/types";

function makeItem(
  overrides: Partial<PurchaseRequestItem> = {},
): PurchaseRequestItem {
  return {
    id: "item-1",
    barangId: "barang-1",
    jumlah: 10,
    orderedQuantity: 10,
    receivedQuantity: 0,
    cancelledQuantity: 0,
    barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
    ...overrides,
  };
}

function makeRequest(
  overrides: Partial<PurchaseRequest> = {},
): PurchaseRequest {
  return {
    id: "pr-1",
    nomorRequest: "PR-001",
    status: "ORDERED",
    createdAt: "2026-11-01T00:00:00.000Z",
    requester: { name: "Budi" },
    gudangId: "gudang-a",
    gudang: { id: "gudang-a", nama: "Gudang Utama" },
    purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "DRAFT" },
    items: [makeItem()],
    ...overrides,
  };
}

const ont = makeItem({
  id: "item-2",
  barangId: "barang-2",
  barang: { nama: "ONT", kode: "BRG-2", satuan: "pcs" },
});
const konektor = makeItem({
  id: "item-3",
  barangId: "barang-3",
  barang: { nama: "Konektor", kode: "BRG-3", satuan: "pcs" },
});

describe("getRestockProgress", () => {
  it("waits for the approver while the request is a draft", () => {
    const progress = getRestockProgress(makeRequest({ status: "DRAFT" }));
    expect(progress.key).toBe("AWAITING_APPROVAL");
    expect(progress.label).toBe("Menunggu Persetujuan");
    expect(progress.sentence).toBe("Belum diputuskan atasan.");
  });

  it("explains a rejected request", () => {
    const progress = getRestockProgress(makeRequest({ status: "REJECTED" }));
    expect(progress.label).toBe("Ditolak");
    expect(progress.sentence).toBe("Pengajuan ini tidak disetujui.");
  });

  it("asks for admin help when the approved request has no order", () => {
    const progress = getRestockProgress(
      makeRequest({ status: "APPROVED", purchaseOrder: null }),
    );
    expect(progress.key).toBe("NO_ORDER");
    expect(progress.label).toBe("Disetujui, belum bisa dibeli");
    expect(progress.sentence).toBe(
      "Daftar belanjanya belum ada. Hubungi admin. Kalau barangnya sudah datang, tetap bisa dicatat.",
    );
    // Server membuat daftar belanjanya otomatis saat barang dicatat datang.
    expect(getRestockProgressActions(progress.key).receiveLabel).toBe(
      "Catat Barang Datang",
    );
  });

  it("shows not bought while the order is still a draft", () => {
    const progress = getRestockProgress(makeRequest());
    expect(progress.key).toBe("NOT_PURCHASED");
    expect(progress.label).toBe("Belum Dibeli");
    expect(progress.sentence).toBe(
      "Sudah disetujui. Belum ada barang yang dibeli.",
    );
  });

  it("shows bought and waiting once the order left draft", () => {
    const progress = getRestockProgress(
      makeRequest({
        purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "ORDERED" },
      }),
    );
    expect(progress.key).toBe("PURCHASED");
    expect(progress.label).toBe("Sudah Dibeli Semua, Tunggu Barangnya");
    expect(progress.sentence).toBe(
      "Semua barang sudah dibeli. Tunggu barangnya datang.",
    );
  });

  it("names units per item for a partial arrival with one item", () => {
    const progress = getRestockProgress(
      makeRequest({
        items: [makeItem({ purchasedQuantity: 10, receivedQuantity: 6 })],
      }),
    );
    expect(progress.key).toBe("PARTIAL");
    expect(progress.label).toBe("Datang Sebagian");
    expect(progress.sentence).toBe(
      "Kabel Fiber datang 6 dari 10 roll. Masih ditunggu 4 roll.",
    );
  });

  it("names units per item for two items, including the complete one", () => {
    const progress = getRestockProgress(
      makeRequest({
        items: [
          makeItem({ purchasedQuantity: 10, receivedQuantity: 6 }),
          { ...ont, purchasedQuantity: 10, receivedQuantity: 10 },
        ],
      }),
    );
    expect(progress.sentence).toBe(
      "Kabel Fiber datang 6 dari 10 roll. Masih ditunggu 4 roll. ONT datang 10 dari 10 pcs.",
    );
  });

  it("counts kinds of items for a partial arrival with more than two items", () => {
    const progress = getRestockProgress(
      makeRequest({
        items: [
          makeItem({ purchasedQuantity: 10, receivedQuantity: 10 }),
          { ...ont, purchasedQuantity: 10, receivedQuantity: 3 },
          { ...konektor, purchasedQuantity: 10 },
        ],
      }),
    );
    expect(progress.sentence).toBe(
      "1 dari 3 jenis barang sudah lengkap. Sisanya masih ditunggu.",
    );
  });

  it("ignores lines rejected by the approver", () => {
    const progress = getRestockProgress(
      makeRequest({
        items: [
          makeItem({ purchasedQuantity: 10, receivedQuantity: 6 }),
          { ...ont, statusApproval: "REJECTED" },
        ],
      }),
    );
    expect(progress.sentence).toBe(
      "Kabel Fiber datang 6 dari 10 roll. Masih ditunggu 4 roll.",
    );
  });

  it("is complete when everything arrived", () => {
    const progress = getRestockProgress(
      makeRequest({
        status: "RECEIVED",
        items: [makeItem({ receivedQuantity: 10 })],
      }),
    );
    expect(progress.key).toBe("COMPLETE");
    expect(progress.label).toBe("Selesai, Lengkap");
    expect(progress.sentence).toBe("Semua barang sudah datang.");
  });

  it("is complete but short when some quantity will not come", () => {
    const progress = getRestockProgress(
      makeRequest({
        status: "RECEIVED",
        items: [
          makeItem({ receivedQuantity: 6, cancelledQuantity: 4 }),
          { ...ont, receivedQuantity: 10 },
        ],
      }),
    );
    expect(progress.key).toBe("COMPLETE_SHORT");
    expect(progress.label).toBe("Selesai, Kurang");
    expect(progress.sentence).toBe("Kabel Fiber kurang 4 roll.");
  });

  it("counts kinds of item, not units, when more than two lines are short", () => {
    const progress = getRestockProgress(
      makeRequest({
        status: "RECEIVED",
        items: [
          makeItem({ receivedQuantity: 6, cancelledQuantity: 4 }),
          { ...ont, receivedQuantity: 1, cancelledQuantity: 9 },
          { ...konektor, receivedQuantity: 0, cancelledQuantity: 10 },
        ],
      }),
    );
    expect(progress.sentence).toBe("3 jenis barang tidak datang lengkap.");
  });

  it("treats leftover on a legacy short-closed order as not coming", () => {
    const request = makeRequest({
      status: "RECEIVED",
      purchaseOrder: { id: "po-1", status: "RECEIVED" },
      items: [makeItem({ receivedQuantity: 6, cancelledQuantity: 0 })],
    });
    const progress = getRestockProgress(request);
    expect(progress.key).toBe("COMPLETE_SHORT");
    expect(progress.sentence).toBe("Kabel Fiber kurang 4 roll.");
    expect(getRestockLineProgress(request.items[0], true)).toEqual({
      ordered: 10,
      received: 6,
      cancelled: 4,
      remaining: 0,
    });
  });

  it("follows a closed order even when the request was left open", () => {
    const received = getRestockProgress(
      makeRequest({
        status: "ORDERED",
        purchaseOrder: { id: "po-1", status: "RECEIVED" },
        items: [makeItem({ receivedQuantity: 6 })],
      }),
    );
    expect(received.key).toBe("COMPLETE_SHORT");
    expect(getRestockProgressActions(received.key).receiveLabel).toBeNull();

    const cancelled = getRestockProgress(
      makeRequest({
        status: "ORDERED",
        purchaseOrder: { id: "po-1", status: "CANCELLED" },
      }),
    );
    expect(cancelled.key).toBe("CANCELLED");
    expect(getRestockProgressActions(cancelled.key).receiveLabel).toBeNull();
  });

  it("offers no receive or mark-bought action on a jasa-only request", () => {
    const jasa = {
      id: "jasa-line-1",
      jasaId: "jasa-1",
      jumlah: 1,
      hargaPerUnit: 100,
      totalHarga: 100,
      statusKonfirmasi: "PENDING" as const,
      jasa: { id: "jasa-1", kode: "J-1", nama: "Tarik Kabel", satuan: "titik" },
    };
    const pending = getRestockProgress(
      makeRequest({ items: [], jasaItems: [jasa] }),
    );
    expect(pending.key).toBe("SERVICE_PENDING");
    expect(getRestockProgressActions(pending.key)).toEqual({
      receiveLabel: null,
    });

    const done = getRestockProgress(
      makeRequest({
        items: [makeItem({ statusApproval: "REJECTED" })],
        jasaItems: [{ ...jasa, statusKonfirmasi: "SELESAI" }],
      }),
    );
    expect(done.key).toBe("COMPLETE");
    expect(done.sentence).toBe("Semua jasa sudah selesai.");
  });

  it("does not count a short-closed line as complete while others are awaited", () => {
    const many = getRestockProgress(
      makeRequest({
        items: [
          makeItem({
            purchasedQuantity: 10,
            receivedQuantity: 6,
            cancelledQuantity: 4,
          }),
          { ...ont, purchasedQuantity: 10, receivedQuantity: 2 },
          { ...konektor, purchasedQuantity: 10, receivedQuantity: 10 },
        ],
      }),
    );
    expect(many.key).toBe("PARTIAL");
    expect(many.sentence).toBe(
      "1 dari 3 jenis barang sudah lengkap. 1 jenis barang tidak datang lengkap. Sisanya masih ditunggu.",
    );

    const few = getRestockProgress(
      makeRequest({
        items: [
          makeItem({
            purchasedQuantity: 10,
            receivedQuantity: 6,
            cancelledQuantity: 4,
          }),
          { ...ont, purchasedQuantity: 10, receivedQuantity: 2 },
        ],
      }),
    );
    expect(few.sentence).toBe(
      "Kabel Fiber datang 6 dari 10 roll. Tidak jadi datang 4 roll. ONT datang 2 dari 10 pcs. Masih ditunggu 8 pcs.",
    );
  });

  it("treats a still-ordered request without remainder as finished", () => {
    const progress = getRestockProgress(
      makeRequest({ items: [makeItem({ receivedQuantity: 10 })] }),
    );
    expect(progress.key).toBe("COMPLETE");
  });

  it("uses a colour for cancelled that differs from rejected", () => {
    const cancelled = getRestockProgress(makeRequest({ status: "CANCELLED" }));
    const rejected = getRestockProgress(makeRequest({ status: "REJECTED" }));
    expect(cancelled.label).toBe("Dibatalkan");
    expect(cancelled.sentence).toBe(
      "Pesanan ini dibatalkan. Tidak ada barang yang masuk gudang.",
    );
    expect(cancelled.badgeClassName).not.toBe(rejected.badgeClassName);
  });
});

describe("restock progress helpers", () => {
  it("counts a draft order with a receipt as already bought", () => {
    expect(
      isRestockPurchased(
        makeRequest({ items: [makeItem({ receivedQuantity: 1 })] }),
      ),
    ).toBe(true);
    expect(isRestockPurchased(makeRequest())).toBe(false);
  });

  it("never reports a negative remainder", () => {
    expect(getRestockLineProgress(makeItem({ receivedQuantity: 12 }))).toEqual({
      ordered: 10,
      received: 12,
      cancelled: 0,
      remaining: 0,
    });
  });

  it("maps derived status to the receive actions", () => {
    expect(getRestockProgressActions("NOT_PURCHASED")).toEqual({
      receiveLabel: "Catat Barang Datang",
    });
    expect(getRestockProgressActions("PURCHASING").receiveLabel).toBe(
      "Catat Barang Datang",
    );
    expect(getRestockProgressActions("PURCHASED").receiveLabel).toBe(
      "Catat Barang Datang",
    );
    expect(getRestockProgressActions("PARTIAL").receiveLabel).toBe(
      "Catat Kiriman Berikutnya",
    );
    expect(getRestockProgressActions("COMPLETE").receiveLabel).toBeNull();
    expect(
      getRestockProgressActions("SERVICE_PENDING").receiveLabel,
    ).toBeNull();
  });

  it("hides delete once goods were bought or arrived", () => {
    expect(canDeleteRestockRequest(makeRequest(), true)).toBe(true);
    expect(canDeleteRestockRequest(makeRequest(), false)).toBe(false);
    expect(
      canDeleteRestockRequest(
        makeRequest({
          purchaseOrder: { id: "po-1", status: "ORDERED" },
        }),
        true,
      ),
    ).toBe(false);
    expect(
      canDeleteRestockRequest(
        makeRequest({ items: [makeItem({ receivedQuantity: 1 })] }),
        true,
      ),
    ).toBe(false);
    expect(
      canDeleteRestockRequest(makeRequest({ status: "RECEIVED" }), true),
    ).toBe(false);
    expect(
      canDeleteRestockRequest(
        makeRequest({ status: "DRAFT", purchaseOrder: null }),
        true,
      ),
    ).toBe(true);
  });

  it("labels the purchase step, including legacy orders without a date", () => {
    expect(getRestockPurchaseStep(makeRequest())?.label).toBe("Belum dibeli");
    expect(
      getRestockPurchaseStep(
        makeRequest({
          purchaseOrder: { id: "po-1", status: "ORDERED", issuedAt: null },
        }),
      ),
    ).toMatchObject({
      isDone: true,
      label: "Sudah dibeli semua (tanggal tidak tercatat)",
    });
    const dated = getRestockPurchaseStep(
      makeRequest({
        purchaseOrder: {
          id: "po-1",
          status: "ORDERED",
          issuedAt: "2026-11-08T07:20:00.000Z",
          processedBy: { name: "Sari" },
        },
      }),
    );
    expect(dated?.label).toBe(
      "Sudah dibeli semua 8 Nov 2026 (dicatat sekaligus)",
    );
    expect(dated?.processedByName).toBe("Sari");
  });

  it("never claims a purchase for an order closed without date or delivery", () => {
    for (const status of ["CANCELLED", "RECEIVED"]) {
      const request = makeRequest({
        status: status === "CANCELLED" ? "CANCELLED" : "RECEIVED",
        purchaseOrder: { id: "po-1", status, issuedAt: null },
      });
      expect(isRestockPurchased(request)).toBe(false);
      expect(getRestockPurchaseStep(request)).toMatchObject({
        isDone: false,
        label: "Tidak jadi dibeli",
      });
    }
    const markedThenCancelled = makeRequest({
      status: "CANCELLED",
      purchaseOrder: {
        id: "po-1",
        status: "CANCELLED",
        issuedAt: "2026-11-08T07:20:00.000Z",
      },
    });
    expect(isRestockPurchased(markedThenCancelled)).toBe(true);
  });

  it("orders receipts oldest first and falls back to the order's receipts", () => {
    const receipts = getRestockGoodsReceipts(
      makeRequest({
        purchaseOrder: {
          id: "po-1",
          status: "PARTIAL",
          goodsReceipts: [
            {
              id: "g2",
              grnNumber: "GRN-2",
              fotoBukti: [],
              receivedAt: "2026-11-09T00:00:00.000Z",
            },
            {
              id: "g1",
              grnNumber: "GRN-1",
              fotoBukti: [],
              receivedAt: "2026-11-08T00:00:00.000Z",
            },
          ],
        },
      }),
    );
    expect(receipts.map((receipt) => receipt.id)).toEqual(["g1", "g2"]);
  });

  it("describes what arrived in one receipt", () => {
    expect(
      describeGoodsReceiptContents({
        id: "g1",
        grnNumber: "GRN-1",
        fotoBukti: [],
        items: [
          { barangId: "b1", nama: "Kabel Fiber", satuan: "roll", quantity: 6 },
          { barangId: "b2", nama: "ONT", satuan: "pcs", quantity: 10 },
        ],
      }),
    ).toBe("Kabel Fiber 6 roll, ONT 10 pcs");
  });
});
