import { describe, expect, it } from "vitest";

import {
  describeRestockValidationError,
  RESTOCK_PURCHASE_RECORD_LIST_LABELS,
  restockPurchaseRecordSchema,
} from "@/lib/validations/restock";

const valid = {
  storeName: "Toko Sinar",
  purchasedAt: "2026-11-09",
  items: [{ purchaseOrderItemId: "poi-1", quantity: 2 }],
};

function problemsOf(body: unknown): string {
  const parsed = restockPurchaseRecordSchema.safeParse(body);
  if (parsed.success) return "";
  return describeRestockValidationError(
    parsed.error,
    RESTOCK_PURCHASE_RECORD_LIST_LABELS,
  );
}

describe("restockPurchaseRecordSchema", () => {
  it("merapikan isian: nama toko di-trim, catatan kosong jadi null, foto default kosong", () => {
    const parsed = restockPurchaseRecordSchema.parse({
      ...valid,
      storeName: "  Toko Sinar ",
      notes: "   ",
    });

    expect(parsed).toMatchObject({
      storeName: "Toko Sinar",
      notes: null,
      fotoNota: [],
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

  it("membatasi harga, catatan, dan jumlah foto", () => {
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
    expect(problemsOf({ ...valid, fotoNota: Array(6).fill("a") })).toBe(
      "Foto nota paling banyak 5.",
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

  it("membatasi jumlah barang dan panjang alamat foto nota", () => {
    const items = Array.from({ length: 201 }, (_, index) => ({
      purchaseOrderItemId: `poi-${index}`,
      quantity: 1,
    }));
    expect(
      restockPurchaseRecordSchema.safeParse({ ...valid, items }).success,
    ).toBe(false);
    expect(
      restockPurchaseRecordSchema.safeParse({
        ...valid,
        fotoNota: [`https://app.test/${"a".repeat(2048)}`],
      }).success,
    ).toBe(false);
  });
});
