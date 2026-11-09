import { describe, expect, it } from "vitest";

import {
  buildPurchaseFormLines,
  findPurchaseFormProblems,
  selectAllPurchaseLines,
  toPurchaseRecordPayload,
  todayIsoDate,
  type PurchaseForm,
  type PurchaseFormLine,
} from "@/app/admin/inventory/restock/restockPurchaseForm";
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
    purchaseOrderItemId: "poi-1",
    purchasedQuantity: 0,
    barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
    ...overrides,
  };
}

function makeRequest(items: PurchaseRequestItem[]): PurchaseRequest {
  return {
    id: "pr-1",
    nomorRequest: "PR-001",
    status: "ORDERED",
    createdAt: "2026-11-01T00:00:00.000Z",
    requester: { name: "Budi" },
    gudangId: "gudang-a",
    gudang: { id: "gudang-a", nama: "Gudang Utama" },
    purchaseOrder: { id: "po-1", status: "ORDERED" },
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
    items,
  };
}

function makeLine(overrides: Partial<PurchaseFormLine> = {}): PurchaseFormLine {
  return {
    purchaseOrderItemId: "poi-1",
    nama: "Kabel Fiber",
    satuan: "roll",
    remainingToBuy: 6,
    isChecked: true,
    quantity: 6,
    unitPrice: "",
    ...overrides,
  };
}

function makeForm(overrides: Partial<PurchaseForm> = {}): PurchaseForm {
  return {
    storeName: "Toko A",
    purchasedAt: "2026-11-09",
    notes: "",
    buyerName: "",
    lines: [makeLine()],
    ...overrides,
  };
}

const NOW = new Date(2026, 10, 9, 10, 0);

describe("buildPurchaseFormLines", () => {
  it("mengisi jumlah dengan sisa yang belum dibeli dan melewati baris ditolak", () => {
    const lines = buildPurchaseFormLines(
      makeRequest([
        makeItem({ purchasedQuantity: 4 }),
        makeItem({
          id: "item-2",
          purchaseOrderItemId: "poi-2",
          purchasedQuantity: 10,
          barang: { nama: "ONT", kode: "BRG-2", satuan: "pcs" },
        }),
        makeItem({
          id: "item-3",
          statusApproval: "REJECTED",
          purchaseOrderItemId: null,
        }),
      ]),
    );
    expect(lines).toEqual([
      makeLine({ isChecked: false }),
      {
        purchaseOrderItemId: "poi-2",
        nama: "ONT",
        satuan: "pcs",
        remainingToBuy: 0,
        isChecked: false,
        quantity: 0,
        unitPrice: "",
      },
    ]);
  });

  it("menggabungkan dua baris yang menunjuk barang pesanan yang sama", () => {
    const lines = buildPurchaseFormLines(
      makeRequest([makeItem(), makeItem({ id: "item-dup" })]),
    );
    expect(lines).toHaveLength(1);
  });
});

describe("selectAllPurchaseLines", () => {
  it("mencentang semua sisa dengan jumlah penuh, kecuali yang sudah dibeli semua", () => {
    const lines = selectAllPurchaseLines([
      makeLine({ isChecked: false, quantity: 2 }),
      makeLine({ purchaseOrderItemId: "poi-2", remainingToBuy: 0 }),
    ]);
    expect(lines[0]).toMatchObject({ isChecked: true, quantity: 6 });
    expect(lines[1]).toMatchObject({ isChecked: true, remainingToBuy: 0 });
  });
});

