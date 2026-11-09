import { describe, expect, it } from "vitest";

import {
  buildRestockReceivePayload,
  fillAllRemaining,
  getNotComingReasonSelectValue,
  getRestockReceiveProblems,
  getRestockReceiveSubmitLabel,
  getRestockReceiveSuccessMessage,
  getRestockReceiveSummary,
  getRestockShortfallConfirmMessage,
  isRestockFinishCancellingOrder,
  needsRestockShortfallConfirm,
  NOTHING_ARRIVED_MESSAGE,
  readRestockReceiptRequestStatus,
  RESTOCK_OTHER_REASON_OPTION,
  type RestockReceiveFormInput,
} from "@/app/admin/inventory/restock/restockReceiveForm";
import type {
  PurchaseRequest,
  PurchaseRequestItem,
} from "@/app/admin/inventory/restock/types";

function makeItem(
  overrides: Partial<PurchaseRequestItem> = {},
): PurchaseRequestItem {
  return {
    id: "item-1",
    barangId: "fiber",
    jumlah: 10,
    orderedQuantity: 10,
    receivedQuantity: 0,
    barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
    ...overrides,
  };
}

const ontItem = makeItem({
  id: "item-2",
  barangId: "ont",
  jumlah: 5,
  orderedQuantity: 5,
  barang: { nama: "ONT", kode: "BRG-2", satuan: "pcs" },
});
const konektorItem = makeItem({
  id: "item-3",
  barangId: "konektor",
  jumlah: 20,
  orderedQuantity: 20,
  barang: { nama: "Konektor", kode: "BRG-3", satuan: "pcs" },
});

const request: PurchaseRequest = {
  id: "pr-1",
  nomorRequest: "PR-001",
  status: "ORDERED",
  createdAt: "2026-11-01T00:00:00.000Z",
  requester: { name: "Budi" },
  gudangId: "gudang-a",
  gudang: { id: "gudang-a", nama: "Gudang Utama" },
  purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "ORDERED" },
  items: [makeItem(), ontItem],
};

function formInput(
  overrides: Partial<RestockReceiveFormInput> = {},
): RestockReceiveFormInput {
  return {
    request,
    receivedItems: { fiber: 10, ont: 5 },
    substitutions: {},
    cancellations: {},
    isFinishingOrder: false,
    barangs: [],
    ...overrides,
  };
}

function problemsFor(
  overrides: Partial<RestockReceiveFormInput> = {},
  extra: { closeReason?: string; photoCount?: number } = {},
) {
  return getRestockReceiveProblems({
    ...formInput(overrides),
    overReceipts: {},
    closeReason: extra.closeReason ?? "",
    photoCount: extra.photoCount ?? 1,
  });
}

describe("getRestockReceiveSummary", () => {
  it("is complete when every remainder arrives today", () => {
    const summary = getRestockReceiveSummary(formInput());
    expect(summary.mode).toBe("COMPLETE");
    expect(summary.hasRemainderAfterToday).toBe(false);
    expect(getRestockReceiveSubmitLabel(summary.mode)).toBe(
      "Simpan, pesanan lengkap",
    );
  });

  it("keeps waiting for the remainder by default", () => {
    const summary = getRestockReceiveSummary(
      formInput({ receivedItems: { fiber: 6, ont: 5 } }),
    );
    expect(summary.mode).toBe("WAITING");
    expect(summary.stillAwaited).toEqual([
      { barangId: "fiber", nama: "Kabel Fiber", satuan: "roll", quantity: 4 },
    ]);
    expect(summary.allowsLineCancellation).toBe(true);
    expect(getRestockReceiveSubmitLabel(summary.mode)).toBe(
      "Simpan, sisa masih ditunggu",
    );
  });

  it("finishes with shortfall when the answer is no", () => {
    const summary = getRestockReceiveSummary(
      formInput({
        receivedItems: { fiber: 6, ont: 5 },
        isFinishingOrder: true,
      }),
    );
    expect(summary.mode).toBe("FINISH");
    expect(summary.notComing).toHaveLength(1);
    expect(summary.allowsLineCancellation).toBe(false);
    expect(getRestockReceiveSubmitLabel(summary.mode)).toBe(
      "Simpan & selesaikan pesanan",
    );
  });

  it("finishes without delivery when nothing arrived and the answer is no", () => {
    const summary = getRestockReceiveSummary(
      formInput({
        receivedItems: { fiber: 0, ont: 0 },
        isFinishingOrder: true,
      }),
    );
    expect(summary.mode).toBe("FINISH_WITHOUT_DELIVERY");
    expect(summary.hasArrivalToday).toBe(false);
    expect(getRestockReceiveSubmitLabel(summary.mode)).toBe(
      "Selesaikan pesanan",
    );
  });

  it("finishes when every remainder was marked as not coming per item", () => {
    const summary = getRestockReceiveSummary(
      formInput({
        receivedItems: { fiber: 6, ont: 5 },
        cancellations: { fiber: "Barang habis di toko" },
      }),
    );
    expect(summary.mode).toBe("FINISH");
    expect(summary.notComing[0]?.quantity).toBe(4);
  });

  it("ignores per-item marks when nothing arrives today", () => {
    const summary = getRestockReceiveSummary(
      formInput({
        receivedItems: { fiber: 0, ont: 0 },
        cancellations: { fiber: "Barang habis di toko" },
      }),
    );
    expect(summary.allowsLineCancellation).toBe(false);
    expect(summary.notComing).toEqual([]);
    expect(summary.mode).toBe("WAITING");
  });

  it("uses the replacement item name for goods arriving today", () => {
    const summary = getRestockReceiveSummary(
      formInput({
        substitutions: { fiber: "dropcore" },
        barangs: [
          { id: "dropcore", kode: "B9", nama: "Dropcore", satuan: "meter" },
        ],
      }),
    );
    expect(summary.arrivingToday[0]).toMatchObject({
      nama: "Dropcore",
      satuan: "meter",
    });
  });
});

