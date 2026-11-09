import { describe, expect, it } from "vitest";

import type {
  RestockPurchaseContext,
  RestockPurchaseContextItem,
} from "@/modules/inventory/domain/ports/IRestockPurchaseRecordRepository";
import {
  getEffectivePurchased,
  getRemainingToBuy,
  isRequestFullyPurchased,
  planPurchaseRecord,
  resolvePurchaseDate,
} from "@/modules/inventory/domain/restock-purchase-record";

function item(
  overrides: Partial<RestockPurchaseContextItem> = {},
): RestockPurchaseContextItem {
  return {
    id: "poi-1",
    barangId: "barang-1",
    quantity: 10,
    cancelledQuantity: 0,
    receivedQuantity: 0,
    purchasedQuantity: 0,
    barang: { nama: "Kabel Fiber", satuan: "roll" },
    ...overrides,
  };
}

function context(
  items: RestockPurchaseContextItem[],
  overrides: {
    requestStatus?: string;
    orderStatus?: string;
    receivableBarangIds?: string[];
  } = {},
): RestockPurchaseContext & {
  purchaseOrder: NonNullable<RestockPurchaseContext["purchaseOrder"]>;
} {
  return {
    request: {
      id: "pr-1",
      nomorRequest: "PR-1",
      status: overrides.requestStatus ?? "APPROVED",
      purchaseOrderId: "po-1",
      receivableBarangIds: overrides.receivableBarangIds ?? ["barang-1"],
    },
    purchaseOrder: {
      id: "po-1",
      poNumber: "PO-1",
      status: overrides.orderStatus ?? "DRAFT",
      tenantId: "tenant-1",
      linkedRequestCount: 1,
      items,
    },
  };
}

describe("batas belanja per item", () => {
  it("barang datang tanpa catatan belanja dihitung sudah dibeli", () => {
    expect(
      getEffectivePurchased(
        item({ purchasedQuantity: 2, receivedQuantity: 6 }),
      ),
    ).toBe(6);
    expect(
      getEffectivePurchased(
        item({ purchasedQuantity: 7, receivedQuantity: 3 }),
      ),
    ).toBe(7);
  });

  it("sisa untuk status menghitung barang yang datang sebagai sudah dibeli", () => {
    expect(
      getRemainingToBuy(item({ purchasedQuantity: 2, receivedQuantity: 6 })),
    ).toBe(4);
    expect(
      getRemainingToBuy(item({ purchasedQuantity: 7, receivedQuantity: 3 })),
    ).toBe(3);
  });
});

describe("batas belanja sama dengan layar", () => {
  it("menolak lebih dari sisa bila sebagian barang sudah datang tanpa catatan", () => {
    // Dipesan 8, datang 5 tanpa catatan: tinggal 3 yang belum dibeli.
    const plan = planPurchaseRecord(
      context([item({ quantity: 8, receivedQuantity: 5 })]),
      [{ purchaseOrderItemId: "poi-1", quantity: 5, unitPrice: null }],
    );
    expect(plan).toMatchObject({ ok: false, code: "INVALID" });

    const allowed = planPurchaseRecord(
      context([item({ quantity: 8, receivedQuantity: 5 })]),
      [{ purchaseOrderItemId: "poi-1", quantity: 3, unitPrice: null }],
    );
    expect(allowed.ok).toBe(true);
  });
});

