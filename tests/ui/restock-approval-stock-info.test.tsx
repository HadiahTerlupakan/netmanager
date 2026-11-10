import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { RestockApprovalStockInfo } from "@/app/admin/inventory/restock/RestockApprovalStockInfo";
import type { RestockApprovalStockState } from "@/app/admin/inventory/restock/useRestockApprovalStock";

const ready: RestockApprovalStockState = {
  status: "ready",
  gudangName: "Gudang A",
  fetchedAt: "2026-11-11T03:00:00.000Z",
  byBarangId: new Map([
    [
      "barang-1",
      {
        barangId: "barang-1",
        stok: 2,
        stokBaru: 1,
        stokBekas: 1,
        stokRusak: 0,
        minStok: 5,
      },
    ],
  ]),
  retry: vi.fn(),
};

function render(stock: RestockApprovalStockState, barangId = "barang-1") {
  return renderToStaticMarkup(
    <RestockApprovalStockInfo
      stock={stock}
      barangId={barangId}
      quantity={4}
      satuan="roll"
    />,
  );
}

describe("RestockApprovalStockInfo", () => {
  it("menampilkan stok, kondisi, kesimpulan, dan catatan minimum", () => {
    const markup = render(ready);

    expect(markup).toContain("Stok di gudang ini: 2 roll");
    expect(markup).toContain("Baru 1 · Bekas 1 · Rusak 0");
    expect(markup).toContain(
      "Stok yang bisa dipakai (2 roll) kurang 2 roll dari yang diajukan.",
    );
    expect(markup).toContain("Di bawah stok minimum gudang ini (5 roll).");
    expect(markup).toContain("bg-amber-50");
  });

  it("barang yang tidak tercatat di gudang: habis, berwarna merah", () => {
    const markup = render(ready, "barang-lain");

    expect(markup).toContain("Stok habis di gudang ini.");
    expect(markup).toContain("bg-rose-50");
  });

  it("memuat dan gagal punya teks yang jelas; gagal bisa dicoba lagi", () => {
    expect(render({ status: "loading" })).toContain("Memuat stok gudang…");
    const failed = render({
      status: "error",
      message: "Stok gudang belum bisa dimuat.",
      retry: vi.fn(),
    });
    expect(failed).toContain("Stok gudang belum bisa dimuat.");
    expect(failed).toContain("Coba lagi");
    expect(render({ status: "idle" })).toBe("");
  });
});