describe("getRestockReceiveProblems", () => {
  it("blocks saving when nothing arrives and the order keeps waiting", () => {
    expect(
      problemsFor({ receivedItems: { fiber: 0, ont: 0 } }, { photoCount: 0 }),
    ).toEqual([NOTHING_ARRIVED_MESSAGE]);
    // Pesannya menunjuk tombol yang ada dan jalan keluar bila barang tidak datang.
    expect(NOTHING_ARRIVED_MESSAGE).toContain("tekan Tutup");
    expect(NOTHING_ARRIVED_MESSAGE).toContain(
      '"Tidak, sisanya tidak akan datang" di bagian 3',
    );
  });

  it("does not need a photo when finishing without delivery", () => {
    expect(
      problemsFor(
        { receivedItems: { fiber: 0, ont: 0 }, isFinishingOrder: true },
        { photoCount: 0, closeReason: "Toko tidak mengirim" },
      ),
    ).toEqual([]);
  });

  it("asks for a photo when goods arrive", () => {
    expect(problemsFor({}, { photoCount: 0 })).toEqual([
      "Foto barang yang datang dulu.",
    ]);
  });

  it("requires a reason when the remainder will not come", () => {
    expect(
      problemsFor({
        receivedItems: { fiber: 6, ont: 5 },
        isFinishingOrder: true,
      }),
    ).toEqual(["Pilih alasan kenapa sisanya tidak datang."]);
  });

  it("requires a reason on a per-item mark", () => {
    expect(
      problemsFor({
        receivedItems: { fiber: 6, ont: 5 },
        cancellations: { fiber: "" },
      }),
    ).toEqual(["Pilih alasan kenapa Kabel Fiber tidak datang."]);
  });

  it("asks to remove a mark on an item that arrived in full", () => {
    expect(
      problemsFor({ cancellations: { fiber: "Toko tidak mengirim" } }),
    ).toEqual([
      'Barang yang sudah datang semua tidak perlu ditandai. Tekan "Ternyata masih datang" pada Kabel Fiber.',
    ]);
  });

  it("requires a reason for an over-delivery", () => {
    expect(problemsFor({ receivedItems: { fiber: 12, ont: 5 } })).toEqual([
      "Tulis alasan barang yang datang lebih banyak.",
    ]);
  });
});

