import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  RestockProgressStatus,
  RestockStatusBadge,
} from "@/app/admin/inventory/restock/RestockStatusBadge";
import type { PurchaseRequest } from "@/app/admin/inventory/restock/types";

function makeRequest(
  overrides: Partial<PurchaseRequest> = {},
): PurchaseRequest {
  return {
    id: "pr-1",
    nomorRequest: "PR-001",
    status: "APPROVED",
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
        barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
      },
    ],
    ...overrides,
  };
}

describe("RestockStatusBadge", () => {
  it("menampilkan label status dalam satu baris", () => {
    const markup = renderToStaticMarkup(
      <RestockStatusBadge request={makeRequest({ status: "DRAFT" })} />,
    );
    expect(markup).toContain("Menunggu Persetujuan");
    expect(markup).toContain("whitespace-nowrap");
  });
});

describe("RestockProgressStatus", () => {
  it("menulis badge lalu kalimat keadaan, tanpa tahap", () => {
    const markup = renderToStaticMarkup(
      <RestockProgressStatus request={makeRequest()} />,
    );

    expect(markup.indexOf("Disetujui")).toBeLessThan(
      markup.indexOf("Menunggu admin memasukkan barang."),
    );
    expect(markup).not.toContain("Tahap");
  });

  it("menulis alasan pembatalan pada pengajuan yang dibatalkan", () => {
    const markup = renderToStaticMarkup(
      <RestockProgressStatus
        request={makeRequest({
          status: "CANCELLED",
          cancelReason: "Tidak jadi dipakai",
        })}
      />,
    );

    expect(markup).toContain("Dibatalkan");
    expect(markup).toContain(
      "Pengajuan ini dibatalkan. Alasan: Tidak jadi dipakai",
    );
  });

  it("versi tabel: badge dulu, kalimat dipotong 2 baris dengan teks lengkap di title", () => {
    const markup = renderToStaticMarkup(
      <RestockProgressStatus request={makeRequest()} isCompact />,
    );

    expect(markup.indexOf("Disetujui")).toBeLessThan(
      markup.indexOf("Menunggu admin memasukkan barang."),
    );
    expect(markup).toContain("whitespace-nowrap");
    expect(markup).toContain("line-clamp-2");
    expect(markup).toContain('title="Menunggu admin memasukkan barang."');
  });
});
