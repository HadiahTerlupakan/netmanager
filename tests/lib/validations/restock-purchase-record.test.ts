import { describe, expect, it } from "vitest";

import {
  describeRestockValidationError,
  publicPurchaseRecordSchema,
  RESTOCK_PURCHASE_RECORD_LIST_LABELS,
} from "@/lib/validations/restock";

const valid = {
  token: "A".repeat(43),
  clientRequestId: "6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f",
  buyerName: "Joko",
  storeName: "Toko Sinar",
  purchasedAt: "2026-11-09",
  signatureDataUrl: "data:image/png;base64,iVBORw0KGgo=",
  items: [{ purchaseOrderItemId: "poi-1", quantity: 2 }],
};

function problemsOf(body: unknown): string {
  const parsed = publicPurchaseRecordSchema.safeParse(body);
  if (parsed.success) return "";
  return describeRestockValidationError(
    parsed.error,
    RESTOCK_PURCHASE_RECORD_LIST_LABELS,
  );
}

describe("publicPurchaseRecordSchema: isian belanja", () => {
  it("merapikan isian: nama toko di-trim, catatan kosong jadi null", () => {
    const parsed = publicPurchaseRecordSchema.parse({
      ...valid,
      storeName: "  Toko Sinar ",
      notes: "   ",
    });

    expect(parsed).toMatchObject({
      storeName: "Toko Sinar",
      notes: null,
    });
  });

  it("menolak nama toko kosong dan terlalu panjang", () => {
    expect(problemsOf({ ...valid, storeName: "  " })).toBe(
      "Nama toko belum diisi. Tulis nama tokonya.",
    );
    expect(problemsOf({ ...valid, storeName: "x".repeat(121) })).toBe(
      "Nama toko terlalu panjang. Paling banyak 120 huruf.",
    );
  });

  it("menolak tanggal yang tidak terbaca", () => {
    expect(problemsOf({ ...valid, purchasedAt: "09/11/2026" })).toBe(
      "Tanggal belanja belum diisi atau tidak terbaca.",
    );
  });

  it("menolak daftar barang kosong", () => {
    expect(problemsOf({ ...valid, items: [] })).toBe(
      "Belum ada barang yang dicentang. Centang barang yang dibeli di toko ini.",
    );
  });

  it("menolak barang ganda dengan menyebut posisinya", () => {
    expect(
      problemsOf({
        ...valid,
        items: [
          { purchaseOrderItemId: "poi-1", quantity: 1 },
          { purchaseOrderItemId: "poi-1", quantity: 1 },
        ],
      }),
    ).toBe("Barang ke-2: Barang ini tercantum dua kali. Hapus salah satunya.");
  });

  it("membatasi harga dan catatan", () => {
    expect(
      problemsOf({
        ...valid,
        items: [
          { purchaseOrderItemId: "poi-1", quantity: 1, unitPrice: -1 },
          {
            purchaseOrderItemId: "poi-2",
            quantity: 1,
            unitPrice: 1_000_000_001,
          },
        ],
      }),
    ).toBe(
      "Barang ke-1: Harga tidak boleh minus.\nBarang ke-2: Harga terlalu besar. Periksa lagi angkanya.",
    );
    expect(problemsOf({ ...valid, notes: "x".repeat(501) })).toBe(
      "Catatan terlalu panjang. Paling banyak 500 huruf.",
    );
  });

  it("menolak jumlah 0", () => {
    expect(
      problemsOf({
        ...valid,
        items: [{ purchaseOrderItemId: "poi-1", quantity: 0 }],
      }),
    ).toBe("Barang ke-1: Jumlah dibeli paling sedikit 1.");
  });

  it("membatasi jumlah barang", () => {
    const items = Array.from({ length: 201 }, (_, index) => ({
      purchaseOrderItemId: `poi-${index}`,
      quantity: 1,
    }));
    expect(
      publicPurchaseRecordSchema.safeParse({ ...valid, items }).success,
    ).toBe(false);
  });
});
