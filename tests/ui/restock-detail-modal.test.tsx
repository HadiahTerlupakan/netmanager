import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type {
  PurchaseRecordSummary,
  PurchaseRequest,
} from "@/app/admin/inventory/restock/types";

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
  }) => (isOpen ? <div>{children}</div> : null),
}));

import { RestockDetailModal } from "@/app/admin/inventory/restock/RestockDetailModal";

const request: PurchaseRequest = {
  id: "pr-1",
  nomorRequest: "PR-001",
  status: "RECEIVED",
  createdAt: "2026-11-01T00:00:00.000Z",
  requester: { name: "Rohadim" },
  approver: { name: "Manajer Gudang" },
  catatanApproval: "Disetujui sebagian",
  gudangId: "gudang-a",
  gudang: { id: "gudang-a", nama: "Gudang A" },
  items: [
    {
      id: "item-1",
      barangId: "barang-3",
      jumlah: 8,
      jumlahDiminta: 10,
      receivedQuantity: 8,
      statusApproval: "APPROVED",
      catatanApproval: "Pakai dropcore",
      barangIdDiminta: "barang-1",
      barangDiminta: {
        id: "barang-1",
        nama: "Kabel Fiber",
        kode: "BRG-1",
        satuan: "roll",
      },
      barang: { nama: "Kabel Dropcore", kode: "BRG-3", satuan: "roll" },
    },
    {
      id: "item-2",
      barangId: "barang-2",
      jumlah: 5,
      receivedQuantity: 0,
      statusApproval: "REJECTED",
      catatanApproval: "Stok masih ada",
      barang: { nama: "Konektor SC", kode: "BRG-2", satuan: "pcs" },
    },
  ],
};

describe("RestockDetailModal approval details", () => {
  it("shows the approver and the overall decision note", () => {
    const markup = renderToStaticMarkup(
      <RestockDetailModal request={request} onClose={vi.fn()} />,
    );

    expect(markup).toContain("Manajer Gudang");
    expect(markup).toContain("Disetujui sebagian");
  });

  it("shows requested vs approved quantity and the substituted barang", () => {
    const markup = renderToStaticMarkup(
      <RestockDetailModal request={request} onClose={vi.fn()} />,
    );

    expect(markup).toContain("Diganti dari Kabel Fiber");
    expect(markup).toContain("Diajukan 10 roll, disetujui 8 roll");
    expect(markup).toContain("Catatan atasan: Pakai dropcore");
  });

  it("labels the requested quantity with the unit of the barang originally asked for", () => {
    const substitutedAcrossUnits: PurchaseRequest = {
      ...request,
      items: [
        {
          ...request.items[0],
          jumlah: 50,
          jumlahDiminta: 5,
          barang: { nama: "Kabel Meteran", kode: "BRG-9", satuan: "meter" },
        },
      ],
    };

    const markup = renderToStaticMarkup(
      <RestockDetailModal request={substitutedAcrossUnits} onClose={vi.fn()} />,
    );

    expect(markup).toContain("Diajukan 5 roll, disetujui 50 meter");
  });

  it("marks rejected lines as Ditolak instead of Tidak Dikirim", () => {
    const markup = renderToStaticMarkup(
      <RestockDetailModal request={request} onClose={vi.fn()} />,
    );

    expect(markup).toContain("Ditolak");
    expect(markup).toContain("Catatan atasan: Stok masih ada");
    expect(markup).not.toContain("Tidak Dikirim");
  });
});