describe("buildRestockReceivePayload", () => {
  const payloadFor = (
    overrides: Partial<RestockReceiveFormInput>,
    closeReason = "",
  ) =>
    buildRestockReceivePayload({
      ...formInput(overrides),
      overReceipts: {},
      closeReason,
      fotoBukti: ["foto-1"],
    });

  it("sends no cancellations and keeps the order open while waiting", () => {
    expect(payloadFor({ receivedItems: { fiber: 6, ont: 5 } })).toEqual({
      items: { fiber: 6, ont: 5 },
      substitutions: {},
      cancellations: {},
      overReceipts: {},
      fotoBukti: ["foto-1"],
      closePO: false,
    });
  });

  it("cancels every remaining line with the chosen reason and closes the order", () => {
    const payload = payloadFor(
      {
        request: { ...request, items: [makeItem(), ontItem, konektorItem] },
        receivedItems: { fiber: 6, ont: 5, konektor: 0 },
        cancellations: { fiber: "alasan lama" },
        isFinishingOrder: true,
      },
      " Harga terlalu mahal ",
    );
    expect(payload.cancellations).toEqual({
      fiber: "Harga terlalu mahal",
      konektor: "Harga terlalu mahal",
    });
    expect(payload.closePO).toBe(true);
  });

  it("finishes without delivery with no photo", () => {
    const payload = payloadFor(
      { receivedItems: { fiber: 0, ont: 0 }, isFinishingOrder: true },
      "Toko tidak mengirim",
    );
    expect(payload.fotoBukti).toEqual([]);
    expect(payload.closePO).toBe(true);
    expect(payload.cancellations).toEqual({
      fiber: "Toko tidak mengirim",
      ont: "Toko tidak mengirim",
    });
  });

  it("sends only confirmed per-item marks for lines with a remainder", () => {
    const payload = payloadFor({
      receivedItems: { fiber: 6, ont: 5 },
      cancellations: {
        fiber: "Barang habis di toko",
        ont: "Toko tidak mengirim",
      },
    });
    expect(payload.cancellations).toEqual({ fiber: "Barang habis di toko" });
    expect(payload.closePO).toBe(false);
  });

  it("does not close the order when everything arrived even if the answer was no", () => {
    const payload = payloadFor(
      { isFinishingOrder: true },
      "Toko tidak mengirim",
    );
    expect(payload.closePO).toBe(false);
    expect(payload.cancellations).toEqual({});
  });
});

