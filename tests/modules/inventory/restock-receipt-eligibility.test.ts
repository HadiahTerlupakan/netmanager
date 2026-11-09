import { describe, expect, it } from "vitest";

import {
  buildRestockOrderPurchaseEvidence,
  canReceiveWithoutPurchaseReport,
  getOutstandingQuantity,
  getPurchasedAwaitingArrival,
  getReceiveLimit,
  getUnpurchasedRemainder,
  isLegacyPurchasedOrder,
  isMergedRestockOrder,
  RESTOCK_RECEIPT_ELIGIBILITY_MESSAGES,
  type RestockPurchaseEvidence,
} from "@/modules/inventory/domain/restock-receipt-eligibility";
import { getRemainingToBuy } from "@/modules/inventory/domain/restock-purchase-record";

import { LEGACY_PURCHASE_CASES } from "./restock-legacy-purchase-cases";

function evidence(
  overrides: Partial<RestockPurchaseEvidence> = {},
): RestockPurchaseEvidence {
  return {
    purchaseOrderStatus: "DRAFT",
    issuedAt: null,
    purchaseRecordCount: 0,
    hasPurchasedQuantity: false,
    hasArrivedGoods: false,
    linkedRequestCount: 1,
    ...overrides,
  };
}

const item = {
  quantity: 10,
  receivedQuantity: 0,
  cancelledQuantity: 0,
  purchasedQuantity: 0,
};

describe("isLegacyPurchasedOrder", () => {
  it.each(LEGACY_PURCHASE_CASES)("$name", (testCase) => {
    expect(
      isLegacyPurchasedOrder(
        evidence({
          purchaseOrderStatus: testCase.purchaseOrderStatus,
          issuedAt: testCase.issuedAt,
          purchaseRecordCount: testCase.voidedRecordCount,
          hasPurchasedQuantity: testCase.purchasedQuantity > 0,
          hasArrivedGoods:
            testCase.receivedQuantity > 0 || testCase.firstReceiptAt !== null,
        }),
      ),
    ).toBe(testCase.expected);
  });

  it("tanggal yang tidak terbaca dianggap kosong; status yang memutuskan", () => {
    expect(
      isLegacyPurchasedOrder(
        evidence({ purchaseOrderStatus: "DRAFT", issuedAt: "rusak" }),
      ),
    ).toBe(false);
    expect(
      isLegacyPurchasedOrder(
        evidence({ purchaseOrderStatus: "ORDERED", issuedAt: "rusak" }),
      ),
    ).toBe(true);
  });

  it("menerima tanggal beli berupa Date maupun string ISO", () => {
    expect(
      isLegacyPurchasedOrder(
        evidence({ issuedAt: new Date("2026-10-01T00:00:00.000Z") }),
      ),
    ).toBe(true);
    expect(
      isLegacyPurchasedOrder(
        evidence({ issuedAt: "2026-10-01T00:00:00.000Z" }),
      ),
    ).toBe(true);
  });

  it("barang datang tanpa catatan belanja (bahkan saat DRAFT) adalah data lama", () => {
    expect(
      isLegacyPurchasedOrder(
        evidence({ purchaseOrderStatus: "DRAFT", hasArrivedGoods: true }),
      ),
    ).toBe(true);
  });
});

describe("buildRestockOrderPurchaseEvidence", () => {
  it("menyusun bukti dari fakta pesanan", () => {
    expect(
      buildRestockOrderPurchaseEvidence({
        status: "PARTIAL",
        issuedAt: null,
        purchaseRecordCount: 0,
        goodsReceiptCount: 0,
        linkedRequestCount: 1,
        items: [
          { purchasedQuantity: 0, receivedQuantity: 2 },
          { purchasedQuantity: null, receivedQuantity: null },
        ],
      }),
    ).toEqual({
      purchaseOrderStatus: "PARTIAL",
      issuedAt: null,
      purchaseRecordCount: 0,
      hasPurchasedQuantity: false,
      hasArrivedGoods: true,
      linkedRequestCount: 1,
    });
  });
});

