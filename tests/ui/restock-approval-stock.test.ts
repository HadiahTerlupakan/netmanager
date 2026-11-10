import { describe, expect, it } from "vitest";

import {
  describeApprovalStock,
  getUsableStock,
  type ApprovalStockItem,
} from "@/app/admin/inventory/restock/restockApprovalStock";

function stock(overrides: Partial<ApprovalStockItem> = {}): ApprovalStockItem {
  return {
    barangId: "barang-1",
    stok: 12,
    stokBaru: 8,
    stokBekas: 3,
    stokRusak: 1,
    minStok: null,
    ...overrides,
  };
}

describe("describeApprovalStock", () => {
  it("cukup: total, kondisi, dan kesimpulan dibanding yang diajukan", () => {
    expect(describeApprovalStock(stock(), 5, "roll")).toEqual({
      tone: "enough",
      totalText: "Stok di gudang ini: 12 roll",
      conditionText: "Baru 8 · Bekas 3 · Rusak 1",
      verdict:
        "Stok yang bisa dipakai (11 roll) sudah cukup untuk 5 roll yang diajukan.",
      notes: [],
    });
  });

  it("kurang: menyebut kekurangannya; yang rusak tidak dihitung", () => {
    const summary = describeApprovalStock(stock(), 20, "roll");
    expect(summary.tone).toBe("warning");
    expect(summary.verdict).toBe(
      "Stok yang bisa dipakai (11 roll) kurang 9 roll dari yang diajukan.",
    );
  });

  it("barang yang belum pernah ada di gudang ini dianggap habis", () => {
    expect(describeApprovalStock(undefined, 5, "pcs")).toMatchObject({
      tone: "danger",
      totalText: "Stok di gudang ini: 0 pcs",
      conditionText: null,
      verdict: "Stok habis di gudang ini.",
    });
  });

  it("semua stok rusak: tidak ada yang bisa dipakai", () => {
    const summary = describeApprovalStock(
      stock({ stok: 4, stokBaru: 0, stokBekas: 0, stokRusak: 4 }),
      2,
      "pcs",
    );
    expect(summary.tone).toBe("danger");
    expect(summary.verdict).toBe(
      "Semua stok rusak, tidak ada yang bisa dipakai.",
    );
  });

  it("di bawah minimum: catatan minimum dan perkiraan setelah datang", () => {
    const summary = describeApprovalStock(
      stock({ stok: 3, stokBaru: 3, stokBekas: 0, stokRusak: 0, minStok: 10 }),
      2,
      "roll",
    );
    expect(summary.tone).toBe("enough");
    expect(summary.notes).toEqual([
      "Di bawah stok minimum gudang ini (10 roll). Setelah barang datang: 5 roll.",
    ]);
  });

  it("rincian kondisi yang tidak cocok dengan total disebut terang-terangan", () => {
    const summary = describeApprovalStock(
      stock({ stok: 10, stokBaru: 4, stokBekas: 0, stokRusak: 0 }),
      2,
      "pcs",
    );
    expect(summary.notes).toEqual([
      "Rincian kondisi (4) belum cocok dengan total stok (10). Cek dengan stock opname.",
    ]);
    expect(getUsableStock({ stok: 10, stokRusak: 0 })).toBe(10);
  });
});