describe("receive messages", () => {
  it("builds the success toast for each outcome", () => {
    expect(
      getRestockReceiveSuccessMessage(
        getRestockReceiveSummary(formInput()),
        null,
      ),
    ).toBe("Tersimpan. Semua barang sudah datang. Pesanan selesai.");
    expect(
      getRestockReceiveSuccessMessage(
        getRestockReceiveSummary(
          formInput({ receivedItems: { fiber: 6, ont: 5 } }),
        ),
        null,
      ),
    ).toBe(
      "Tersimpan. Barang sudah masuk gudang. Masih ditunggu: Kabel Fiber 4 roll.",
    );
    expect(
      getRestockReceiveSuccessMessage(
        getRestockReceiveSummary(
          formInput({
            request: { ...request, items: [makeItem(), ontItem, konektorItem] },
            receivedItems: { fiber: 1, ont: 1, konektor: 1 },
          }),
        ),
        null,
      ),
    ).toBe(
      "Tersimpan. Barang sudah masuk gudang. Masih ditunggu 3 barang lagi.",
    );
    expect(
      getRestockReceiveSuccessMessage(
        getRestockReceiveSummary(
          formInput({
            receivedItems: { fiber: 6, ont: 5 },
            isFinishingOrder: true,
          }),
        ),
        null,
      ),
    ).toBe(
      "Tersimpan. Pesanan selesai. Tidak jadi datang: Kabel Fiber 4 roll.",
    );
    expect(
      getRestockReceiveSuccessMessage(
        getRestockReceiveSummary(
          formInput({
            receivedItems: { fiber: 0, ont: 0 },
            isFinishingOrder: true,
          }),
        ),
        "CANCELLED",
      ),
    ).toBe("Pesanan dibatalkan. Tidak ada barang yang masuk gudang.");
  });

  it("follows the server when a shared order keeps the request open", () => {
    const complete = getRestockReceiveSummary(formInput());
    expect(getRestockReceiveSuccessMessage(complete, "RECEIVED")).toBe(
      "Tersimpan. Semua barang sudah datang. Pesanan selesai.",
    );
    expect(getRestockReceiveSuccessMessage(complete, "ORDERED")).toBe(
      "Tersimpan. Barang sudah masuk gudang. Sisanya masih ditunggu.",
    );
  });

  it("names units, not a bare count, for what will not come", () => {
    expect(
      getRestockReceiveSuccessMessage(
        getRestockReceiveSummary(
          formInput({
            request: { ...request, items: [makeItem(), ontItem, konektorItem] },
            receivedItems: { fiber: 1, ont: 1, konektor: 1 },
            isFinishingOrder: true,
          }),
        ),
        "RECEIVED",
      ),
    ).toBe("Tersimpan. Pesanan selesai. 3 jenis barang tidak jadi datang.");
  });

  it("says the order will be cancelled when nothing ever arrived", () => {
    const cancelling = getRestockReceiveSummary(
      formInput({
        receivedItems: { fiber: 0, ont: 0 },
        isFinishingOrder: true,
      }),
    );
    const order = request.purchaseOrder!;
    const solo = {
      ...request,
      purchaseOrder: {
        ...order,
        paymentStatus: "UNPAID",
        _count: { purchaseRequests: 1, jasaItems: 0 },
      },
    };
    expect(isRestockFinishCancellingOrder(solo, cancelling)).toBe(true);
    expect(getRestockReceiveSubmitLabel(cancelling.mode, true)).toBe(
      "Batalkan pesanan",
    );
    expect(getRestockShortfallConfirmMessage(cancelling, true)).toBe(
      "Batalkan pesanan ini? Belum ada barang yang datang. Kabel Fiber 10 roll, ONT 5 pcs tidak akan ditunggu lagi.",
    );

    const shared = {
      ...solo,
      purchaseOrder: { ...solo.purchaseOrder, _count: { purchaseRequests: 2 } },
    };
    const paid = {
      ...solo,
      purchaseOrder: { ...solo.purchaseOrder, paymentStatus: "PAID" },
    };
    const withJasa = {
      ...solo,
      purchaseOrder: { ...solo.purchaseOrder, _count: { jasaItems: 1 } },
    };
    const arrivedBefore = {
      ...solo,
      items: [makeItem({ receivedQuantity: 2 }), ontItem],
    };
    // Barang yang sudah dibelanjakan meninggalkan jejak uang: ditutup, bukan dibatalkan.
    const purchasedBefore = {
      ...solo,
      items: [makeItem({ purchasedQuantity: 3 }), ontItem],
    };
    const withPurchaseRecord: PurchaseRequest = {
      ...solo,
      purchaseRecords: [
        {
          id: "rec-1",
          storeName: "Toko A",
          supplierId: null,
          purchasedAt: "2026-11-08T05:00:00.000Z",
          createdAt: "2026-11-08T05:00:00.000Z",
          recordedBy: null,
          buyerName: null,
          source: "ADMIN",
          hasSignature: false,
          notes: null,
          fotoNota: [],
          items: [],
        },
      ],
    };
    for (const target of [
      shared,
      paid,
      withJasa,
      arrivedBefore,
      purchasedBefore,
      withPurchaseRecord,
    ]) {
      expect(isRestockFinishCancellingOrder(target, cancelling)).toBe(false);
    }
    const finishingWithDelivery = getRestockReceiveSummary(
      formInput({
        receivedItems: { fiber: 6, ont: 0 },
        isFinishingOrder: true,
      }),
    );
    expect(isRestockFinishCancellingOrder(solo, finishingWithDelivery)).toBe(
      false,
    );
  });

  it("confirms only when finishing with a shortfall", () => {
    const finishing = getRestockReceiveSummary(
      formInput({
        receivedItems: { fiber: 6, ont: 3 },
        isFinishingOrder: true,
      }),
    );
    expect(needsRestockShortfallConfirm(finishing, true)).toBe(true);
    expect(getRestockShortfallConfirmMessage(finishing)).toBe(
      "Selesaikan dengan barang kurang? Kabel Fiber 4 roll, ONT 2 pcs tidak akan ditunggu lagi.",
    );
    const waiting = getRestockReceiveSummary(
      formInput({ receivedItems: { fiber: 6, ont: 3 } }),
    );
    expect(needsRestockShortfallConfirm(waiting, false)).toBe(false);
  });

  it("reads the request status from the server response", () => {
    expect(
      readRestockReceiptRequestStatus({
        data: null,
        purchaseOrderStatus: "CANCELLED",
        purchaseRequestStatus: "CANCELLED",
      }),
    ).toBe("CANCELLED");
    expect(
      readRestockReceiptRequestStatus({
        data: { id: "grn-1" },
        purchaseRequestStatus: "ORDERED",
      }),
    ).toBe("ORDERED");
    expect(readRestockReceiptRequestStatus(null)).toBeNull();
    expect(readRestockReceiptRequestStatus({ data: null })).toBeNull();
  });
});

describe("receive form helpers", () => {
  it("fills every line with its remainder", () => {
    expect(
      fillAllRemaining(
        {
          ...request,
          items: [makeItem({ receivedQuantity: 6 }), ontItem],
        },
        { fiber: 0, ont: 1 },
      ),
    ).toEqual({ fiber: 4, ont: 5 });
  });

  it("keeps Lainnya selected while its text is still empty", () => {
    expect(getNotComingReasonSelectValue("", false)).toBe("");
    expect(getNotComingReasonSelectValue("", true)).toBe(
      RESTOCK_OTHER_REASON_OPTION.value,
    );
    expect(getNotComingReasonSelectValue("Barang habis di toko", true)).toBe(
      "Barang habis di toko",
    );
    expect(getNotComingReasonSelectValue("Supir sakit", false)).toBe(
      RESTOCK_OTHER_REASON_OPTION.value,
    );
  });
});
