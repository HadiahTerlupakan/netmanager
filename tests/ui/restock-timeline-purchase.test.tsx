import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RestockTimeline } from "@/app/admin/inventory/restock/RestockTimeline";
import type {
  PurchaseRecordSummary,
  PurchaseRequest,
} from "@/app/admin/inventory/restock/types";

function makeRecord(
  overrides: Partial<PurchaseRecordSummary> = {},
): PurchaseRecordSummary {
  return {
    id: "rec-1",
    storeName: "Toko Sinar Jaya",
    supplierId: null,
    purchasedAt: "2026-11-08T05:00:00.000Z",
    createdAt: "2026-11-08T06:00:00.000Z",
    recordedBy: { name: "Admin Pembuat Link" },
    buyerName: "Andi",
    source: "PUBLIC_LINK",
    hasSignature: true,
    notes: null,
    fotoNota: [],
    items: [
      {
        id: "line-1",
        purchaseOrderItemId: "poi-1",
        barangId: "barang-1",
        nama: "Kabel Fiber",
        satuan: "roll",
        quantity: 4,
        unitPrice: null,
      },
    ],
    ...overrides,
  };
}

function makeRequest(records: PurchaseRecordSummary[]): PurchaseRequest {
  return {
    id: "pr-1",
    nomorRequest: "PR-001",
    status: "ORDERED",
    createdAt: "2026-11-01T00:00:00.000Z",
    requester: { name: "Rohadim" },
    gudangId: "g-1",
    gudang: { id: "g-1", nama: "Gudang Utama" },
    purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "ORDERED" },
    purchaseRecords: records,
    items: [
      {
        id: "item-1",
        barangId: "barang-1",
        jumlah: 10,
        receivedQuantity: 0,
        purchaseOrderItemId: "poi-1",
        purchasedQuantity: 4,
        barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
      },
    ],
  };
}

describe("RestockTimeline purchase records", () => {
  it("menampilkan nama pembeli, label lewat link, dan tanda tangan dari route ber-auth", () => {
    const markup = renderToStaticMarkup(
      <RestockTimeline request={makeRequest([makeRecord()])} />,
    );

    expect(markup).toContain("dibeli Andi");
    expect(markup).not.toContain("Admin Pembuat Link");
    expect(markup).toContain("lewat link");
    expect(markup).toContain(
      'src="/api/inventory/restock/requests/pr-1/purchases/rec-1/signature"',
    );
    expect(markup).toContain('alt="Tanda tangan Andi"');
    expect(markup).toContain('loading="lazy"');
  });

  it("memakai nama pencatat bila nama pembeli kosong, tanpa label dan tanda tangan", () => {
    const markup = renderToStaticMarkup(
      <RestockTimeline
        request={makeRequest([
          makeRecord({
            buyerName: null,
            source: "ADMIN",
            hasSignature: false,
            recordedBy: { name: "Siti" },
          }),
        ])}
      />,
    );

    expect(markup).toContain("dibeli Siti");
    expect(markup).not.toContain("lewat link");
    expect(markup).not.toContain("/signature");
  });

  it("catatan yang dibatalkan tampil dengan tanda, siapa, dan alasannya; tanpa tombol batal", () => {
    const voided = makeRecord({
      id: "rec-2",
      voidedAt: "2026-11-09T02:00:00.000Z",
      voidedBy: { name: "Sari" },
      voidReason: "Bukan belanja kita",
    });
    const markup = renderToStaticMarkup(
      <RestockTimeline
        request={makeRequest([makeRecord(), voided])}
        renderPurchaseVoidAction={(record) => (
          <span>{`aksi-batal-${record.id}`}</span>
        )}
      />,
    );

    expect(markup).toContain("dibatalkan");
    expect(markup).toContain("Dibatalkan oleh Sari: Bukan belanja kita");
    expect(markup).toContain("line-through");
    expect(markup).toContain("aksi-batal-rec-1");
    expect(markup).not.toContain("aksi-batal-rec-2");
  });

  it("tanpa izin membatalkan tidak ada tombol batal", () => {
    const markup = renderToStaticMarkup(
      <RestockTimeline request={makeRequest([makeRecord()])} />,
    );

    expect(markup).not.toContain("Batalkan catatan belanja");
  });
});