describe("planPurchaseRecord", () => {
  it("mengisi snapshot barang dan penjaga dari item pesanan", () => {
    const plan = planPurchaseRecord(
      context([item({ cancelledQuantity: 1, purchasedQuantity: 2 })]),
      [{ purchaseOrderItemId: "poi-1", quantity: 3, unitPrice: 12000 }],
    );

    expect(plan).toEqual({
      ok: true,
      lines: [
        {
          purchaseOrderItemId: "poi-1",
          barangId: "barang-1",
          quantity: 3,
          unitPrice: 12000,
          expected: { quantity: 10, cancelledQuantity: 1 },
        },
      ],
    });
  });

  it("menolak item yang bukan milik pesanan", () => {
    const plan = planPurchaseRecord(context([item()]), [
      { purchaseOrderItemId: "poi-asing", quantity: 1, unitPrice: null },
    ]);

    expect(plan).toMatchObject({ ok: false, code: "INVALID" });
    expect(plan.ok === false && plan.error).toContain(
      "bukan bagian pengajuan ini",
    );
  });

  it("menolak barang dari baris yang ditolak atasan", () => {
    const plan = planPurchaseRecord(
      context([item()], { receivableBarangIds: [] }),
      [{ purchaseOrderItemId: "poi-1", quantity: 1, unitPrice: null }],
    );

    expect(plan).toMatchObject({ ok: false, code: "INVALID" });
  });

  it("pada pesanan gabungan menolak barang milik pengajuan lain", () => {
    const plan = planPurchaseRecord(
      context([item(), item({ id: "poi-2", barangId: "barang-lain" })]),
      [{ purchaseOrderItemId: "poi-2", quantity: 1, unitPrice: null }],
    );

    expect(plan).toMatchObject({ ok: false, code: "INVALID" });
  });

  it("menyebut setiap barang yang melebihi sisa, satu per baris", () => {
    const plan = planPurchaseRecord(
      context(
        [
          item({ purchasedQuantity: 8 }),
          item({
            id: "poi-2",
            barangId: "barang-2",
            quantity: 2,
            purchasedQuantity: 2,
            barang: { nama: "ONT", satuan: "pcs" },
          }),
        ],
        { receivableBarangIds: ["barang-1", "barang-2"] },
      ),
      [
        { purchaseOrderItemId: "poi-1", quantity: 3, unitPrice: null },
        { purchaseOrderItemId: "poi-2", quantity: 1, unitPrice: null },
      ],
    );

    expect(plan).toEqual({
      ok: false,
      code: "INVALID",
      error:
        "Kabel Fiber: tinggal 2 roll yang belum dibeli. Isi paling banyak 2.\nONT sudah dibeli semua.",
    });
  });

  it.each([
    ["pengajuan sudah selesai", { requestStatus: "RECEIVED" }],
    ["pesanan sudah selesai", { orderStatus: "RECEIVED" }],
    ["pesanan dibatalkan", { orderStatus: "CANCELLED" }],
  ])("memberi CONFLICT bila %s", (_label, overrides) => {
    const plan = planPurchaseRecord(context([item()], overrides), [
      { purchaseOrderItemId: "poi-1", quantity: 1, unitPrice: null },
    ]);

    expect(plan).toMatchObject({ ok: false, code: "CONFLICT" });
  });
});

describe("isRequestFullyPurchased", () => {
  it("hanya menghitung barang milik pengajuan ini pada pesanan gabungan", () => {
    const items = [
      item({ purchasedQuantity: 10 }),
      item({ id: "poi-2", barangId: "barang-lain", purchasedQuantity: 0 }),
    ];

    expect(isRequestFullyPurchased(items, ["barang-1"])).toBe(true);
    expect(isRequestFullyPurchased(items, ["barang-1", "barang-lain"])).toBe(
      false,
    );
  });

  it("menghitung barang yang sudah datang sebagai sudah dibeli", () => {
    expect(
      isRequestFullyPurchased(
        [item({ purchasedQuantity: 4, receivedQuantity: 10 })],
        ["barang-1"],
      ),
    ).toBe(true);
  });
});

describe("resolvePurchaseDate", () => {
  // 2026-11-09 06:00 WIB = 2026-11-08 23:00 UTC.
  const now = new Date("2026-11-08T23:00:00Z");

  it("menyimpan tanggal belanja pada pukul 12.00 WIB", () => {
    expect(resolvePurchaseDate("2026-11-09", now)?.toISOString()).toBe(
      "2026-11-09T05:00:00.000Z",
    );
  });

  it("menerima besok (WIB) untuk petugas WIT, menolak lusa", () => {
    expect(resolvePurchaseDate("2026-11-10", now)).not.toBeNull();
    expect(resolvePurchaseDate("2026-11-11", now)).toBeNull();
  });

  it("memakai tanggal Jakarta, bukan UTC", () => {
    // Di UTC masih 8 Nov; di Jakarta sudah 9 Nov, jadi 10 Nov masih boleh.
    expect(resolvePurchaseDate("2026-11-10", now)).not.toBeNull();
  });

  it("menolak tanggal yang tidak ada", () => {
    expect(resolvePurchaseDate("2026-02-30", now)).toBeNull();
  });
});
