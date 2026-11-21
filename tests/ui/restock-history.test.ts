import { describe, expect, it } from "vitest";

import {
  describeGoodsReceiptContents,
  getRestockGoodsReceipts,
} from "@/app/admin/inventory/restock/restockHistory";
import type {
  GoodsReceiptSummary,
  PurchaseRequest,
} from "@/app/admin/inventory/restock/types";

function makeReceipt(
  overrides: Partial<GoodsReceiptSummary> = {},
): GoodsReceiptSummary {
  return { id: "g1", grnNumber: "GRN-1", fotoBukti: [], ...overrides };
}

function makeRequest(goodsReceipts: GoodsReceiptSummary[]): PurchaseRequest {
  return {
    id: "pr-1",
    nomorRequest: "PR-001",
    status: "RECEIVED",
    createdAt: "2026-11-01T00:00:00.000Z",
    requester: { name: "Budi" },
    gudangId: "gudang-a",
    gudang: { id: "gudang-a", nama: "Gudang Utama" },
    items: [],
    goodsReceipts,
  };
}

describe("getRestockGoodsReceipts", () => {
  it("mengurutkan catatan barang masuk dari yang paling lama", () => {
    const receipts = getRestockGoodsReceipts(
      makeRequest([
        makeReceipt({ id: "g2", receivedAt: "2026-11-09T00:00:00.000Z" }),
        makeReceipt({ id: "g1", receivedAt: "2026-11-08T00:00:00.000Z" }),
      ]),
    );
    expect(receipts.map((receipt) => receipt.id)).toEqual(["g1", "g2"]);
  });

  it("mengembalikan daftar kosong bila belum ada barang masuk", () => {
    const request = makeRequest([]);
    delete request.goodsReceipts;
    expect(getRestockGoodsReceipts(request)).toEqual([]);
  });
});

describe("describeGoodsReceiptContents", () => {
  it("menyebut isi satu catatan dalam satu kalimat", () => {
    expect(
      describeGoodsReceiptContents(
        makeReceipt({
          items: [
            {
              barangId: "b1",
              nama: "Kabel Fiber",
              satuan: "roll",
              quantity: 6,
            },
            { barangId: "b2", nama: "ONT", satuan: null, quantity: 10 },
          ],
        }),
      ),
    ).toBe("Kabel Fiber 6 roll, ONT 10");
  });

  it("memberi tahu bila isinya tidak tercatat", () => {
    expect(describeGoodsReceiptContents(makeReceipt())).toBe(
      "Isi barang masuk tidak tercatat",
    );
  });
});
