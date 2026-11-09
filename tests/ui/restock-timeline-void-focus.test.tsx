// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { RestockTimeline } from "@/app/admin/inventory/restock/RestockTimeline";
import type {
  PurchaseRecordSummary,
  PurchaseRequest,
} from "@/app/admin/inventory/restock/types";

let container: HTMLDivElement;
let root: Root;

const record: PurchaseRecordSummary = {
  id: "rec-1",
  storeName: "Toko Sinar",
  supplierId: null,
  purchasedAt: "2026-11-08T05:00:00.000Z",
  createdAt: "2026-11-08T06:00:00.000Z",
  recordedBy: { name: "Sari" },
  buyerName: null,
  source: "ADMIN",
  hasSignature: false,
  notes: null,
  fotoNota: [],
  items: [
    {
      id: "ri-1",
      purchaseOrderItemId: "poi-1",
      barangId: "barang-1",
      nama: "Kabel Fiber",
      satuan: "roll",
      quantity: 3,
      unitPrice: null,
    },
  ],
};

function makeRequest(purchaseRecord: PurchaseRecordSummary): PurchaseRequest {
  return {
    id: "pr-1",
    nomorRequest: "PR-001",
    status: "ORDERED",
    createdAt: "2026-11-01T00:00:00.000Z",
    requester: { name: "Budi" },
    gudangId: "g-1",
    gudang: { id: "g-1", nama: "Gudang Utama" },
    purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "ORDERED" },
    purchaseRecords: [purchaseRecord],
    items: [
      {
        id: "item-1",
        barangId: "barang-1",
        jumlah: 10,
        receivedQuantity: 0,
        purchaseOrderItemId: "poi-1",
        purchasedQuantity: 0,
        barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
      },
    ],
  };
}

const voidedRecord: PurchaseRecordSummary = {
  ...record,
  voidedAt: "2026-11-09T02:00:00.000Z",
  voidedBy: { name: "Sari" },
  voidReason: "Salah toko",
};

async function renderTimeline(purchaseRecord: PurchaseRecordSummary) {
  await act(async () => {
    root.render(
      <RestockTimeline
        request={makeRequest(purchaseRecord)}
        renderPurchaseVoidAction={() => (
          <button type="button">Batalkan catatan belanja</button>
        )}
      />,
    );
  });
}

function voidNotice(): HTMLElement | null {
  return (
    Array.from(container.querySelectorAll<HTMLElement>("p")).find((element) =>
      element.textContent?.startsWith("Dibatalkan"),
    ) ?? null
  );
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("RestockTimeline — fokus setelah catatan dibatalkan", () => {
  it("tombol pemicu hilang: fokus pindah ke keterangan Dibatalkan", async () => {
    await renderTimeline(record);
    container.querySelector("button")?.focus();

    await renderTimeline(voidedRecord);

    expect(container.querySelector("button")).toBeNull();
    expect(document.activeElement).toBe(voidNotice());
  });

  it("tidak merebut fokus yang sudah pindah ke tempat lain", async () => {
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    await renderTimeline(record);
    outside.focus();

    await renderTimeline(voidedRecord);

    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it("catatan yang sudah batal sejak awal tidak mengambil fokus", async () => {
    await renderTimeline(voidedRecord);

    expect(document.activeElement).toBe(document.body);
  });
});