describe("RestockDetailModal order journey", () => {
  const ordered: PurchaseRequest = {
    ...request,
    status: "ORDERED",
    approvedAt: "2026-11-02T03:00:00.000Z",
    purchaseOrder: {
      id: "po-1",
      poNumber: "PO-2026-009",
      status: "PARTIAL",
      issuedAt: "2026-11-03T03:00:00.000Z",
      processedBy: { name: "Sari" },
    },
    goodsReceipts: [
      {
        id: "grn-2",
        grnNumber: "GRN-2",
        fotoBukti: [],
        receivedAt: "2026-11-06T07:20:00.000Z",
        receivedBy: { name: "Budi" },
        items: [
          {
            barangId: "barang-3",
            nama: "Kabel Dropcore",
            satuan: "roll",
            quantity: 2,
          },
        ],
      },
      {
        id: "grn-1",
        grnNumber: "GRN-1",
        fotoBukti: ["https://example.test/a.jpg"],
        receivedAt: "2026-11-05T07:20:00.000Z",
        receivedBy: { name: "Budi" },
        items: [
          {
            barangId: "barang-3",
            nama: "Kabel Dropcore",
            satuan: "roll",
            quantity: 4,
          },
        ],
      },
    ],
    items: [
      {
        ...request.items[0],
        orderedQuantity: 8,
        receivedQuantity: 6,
        cancelledQuantity: 1,
        cancelReason: "Barang habis di toko",
      },
      request.items[1],
    ],
  };

  function renderDetail(
    target: PurchaseRequest,
    props: Partial<React.ComponentProps<typeof RestockDetailModal>> = {},
  ) {
    return renderToStaticMarkup(
      <RestockDetailModal request={target} onClose={vi.fn()} {...props} />,
    );
  }

  it("shows each step with who and when, oldest delivery first", () => {
    const markup = renderDetail(ordered);

    expect(markup).toContain("Diajukan");
    expect(markup).toContain("Disetujui 2 Nov 2026 · Manajer Gudang");
    // Ditandai dibeli (3 Nov) sebelum kiriman pertama (5 Nov): data lama,
    // statusnya tetap "sudah dibeli semua", tidak mundur saat barang datang.
    expect(markup).toContain(
      "Sudah dibeli semua 3 Nov 2026 (dicatat sekaligus)",
    );
    expect(markup).not.toContain("Masih ada barang yang belum dibeli");
    expect(markup.indexOf("dicatat sekaligus")).toBeLessThan(
      markup.indexOf("Kiriman ke-1"),
    );
    expect(markup.indexOf("Kiriman ke-1")).toBeLessThan(
      markup.indexOf("Kiriman ke-2"),
    );
    expect(markup).toContain("dicatat Budi");
    expect(markup).toContain("Kabel Dropcore 4 roll (1 foto)");
    expect(markup).toContain("No. catatan: GRN-1");
    expect(markup).toContain("Belum selesai");
    expect(markup).toContain(
      "Sekarang: Kabel Dropcore datang 6 dari 8 roll. Tidak jadi datang 1 roll. Masih ditunggu 1 roll.",
    );
    expect(markup).toContain("Kode pesanan: PO-2026-009");
    expect(markup).toContain("Keputusan Atasan");
  });

  it("lists ordered, arrived and awaited quantities with the shortfall reason", () => {
    const markup = renderDetail(ordered);

    expect(markup).toContain("Masih ditunggu");
    expect(markup).toContain(
      "Tidak jadi datang 1 roll. Alasan: Barang habis di toko",
    );
    expect(markup).not.toContain("Dianulir");
  });

  const legacyBought: PurchaseRequest = {
    ...ordered,
    purchaseOrder: { ...ordered.purchaseOrder, status: "ORDERED" },
    goodsReceipts: [],
    items: [{ ...ordered.items[0], receivedQuantity: 0, cancelledQuantity: 0 }],
  };

  it("marks legacy orders bought at once, with or without a date", () => {
    expect(renderDetail(legacyBought)).toContain(
      "Sudah dibeli semua 3 Nov 2026 (dicatat sekaligus) · Sari",
    );
    const undated = renderDetail({
      ...legacyBought,
      purchaseOrder: {
        ...legacyBought.purchaseOrder,
        issuedAt: null,
        processedBy: null,
      },
    });
    expect(undated).toContain("Sudah dibeli semua (tanggal tidak tercatat)");
    expect(undated).not.toContain("Catat Belanja");
  });

  it("lists each purchase with store, who and contents, plus per-store totals", () => {
    const markup = renderDetail(
      {
        ...legacyBought,
        items: [
          {
            ...legacyBought.items[0],
            purchaseOrderItemId: "poi-1",
            purchasedQuantity: 5,
          },
        ],
        purchaseRecords: [
          {
            id: "rec-2",
            storeName: "Toko B",
            supplierId: null,
            purchasedAt: "2026-11-04T05:00:00.000Z",
            createdAt: "2026-11-04T06:00:00.000Z",
            recordedBy: { name: "Sari" },
            buyerName: null,
            source: "ADMIN",
            hasSignature: false,
            notes: "Bayar tunai",
            fotoNota: ["https://example.test/nota.jpg"],
            items: [
              {
                id: "ri-2",
                purchaseOrderItemId: "poi-1",
                barangId: "barang-3",
                nama: "Kabel Dropcore",
                satuan: "roll",
                quantity: 2,
                unitPrice: null,
              },
            ],
          },
          {
            id: "rec-1",
            storeName: "Toko A",
            supplierId: null,
            purchasedAt: "2026-11-03T05:00:00.000Z",
            createdAt: "2026-11-03T06:00:00.000Z",
            recordedBy: { name: "Budi" },
            buyerName: null,
            source: "ADMIN",
            hasSignature: false,
            notes: null,
            fotoNota: [],
            items: [
              {
                id: "ri-1",
                purchaseOrderItemId: "poi-1",
                barangId: "barang-3",
                nama: "Kabel Dropcore",
                satuan: "roll",
                quantity: 3,
                unitPrice: 12000,
              },
            ],
          },
        ],
      },
      { canVerify: true, onOpenReceive: vi.fn() },
    );

    expect(markup.indexOf("Belanja ke-1 · 3 Nov 2026 · Toko A")).toBeLessThan(
      markup.indexOf("Belanja ke-2 · 4 Nov 2026 · Toko B · dibeli Sari"),
    );
    expect(markup).toContain("Kabel Dropcore 3 roll @ Rp12.000");
    expect(markup).toContain("Kabel Dropcore 2 roll (1 foto)");
    expect(markup).toContain("Catatan: Bayar tunai");
    expect(markup).toContain("Dibeli 5 dari 8 roll (Toko A 3, Toko B 2)");
    expect(markup).toContain("Masih ada barang yang belum dibeli");
    expect(markup).not.toContain("Catat Belanja");
    expect(markup).toContain("Dibeli Sebagian");
  });

  it("points to the shopping link instead of recording a purchase", () => {
    const markup = renderDetail(
      {
        ...ordered,
        purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "DRAFT" },
        goodsReceipts: [],
        items: [
          {
            ...ordered.items[0],
            receivedQuantity: 0,
            cancelledQuantity: 0,
            purchaseOrderItemId: "poi-1",
          },
        ],
      },
      {
        canVerify: true,
        onOpenReceive: vi.fn(),
        onOpenCloseUnpurchased: vi.fn(),
      },
    );

    expect(markup).toContain(
      "Tahap pembelian: menunggu laporan belanja dari link. Barang baru bisa dicatat datang setelah dilaporkan dibeli. Kirim link belanja ke orang yang belanja.",
    );
    expect(markup).toContain("Link belanja");
    expect(markup).not.toContain("Catat Belanja");
    // Belum ada yang dilaporkan dibeli: belum bisa dicatat datang.
    expect(markup).not.toContain("Catat Barang Datang");
    // Pembelian tidak macet: sisa yang tidak jadi dibeli bisa ditutup.
    expect(markup).toContain(
      'aria-label="Tutup sisa yang tidak jadi dibeli untuk PR-001"',
    );
  });

  it("shows the four stages with the purchase stage as the current one", () => {
    const markup = renderDetail(
      {
        ...ordered,
        purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "DRAFT" },
        goodsReceipts: [],
        items: [
          {
            ...ordered.items[0],
            receivedQuantity: 0,
            cancelledQuantity: 0,
            purchaseOrderItemId: "poi-1",
          },
        ],
      },
      { canVerify: true },
    );

    expect(markup).toContain('aria-label="Tahap pengajuan"');
    const current = markup.match(/<li aria-current="step"[^>]*>.*?<\/li>/)?.[0];
    expect(current).toContain("Pembelian");
    expect(markup).toContain('Pengajuan<span class="sr-only">, selesai</span>');
    expect(markup).toContain(
      'Verifikasi barang sampai<span class="sr-only">, belum</span>',
    );
    // Garis waktu dikelompokkan per tahap.
    for (const heading of [
      "1 Pengajuan",
      "2 Persetujuan",
      "3 Pembelian",
      "4 Verifikasi barang sampai",
    ]) {
      expect(markup).toContain(heading);
    }
    // Kalimat keadaan sekarang hanya tampil sekali.
    expect(markup.split("Sekarang:").length).toBe(2);
  });

  it("hides closing the unbought remainder on merged and legacy orders", () => {
    const base: PurchaseRequest = {
      ...ordered,
      goodsReceipts: [],
      items: [
        {
          ...ordered.items[0],
          receivedQuantity: 0,
          cancelledQuantity: 0,
          purchaseOrderItemId: "poi-1",
        },
      ],
    };
    const merged = renderDetail(
      {
        ...base,
        purchaseOrder: {
          id: "po-1",
          status: "DRAFT",
          _count: { purchaseRequests: 2 },
        },
      },
      { canVerify: true, onOpenCloseUnpurchased: vi.fn() },
    );
    const legacy = renderDetail(
      {
        ...base,
        purchaseOrder: {
          id: "po-1",
          status: "ORDERED",
          issuedAt: "2026-11-03T03:00:00.000Z",
        },
      },
      { canVerify: true, onOpenCloseUnpurchased: vi.fn() },
    );

    expect(merged).not.toContain("Tutup sisa yang tidak jadi dibeli");
    expect(legacy).not.toContain("Tutup sisa yang tidak jadi dibeli");
  });

  it("does not tell read-only viewers to send a shopping link", () => {
    const notBought: PurchaseRequest = {
      ...ordered,
      purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "DRAFT" },
      goodsReceipts: [],
      items: [
        {
          ...ordered.items[0],
          receivedQuantity: 0,
          cancelledQuantity: 0,
          purchaseOrderItemId: "poi-1",
        },
      ],
    };

    const markup = renderDetail(notBought, { canVerify: false });

    expect(markup).toContain(
      "Tahap pembelian: menunggu laporan belanja dari link.",
    );
    expect(markup).not.toContain("Kirim link belanja");
    expect(markup).not.toContain("Tutup sisa yang tidak jadi dibeli");
  });

  it("groups purchases under stage 3 and deliveries under stage 4", () => {
    const purchaseLine = {
      id: "ri-1",
      purchaseOrderItemId: "poi-1",
      barangId: "barang-3",
      nama: "Kabel Dropcore",
      satuan: "roll",
      quantity: 2,
      unitPrice: null as number | null,
    };
    const markup = renderDetail(
      {
        ...ordered,
        purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "PARTIAL" },
        goodsReceipts: [
          {
            id: "grn-1",
            grnNumber: "GRN-1",
            fotoBukti: [],
            // Pagi hari yang sama dengan belanja di Toko B: belanja tetap
            // tampil lebih dulu karena barang dibeli sebelum datang.
            receivedAt: "2026-11-04T01:00:00.000Z",
            receivedBy: { name: "Budi" },
            items: [],
          },
        ],
        purchaseRecords: [
          {
            id: "rec-2",
            storeName: "Toko B",
            supplierId: null,
            purchasedAt: "2026-11-06T05:00:00.000Z",
            createdAt: "2026-11-06T06:00:00.000Z",
            recordedBy: { name: "Sari" },
            buyerName: null,
            source: "ADMIN",
            hasSignature: false,
            notes: null,
            fotoNota: [],
            items: [{ ...purchaseLine, id: "ri-2" }],
          },
          {
            id: "rec-1",
            storeName: "Toko A",
            supplierId: null,
            purchasedAt: "2026-11-04T05:00:00.000Z",
            createdAt: "2026-11-04T06:00:00.000Z",
            recordedBy: { name: "Sari" },
            buyerName: null,
            source: "ADMIN",
            hasSignature: false,
            notes: null,
            fotoNota: [],
            items: [purchaseLine],
          },
        ],
        items: [
          {
            ...ordered.items[0],
            orderedQuantity: 8,
            receivedQuantity: 2,
            cancelledQuantity: 0,
            purchasedQuantity: 4,
            purchaseOrderItemId: "poi-1",
          },
        ],
      },
      { canVerify: true, onOpenReceive: vi.fn() },
    );

    const purchaseStage = markup.indexOf("3 Pembelian");
    const storeA = markup.indexOf("Belanja ke-1 · 4 Nov 2026 · Toko A");
    const storeB = markup.indexOf("Belanja ke-2 · 6 Nov 2026 · Toko B");
    const openStep = markup.indexOf("Masih ada barang yang belum dibeli");
    const receiptStage = markup.indexOf("4 Verifikasi barang sampai");
    const delivery = markup.indexOf("Kiriman ke-1");
    expect(purchaseStage).toBeGreaterThan(-1);
    expect(purchaseStage).toBeLessThan(storeA);
    expect(storeA).toBeLessThan(storeB);
    expect(storeB).toBeLessThan(openStep);
    expect(openStep).toBeLessThan(receiptStage);
    expect(receiptStage).toBeLessThan(delivery);
    expect(delivery).toBeLessThan(markup.indexOf("Belum selesai"));
  });

  it("keeps the shopping link as the main action while receiving is second", () => {
    const markup = renderDetail(
      {
        ...ordered,
        purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "ORDERED" },
        goodsReceipts: [],
        items: [
          {
            ...ordered.items[0],
            receivedQuantity: 0,
            cancelledQuantity: 0,
            purchasedQuantity: 3,
            purchaseOrderItemId: "poi-1",
          },
        ],
      },
      { canVerify: true, onOpenReceive: vi.fn() },
    );

    const receiveButton = markup.match(
      /<button[^>]*aria-label="Catat Barang Datang untuk PR-001"[^>]*>/,
    )?.[0];
    expect(receiveButton).toBeDefined();
    expect(receiveButton).toContain("border-indigo-300");
    expect(receiveButton).not.toContain("bg-indigo-700");
  });

  it("offers the next delivery for a partial order", () => {
    const markup = renderDetail(ordered, {
      canVerify: true,
      onOpenReceive: vi.fn(),
    });

    expect(markup).toContain("Catat Kiriman Berikutnya");
    expect(markup).not.toContain("Catat Belanja");
  });

  it("ends the journey as finished short", () => {
    const markup = renderDetail({ ...ordered, status: "RECEIVED" });

    expect(markup).toContain("Selesai, kurang");
    expect(markup).toContain("Selesai, Kurang");
  });
  it("shows the purchase link panel only to verifiers on an approved request", () => {
    const ordered: PurchaseRequest = { ...request, status: "ORDERED" };
    const forVerifier = renderToStaticMarkup(
      <RestockDetailModal request={ordered} onClose={vi.fn()} canVerify />,
    );
    const forViewer = renderToStaticMarkup(
      <RestockDetailModal request={ordered} onClose={vi.fn()} />,
    );
    const forFinished = renderToStaticMarkup(
      <RestockDetailModal request={request} onClose={vi.fn()} canVerify />,
    );

    expect(forVerifier).toContain("Link belanja");
    expect(forViewer).not.toContain("Link belanja");
    expect(forFinished).not.toContain("Link belanja");
  });

  it("shows the void action on purchase records only to verifiers while the order is open", () => {
    const record: PurchaseRecordSummary = {
      id: "rec-1",
      storeName: "Toko A",
      supplierId: null,
      purchasedAt: "2026-11-08T05:00:00.000Z",
      createdAt: "2026-11-08T06:00:00.000Z",
      recordedBy: { name: "Sari" },
      buyerName: "Andi",
      source: "PUBLIC_LINK",
      hasSignature: false,
      notes: null,
      fotoNota: [],
      items: [],
    };
    const ordered: PurchaseRequest = {
      ...request,
      status: "ORDERED",
      purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "ORDERED" },
      purchaseRecords: [record],
    };
    const closed: PurchaseRequest = {
      ...ordered,
      purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "RECEIVED" },
    };
    const onPurchaseVoided = vi.fn().mockResolvedValue(undefined);

    const forVerifier = renderToStaticMarkup(
      <RestockDetailModal
        request={ordered}
        onClose={vi.fn()}
        canVerify
        onPurchaseVoided={onPurchaseVoided}
      />,
    );
    const forViewer = renderToStaticMarkup(
      <RestockDetailModal
        request={ordered}
        onClose={vi.fn()}
        onPurchaseVoided={onPurchaseVoided}
      />,
    );
    const forClosedOrder = renderToStaticMarkup(
      <RestockDetailModal
        request={closed}
        onClose={vi.fn()}
        canVerify
        onPurchaseVoided={onPurchaseVoided}
      />,
    );

    expect(forVerifier).toContain("Batalkan catatan belanja");
    expect(forViewer).not.toContain("Batalkan catatan belanja");
    expect(forClosedOrder).not.toContain("Batalkan catatan belanja");
  });

  it("replaces the void action once the purchased goods have arrived", () => {
    const record: PurchaseRecordSummary = {
      id: "rec-1",
      storeName: "Toko A",
      supplierId: null,
      purchasedAt: "2026-11-08T05:00:00.000Z",
      createdAt: "2026-11-08T06:00:00.000Z",
      recordedBy: { name: "Sari" },
      buyerName: "Andi",
      source: "PUBLIC_LINK",
      hasSignature: false,
      notes: null,
      fotoNota: [],
      items: [
        {
          id: "ri-1",
          purchaseOrderItemId: "poi-1",
          barangId: request.items[0].barangId,
          nama: "Kabel",
          satuan: "roll",
          quantity: 3,
          unitPrice: null,
        },
      ],
    };
    const arrived: PurchaseRequest = {
      ...request,
      status: "ORDERED",
      purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "PARTIAL" },
      purchaseRecords: [record],
      items: [
        {
          ...request.items[0],
          purchaseOrderItemId: "poi-1",
          purchasedQuantity: 3,
          receivedQuantity: 2,
          cancelledQuantity: 0,
        },
      ],
    };

    const markup = renderToStaticMarkup(
      <RestockDetailModal
        request={arrived}
        onClose={vi.fn()}
        canVerify
        onPurchaseVoided={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(markup).not.toContain("Batalkan catatan belanja");
    expect(markup).toContain(
      "Tidak bisa dibatalkan: barangnya sudah dicatat datang.",
    );
  });
});
