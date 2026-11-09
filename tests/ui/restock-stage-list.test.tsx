import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  getRestockStageState,
  RestockStageList,
} from "@/app/admin/inventory/restock/RestockStageList";
import {
  getRestockProgress,
  type RestockStageNumber,
} from "@/app/admin/inventory/restock/restockProgress";
import type {
  PurchaseRequest,
  PurchaseRequestItem,
} from "@/app/admin/inventory/restock/types";

const STAGES: RestockStageNumber[] = [1, 2, 3, 4];

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
    barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
    ...overrides,
  };
}

function makeRequest(
  overrides: Partial<PurchaseRequest> = {},
): PurchaseRequest {
  return {
    id: "pr-1",
    nomorRequest: "PR-001",
    status: "ORDERED",
    createdAt: "2026-11-01T00:00:00.000Z",
    approvedAt: "2026-11-02T00:00:00.000Z",
    requester: { name: "Budi" },
    gudangId: "gudang-a",
    gudang: { id: "gudang-a", nama: "Gudang Utama" },
    purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "DRAFT" },
    items: [makeItem()],
    ...overrides,
  };
}

function statesOf(request: PurchaseRequest) {
  const progress = getRestockProgress(request);
  return STAGES.map((stage) => getRestockStageState(stage, progress));
}

describe("RestockStageList", () => {
  it("pengajuan ditolak berhenti di tahap Persetujuan, bukan sedang berjalan", () => {
    const request = makeRequest({ status: "REJECTED", purchaseOrder: null });
    expect(statesOf(request)).toEqual([
      "done",
      "stopped",
      "pending",
      "pending",
    ]);

    const markup = renderToStaticMarkup(
      <RestockStageList progress={getRestockProgress(request)} />,
    );
    expect(markup).not.toContain('aria-current="step"');
    expect(markup).not.toContain("sedang berjalan");
    expect(markup).toContain("berhenti di sini, ditolak");
  });

  it("pengajuan yang disetujui lalu dibatalkan menandai tahap yang sudah dilalui", () => {
    expect(statesOf(makeRequest({ status: "CANCELLED" }))).toEqual([
      "done",
      "done",
      "stopped",
      "pending",
    ]);
  });

  it("barang yang sudah dibeli mulai datang: pembelian dan verifikasi sama-sama berjalan", () => {
    const request = makeRequest({
      purchaseOrder: { id: "po-1", status: "PARTIAL" },
      items: [makeItem({ purchasedQuantity: 6, receivedQuantity: 2 })],
    });
    expect(statesOf(request)).toEqual(["done", "done", "current", "current"]);

    const markup = renderToStaticMarkup(
      <RestockStageList progress={getRestockProgress(request)} />,
    );
    // Hanya tahap utama yang ditandai langkah aktif.
    expect(markup.match(/aria-current="step"/g)).toHaveLength(1);
  });

  it("tahap pembelian biasa: verifikasi belum", () => {
    expect(statesOf(makeRequest())).toEqual([
      "done",
      "done",
      "current",
      "pending",
    ]);
  });

  it("selesai: semua tahap selesai", () => {
    expect(
      statesOf(
        makeRequest({
          status: "RECEIVED",
          purchaseOrder: { id: "po-1", status: "RECEIVED" },
          items: [makeItem({ purchasedQuantity: 10, receivedQuantity: 10 })],
        }),
      ),
    ).toEqual(["done", "done", "done", "done"]);
  });
});