describe("findPurchaseFormProblems", () => {
  it("lolos untuk isian yang lengkap", () => {
    expect(findPurchaseFormProblems(makeForm(), NOW)).toEqual([]);
  });

  it("menyebut apa yang kurang dengan kata sehari-hari", () => {
    expect(
      findPurchaseFormProblems(
        makeForm({
          storeName: "  ",
          purchasedAt: "",
          lines: [makeLine({ isChecked: false })],
        }),
        NOW,
      ),
    ).toEqual([
      "Nama toko belum diisi. Tulis nama tokonya.",
      "Tanggal belanja belum diisi.",
      "Belum ada barang yang dicentang. Centang barang yang dibeli di toko ini.",
    ]);
  });

  it("menolak tanggal yang akan datang", () => {
    expect(
      findPurchaseFormProblems(makeForm({ purchasedAt: "2026-11-10" }), NOW),
    ).toEqual(["Tanggal belanja tidak boleh di hari yang akan datang."]);
  });

  it("memeriksa jumlah dan harga per barang", () => {
    expect(
      findPurchaseFormProblems(
        makeForm({
          lines: [
            makeLine({ quantity: 0 }),
            makeLine({ purchaseOrderItemId: "poi-2", quantity: 7 }),
            makeLine({ purchaseOrderItemId: "poi-3", unitPrice: "-5" }),
            makeLine({
              purchaseOrderItemId: "poi-4",
              unitPrice: "2.000.000.000",
            }),
          ],
        }),
        NOW,
      ),
    ).toEqual([
      "Kabel Fiber: jumlah dibeli paling sedikit 1.",
      "Kabel Fiber: tinggal 6 roll yang belum dibeli. Isi paling banyak 6.",
      "Kabel Fiber: harga tidak terbaca. Tulis angka saja, contoh 12000.",
      "Kabel Fiber: harga terlalu besar. Periksa lagi angkanya.",
    ]);
  });
});

describe("harga yang diketik orang", () => {
  it.each(["Rp12.000", "Rp 12.000", "rp. 12000", "12.000,00", " 12 000 "])(
    "membaca %s sebagai 12000",
    (unitPrice) => {
      const form = makeForm({ lines: [makeLine({ unitPrice })] });
      expect(findPurchaseFormProblems(form, NOW)).toEqual([]);
      expect(toPurchaseRecordPayload(form, []).items[0].unitPrice).toBe(12000);
    },
  );

  it("menolak harga berkoma yang bukan sen nol", () => {
    expect(
      findPurchaseFormProblems(
        makeForm({ lines: [makeLine({ unitPrice: "12,5" })] }),
        NOW,
      ),
    ).toEqual([
      "Kabel Fiber: harga tidak terbaca. Tulis angka saja, contoh 12000.",
    ]);
  });
});

describe("toPurchaseRecordPayload", () => {
  it("hanya mengirim barang yang dicentang, harga kosong jadi null", () => {
    const payload = toPurchaseRecordPayload(
      makeForm({
        storeName: "  Toko A ",
        notes: "   ",
        lines: [
          makeLine({ unitPrice: "12.000" }),
          makeLine({ purchaseOrderItemId: "poi-2", quantity: 2 }),
          makeLine({ purchaseOrderItemId: "poi-3", isChecked: false }),
        ],
      }),
      ["https://example.test/nota.jpg"],
    );
    expect(payload).toEqual({
      storeName: "Toko A",
      purchasedAt: "2026-11-09",
      notes: null,
      buyerName: null,
      fotoNota: ["https://example.test/nota.jpg"],
      items: [
        { purchaseOrderItemId: "poi-1", quantity: 6, unitPrice: 12000 },
        { purchaseOrderItemId: "poi-2", quantity: 2, unitPrice: null },
      ],
    });
  });

  it("mengirim nama pembeli yang dirapikan, kosong jadi null", () => {
    expect(
      toPurchaseRecordPayload(makeForm({ buyerName: "  Andi " }), []).buyerName,
    ).toBe("Andi");
    expect(
      toPurchaseRecordPayload(makeForm({ buyerName: "   " }), []).buyerName,
    ).toBeNull();
  });
});

describe("todayIsoDate", () => {
  it("memakai tanggal perangkat, bukan tanggal UTC", () => {
    // 06.30 waktu setempat: di WIB tanggal UTC-nya masih kemarin.
    const earlyMorning = new Date(2026, 10, 9, 6, 30);
    expect(todayIsoDate(earlyMorning)).toBe("2026-11-09");
    expect(todayIsoDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});