describe("canReceiveWithoutPurchaseReport", () => {
  it("mengecualikan pesanan gabungan dan data lama saja", () => {
    expect(isMergedRestockOrder(1)).toBe(false);
    expect(isMergedRestockOrder(2)).toBe(true);
    expect(
      canReceiveWithoutPurchaseReport(evidence({ linkedRequestCount: 2 })),
    ).toBe(true);
    expect(
      canReceiveWithoutPurchaseReport(
        evidence({ purchaseOrderStatus: "ORDERED" }),
      ),
    ).toBe(true);
    expect(canReceiveWithoutPurchaseReport(evidence())).toBe(false);
    expect(
      canReceiveWithoutPurchaseReport(
        evidence({ purchaseOrderStatus: "ORDERED", purchaseRecordCount: 1 }),
      ),
    ).toBe(false);
  });
});

describe("batas jumlah datang", () => {
  it("sudah dibeli tapi belum datang", () => {
    expect(getPurchasedAwaitingArrival({ ...item, purchasedQuantity: 4 })).toBe(
      4,
    );
    expect(
      getPurchasedAwaitingArrival({
        ...item,
        purchasedQuantity: 4,
        receivedQuantity: 1,
      }),
    ).toBe(3);
  });

  it("data lama dengan dibeli < datang memberi 0, bukan negatif", () => {
    expect(
      getPurchasedAwaitingArrival({
        ...item,
        purchasedQuantity: 2,
        receivedQuantity: 5,
      }),
    ).toBe(0);
  });

  it("dibeli melebihi sisa pesanan tetap dibatasi sisa", () => {
    expect(
      getPurchasedAwaitingArrival({
        ...item,
        purchasedQuantity: 10,
        receivedQuantity: 2,
        cancelledQuantity: 5,
      }),
    ).toBe(3);
  });

  it("pesanan yang dikecualikan boleh sampai seluruh sisa", () => {
    const partial = { ...item, receivedQuantity: 3, cancelledQuantity: 1 };
    expect(getOutstandingQuantity(partial)).toBe(6);
    expect(getReceiveLimit(partial, true)).toBe(6);
    expect(getReceiveLimit(partial, false)).toBe(0);
  });
});

describe("getUnpurchasedRemainder", () => {
  it("hanya bagian yang belum dibeli", () => {
    expect(getUnpurchasedRemainder({ ...item, purchasedQuantity: 4 })).toBe(6);
    expect(
      getUnpurchasedRemainder({
        ...item,
        purchasedQuantity: 4,
        cancelledQuantity: 2,
      }),
    ).toBe(4);
    expect(getUnpurchasedRemainder({ ...item, purchasedQuantity: 10 })).toBe(0);
  });

  it("barang datang tanpa catatan (data lama) dihitung sudah dibeli", () => {
    expect(getUnpurchasedRemainder({ ...item, receivedQuantity: 7 })).toBe(3);
  });

  it("sama dengan sisa belum dibeli di catatan belanja", () => {
    const sample = { ...item, purchasedQuantity: 3, receivedQuantity: 5 };
    expect(getRemainingToBuy(sample)).toBe(getUnpurchasedRemainder(sample));
  });
});

describe("pesan", () => {
  it("menyebut batas per barang dalam bahasa awam", () => {
    expect(RESTOCK_RECEIPT_ELIGIBILITY_MESSAGES.overPurchased("Kabel", 0)).toBe(
      "Kabel belum dilaporkan dibeli. Barang ini bisa dicatat datang setelah pembeli melaporkan belanjanya lewat link.",
    );
    expect(RESTOCK_RECEIPT_ELIGIBILITY_MESSAGES.overPurchased("Kabel", 3)).toBe(
      "Kabel: yang sudah dibeli dan belum datang tinggal 3. Catat paling banyak 3. Sisanya bisa dicatat setelah pembeli melaporkan belanjanya lewat link.",
    );
  });
});
