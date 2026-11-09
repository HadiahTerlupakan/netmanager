import { describe, expect, it } from "vitest";

import {
  canDeleteRestockRequest,
  describeGoodsReceiptContents,
  getRestockGoodsReceipts,
  getRestockLineProgress,
  describeRestockStatusLine,
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
  it("keeps a draft at stage 1 and a submitted request at stage 2", () => {
    const draft = getRestockProgress(makeRequest({ status: "DRAFT" }));
    expect(draft.key).toBe("AWAITING_APPROVAL");
    expect(draft).toMatchObject({
      stage: 1,
      stageText: "Tahap 1 dari 4: Pengajuan",
      label: "Belum Diajukan",
      sentence: "Pengajuan belum dikirim ke atasan.",
    });

    const submitted = getRestockProgress(makeRequest({ status: "SUBMITTED" }));
    expect(submitted).toMatchObject({
      stage: 2,
      stageText: "Tahap 2 dari 4: Persetujuan",
      label: "Menunggu Persetujuan",
      sentence: "Belum diputuskan atasan.",
    });
  });

  it("explains a rejected request", () => {
    const progress = getRestockProgress(makeRequest({ status: "REJECTED" }));
    expect(progress.label).toBe("Ditolak");
    expect(progress.sentence).toBe("Pengajuan ini tidak disetujui.");
  });

  it("points to closing the request when the approved request has no order", () => {
    const progress = getRestockProgress(
      makeRequest({ status: "APPROVED", purchaseOrder: null }),
    );
    expect(progress.key).toBe("NO_ORDER");
    expect(progress.stage).toBe(3);
    expect(progress.label).toBe("Belum Bisa Dibeli");
    expect(progress.sentence).toBe(
      'Daftar belanjanya belum ada, jadi link belanja belum bisa dibuat. Bila barangnya tidak jadi dibeli, tutup pengajuan ini lewat "Tutup sisa yang tidak jadi dibeli".',
    );
    // Tanpa laporan belanja tidak ada yang bisa dicatat datang.
    expect(
      getRestockProgressActions(
        makeRequest({ status: "APPROVED", purchaseOrder: null }),
      ),
    ).toEqual({
      receiveLabel: null,
      canSendLink: false,
      canCloseUnpurchased: true,
    });
  });

  it("shows not bought while the order is still a draft", () => {
    const progress = getRestockProgress(makeRequest());
    expect(progress.key).toBe("NOT_PURCHASED");
    expect(progress.stage).toBe(3);
    expect(progress.stageText).toBe("Tahap 3 dari 4: Pembelian");
    expect(progress.label).toBe("Belum Dibeli");
    expect(progress.sentence).toBe(
      "Tahap pembelian: menunggu laporan belanja dari link. Barang baru bisa dicatat datang setelah dilaporkan dibeli.",
    );
  });

  it("moves to stage 4 once a legacy order was marked bought at once", () => {
    const progress = getRestockProgress(
      makeRequest({
        purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "ORDERED" },
      }),
    );
    expect(progress.key).toBe("PURCHASED");
    expect(progress.stage).toBe(4);
    expect(progress.label).toBe("Menunggu Barang");
    expect(progress.sentence).toBe(
      "Semua barang sudah dibeli. Catat barangnya saat datang.",
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
    expect(
      getRestockProgressActions(
        makeRequest({
          status: "ORDERED",
          purchaseOrder: { id: "po-1", status: "RECEIVED" },
          items: [makeItem({ receivedQuantity: 6 })],
        }),
      ).receiveLabel,
    ).toBeNull();

    const cancelledRequest = makeRequest({
      status: "ORDERED",
      purchaseOrder: { id: "po-1", status: "CANCELLED" },
    });
    const cancelled = getRestockProgress(cancelledRequest);
    expect(cancelled.key).toBe("CANCELLED");
    expect(cancelled.stage).toBeNull();
    expect(cancelled.stageText).toBe("");
    expect(getRestockProgressActions(cancelledRequest).receiveLabel).toBeNull();
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
    const pendingRequest = makeRequest({ items: [], jasaItems: [jasa] });
    const pending = getRestockProgress(pendingRequest);
    expect(pending.key).toBe("SERVICE_PENDING");
    expect(getRestockProgressActions(pendingRequest)).toEqual({
      receiveLabel: null,
      canSendLink: false,
      canCloseUnpurchased: false,
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

  it("offers recording goods only for what was reported bought", () => {
    // Belum dibeli: hanya link belanja.
    expect(
      getRestockProgressActions(
        makeRequest({ items: [makeItem({ purchaseOrderItemId: "poi-1" })] }),
      ),
    ).toEqual({
      receiveLabel: null,
      canSendLink: true,
      canCloseUnpurchased: false,
    });
    // Dibeli sebagian: link tetap ada, barang yang sudah dibeli bisa dicatat.
    expect(
      getRestockProgressActions(
        makeRequest({
          purchaseOrder: { id: "po-1", status: "ORDERED" },
          items: [
            makeItem({ purchaseOrderItemId: "poi-1", purchasedQuantity: 4 }),
          ],
        }),
      ),
    ).toEqual({
      receiveLabel: "Catat Barang Datang",
      canSendLink: true,
      canCloseUnpurchased: false,
    });
    // Sudah dibeli semua: hanya catat.
    expect(
      getRestockProgressActions(
        makeRequest({
          purchaseOrder: { id: "po-1", status: "ORDERED" },
          items: [makeItem({ purchasedQuantity: 10 })],
        }),
      ),
    ).toEqual({
      receiveLabel: "Catat Barang Datang",
      canSendLink: false,
      canCloseUnpurchased: false,
    });
    // Sudah datang sebagian: kiriman berikutnya.
    expect(
      getRestockProgressActions(
        makeRequest({
          purchaseOrder: { id: "po-1", status: "PARTIAL" },
          items: [makeItem({ purchasedQuantity: 10, receivedQuantity: 4 })],
        }),
      ).receiveLabel,
    ).toBe("Catat Kiriman Berikutnya");
    // Semua yang dibeli sudah datang, sisanya belum dibeli: tidak ada catat.
    expect(
      getRestockProgressActions(
        makeRequest({
          purchaseOrder: { id: "po-1", status: "PARTIAL" },
          items: [
            makeItem({
              purchaseOrderItemId: "poi-1",
              purchasedQuantity: 4,
              receivedQuantity: 4,
            }),
          ],
        }),
      ),
    ).toEqual({
      receiveLabel: null,
      canSendLink: true,
      canCloseUnpurchased: false,
    });
  });

  it("keeps the old receive action for legacy and merged orders", () => {
    const legacy = makeRequest({
      purchaseOrder: {
        id: "po-1",
        status: "ORDERED",
        issuedAt: "2026-11-01T00:00:00.000Z",
      },
    });
    expect(getRestockProgressActions(legacy)).toEqual({
      receiveLabel: "Catat Barang Datang",
      canSendLink: false,
      canCloseUnpurchased: false,
    });
    const merged = makeRequest({
      purchaseOrder: {
        id: "po-1",
        status: "DRAFT",
        _count: { purchaseRequests: 2 },
      },
    });
    expect(getRestockProgressActions(merged)).toEqual({
      receiveLabel: "Catat Barang Datang",
      canSendLink: false,
      canCloseUnpurchased: false,
    });
    expect(getRestockProgress(merged).sentence).toContain(
      "Barangnya bisa langsung dicatat datang.",
    );
  });

  it("describes the status line for the PDF and screen readers", () => {
    expect(describeRestockStatusLine(getRestockProgress(makeRequest()))).toBe(
      "Tahap 3 dari 4 (Pembelian): Belum Dibeli",
    );
    expect(
      describeRestockStatusLine(
        getRestockProgress(makeRequest({ status: "CANCELLED" })),
      ),
    ).toBe("Dibatalkan");
  });

  it("keeps a partial arrival in the purchase stage while buying continues", () => {
    const progress = getRestockProgress(
      makeRequest({
        purchaseOrder: { id: "po-1", status: "PARTIAL" },
        items: [makeItem({ purchasedQuantity: 6, receivedQuantity: 6 })],
      }),
    );
    // Label dan warna sama dengan "Dibeli Sebagian" sebelum ada barang datang.
    expect(progress).toMatchObject({
      key: "PURCHASING",
      stage: 3,
      label: "Dibeli Sebagian",
      isVerificationStarted: true,
    });
    expect(progress.sentence).toBe(
      "Kabel Fiber dibeli 6 dari 10 roll, sudah datang 6 roll. Tahap pembelian: sisanya menunggu laporan belanja dari link. Barang yang sudah dibeli sudah datang semua.",
    );
  });

  it("separates bought-and-on-the-way from not bought yet", () => {
    const progress = getRestockProgress(
      makeRequest({
        purchaseOrder: { id: "po-1", status: "PARTIAL" },
        items: [makeItem({ purchasedQuantity: 6, receivedQuantity: 2 })],
      }),
    );
    expect(progress.sentence).toBe(
      "Kabel Fiber dibeli 6 dari 10 roll, sudah datang 2 roll. Tahap pembelian: sisanya menunggu laporan belanja dari link. Barang yang sudah dibeli bisa dicatat datang.",
    );
  });

  it("puts a merged order without arrivals in stage 4 as waiting for goods", () => {
    const progress = getRestockProgress(
      makeRequest({
        purchaseOrder: {
          id: "po-1",
          status: "DRAFT",
          _count: { purchaseRequests: 2 },
        },
      }),
    );
    expect(progress).toMatchObject({
      key: "PURCHASED",
      stage: 4,
      label: "Menunggu Barang",
      stageText: "Tahap 4 dari 4: Verifikasi barang sampai",
    });
    expect(progress.sentence).toContain("belanjanya tidak dicatat");
  });

  it("marks where a rejected or cancelled request stopped", () => {
    expect(
      getRestockProgress(makeRequest({ status: "REJECTED" })),
    ).toMatchObject({ stage: 2, stoppedStage: 2 });
    expect(
      getRestockProgress(
        makeRequest({
          status: "CANCELLED",
          approvedAt: "2026-11-01T00:00:00.000Z",
        }),
      ),
    ).toMatchObject({ stage: null, stoppedStage: 3 });
    expect(
      getRestockProgress(
        makeRequest({
          status: "CANCELLED",
          purchaseOrder: null,
          approvedAt: undefined,
        }),
      ).stoppedStage,
    ).toBe(2);
    expect(
      getRestockProgress(
        makeRequest({
          status: "CANCELLED",
          items: [makeItem({ receivedQuantity: 2 })],
        }),
      ).stoppedStage,
    ).toBe(4);
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
    expect(getRestockPurchaseStep(makeRequest())?.label).toBe(
      "Tahap pembelian: menunggu laporan belanja dari link",
    );
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
