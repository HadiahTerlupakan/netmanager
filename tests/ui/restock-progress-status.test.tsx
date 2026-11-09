import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RestockProgressStatus } from "@/app/admin/inventory/restock/RestockStatusBadge";
import type { PurchaseRequest } from "@/app/admin/inventory/restock/types";

const request: PurchaseRequest = {
  id: "pr-1",
  nomorRequest: "PR-001",
  status: "ORDERED",
  createdAt: "2026-11-01T00:00:00.000Z",
  requester: { name: "Budi" },
  gudangId: "gudang-a",
  gudang: { id: "gudang-a", nama: "Gudang Utama" },
  purchaseOrder: { id: "po-1", status: "DRAFT" },
  items: [
    {
      id: "item-1",
      barangId: "barang-1",
      jumlah: 10,
      receivedQuantity: 0,
      purchaseOrderItemId: "poi-1",
      barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
    },
  ],
};

describe("RestockProgressStatus", () => {
  it("menulis tahap di atas badge status", () => {
    const markup = renderToStaticMarkup(
      <RestockProgressStatus request={request} />,
    );

    expect(markup).toContain("Tahap 3 dari 4: Pembelian");
    expect(markup.indexOf("Tahap 3 dari 4: Pembelian")).toBeLessThan(
      markup.indexOf("Belum Dibeli"),
    );
    expect(markup).toContain(
      "Tahap pembelian: menunggu laporan belanja dari link.",
    );
  });

  it("tidak menulis tahap untuk pengajuan yang dibatalkan", () => {
    const markup = renderToStaticMarkup(
      <RestockProgressStatus request={{ ...request, status: "CANCELLED" }} />,
    );

    expect(markup).not.toContain("Tahap");
    expect(markup).toContain("Dibatalkan");
  });
});
