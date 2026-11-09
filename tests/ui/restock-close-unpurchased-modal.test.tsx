import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PurchaseRequest } from "@/app/admin/inventory/restock/types";

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

import { RestockCloseUnpurchasedModal } from "@/app/admin/inventory/restock/RestockCloseUnpurchasedModal";
import {
  buildCloseUnpurchasedPayload,
  getCloseUnpurchasedSuccessMessage,
  getRestockUnpurchasedLines,
  predictCloseUnpurchasedOutcome,
} from "@/app/admin/inventory/restock/restockCloseUnpurchased";
import type { RestockCloseUnpurchasedState } from "@/app/admin/inventory/restock/useRestockCloseUnpurchased";

const request: PurchaseRequest = {
  id: "pr-1",
  nomorRequest: "PR-001",
  status: "ORDERED",
  createdAt: "2026-11-01T00:00:00.000Z",
  requester: { name: "Budi" },
  gudangId: "gudang-a",
  gudang: { id: "gudang-a", nama: "Gudang Utama" },
  purchaseOrder: { id: "po-1", status: "ORDERED" },
  items: [
    {
      id: "item-1",
      barangId: "barang-1",
      jumlah: 10,
      orderedQuantity: 10,
      receivedQuantity: 0,
      cancelledQuantity: 0,
      purchaseOrderItemId: "poi-1",
      purchasedQuantity: 4,
      barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
    },
    {
      id: "item-2",
      barangId: "barang-2",
      jumlah: 5,
      orderedQuantity: 5,
      receivedQuantity: 0,
      cancelledQuantity: 0,
      purchaseOrderItemId: "poi-2",
      purchasedQuantity: 5,
      barang: { nama: "ONT", kode: "BRG-2", satuan: "pcs" },
    },
  ],
};

function makeState(
  overrides: Partial<RestockCloseUnpurchasedState> = {},
): RestockCloseUnpurchasedState {
  return {
    request,
    reason: "",
    setReason: vi.fn(),
    isSubmitting: false,
    open: vi.fn(),
    close: vi.fn(),
    submit: vi.fn(),
    ...overrides,
  };
}

describe("RestockCloseUnpurchasedModal", () => {
  it("menampilkan barang yang belum dibeli dan mewajibkan alasan", () => {
    const markup = renderToStaticMarkup(
      <RestockCloseUnpurchasedModal state={makeState()} />,
    );

    expect(markup).toContain("Tutup sisa yang tidak jadi dibeli");
    expect(markup).toContain("Kabel Fiber: 6 roll belum dibeli");
    expect(markup).not.toContain("ONT:");
    expect(markup).toContain("Kenapa tidak jadi dibeli?");
    expect(markup).toContain("Alasannya wajib diisi.");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Tutup sisa/);
    expect(markup).toContain(
      "Barang yang sudah dibeli tetap ditunggu datang. Link belanja pengajuan ini akan dimatikan.",
    );
  });

  it("menjelaskan pembatalan bila belum ada yang dibeli", () => {
    const untouched: PurchaseRequest = {
      ...request,
      purchaseOrder: { id: "po-1", status: "DRAFT" },
      items: request.items.map((item) => ({ ...item, purchasedQuantity: 0 })),
    };
    const markup = renderToStaticMarkup(
      <RestockCloseUnpurchasedModal
        state={makeState({
          request: untouched,
          reason: "Tidak jadi dibutuhkan",
        })}
      />,
    );

    expect(predictCloseUnpurchasedOutcome(untouched)).toBe("CANCEL_REQUEST");
    expect(markup).toContain(
      "Belum ada barang yang dibeli. Kalau disimpan, pengajuan ini dibatalkan.",
    );
    expect(markup).toContain("Batalkan pengajuan");
    expect(markup).not.toMatch(/<button[^>]*disabled=""[^>]*>Batalkan/);
  });

  it("pengajuan tanpa daftar belanja yang berisi jasa ditandai selesai, bukan dibatalkan", () => {
    const withJasa: PurchaseRequest = {
      ...request,
      status: "APPROVED",
      purchaseOrder: null,
      items: request.items.map((item) => ({ ...item, purchasedQuantity: 0 })),
      jasaItems: [
        {
          id: "jasa-line-1",
          jasaId: "jasa-1",
          jumlah: 1,
          statusKonfirmasi: "PENDING",
        } as unknown as NonNullable<PurchaseRequest["jasaItems"]>[number],
      ],
    };
    const markup = renderToStaticMarkup(
      <RestockCloseUnpurchasedModal
        state={makeState({ request: withJasa, reason: "Tidak jadi" })}
      />,
    );

    expect(predictCloseUnpurchasedOutcome(withJasa)).toBe("FINISH_REQUEST");
    expect(markup).toContain(
      "Tidak ada lagi barang yang ditunggu. Kalau disimpan, pengajuan ini ditandai selesai dan link belanjanya dimatikan. Jasa di pengajuan ini tidak ikut ditutup.",
    );
    expect(markup).toContain("Tutup dan tandai selesai");
    expect(markup).not.toContain("Batalkan pengajuan");
  });

  it("pesanan berjasa yang belum ada belanja: semua barang dicoret dan pengajuan selesai", () => {
    const orderWithJasa: PurchaseRequest = {
      ...request,
      purchaseOrder: { id: "po-1", status: "DRAFT", _count: { jasaItems: 1 } },
      items: request.items.map((item) => ({ ...item, purchasedQuantity: 0 })),
    };

    expect(predictCloseUnpurchasedOutcome(orderWithJasa)).toBe(
      "FINISH_REQUEST",
    );
  });

  it("barang yang sudah dibeli dan sudah datang semua: pengajuan selesai", () => {
    const arrived: PurchaseRequest = {
      ...request,
      purchaseOrder: { id: "po-1", status: "PARTIAL" },
      items: request.items.map((item) => ({
        ...item,
        receivedQuantity: item.purchasedQuantity ?? 0,
      })),
    };

    expect(predictCloseUnpurchasedOutcome(arrived)).toBe("FINISH_REQUEST");
  });

  it("pesanan yang sudah dibayar tidak dibatalkan; barang dibeli tetap ditunggu", () => {
    const untouched = request.items.map((item) => ({
      ...item,
      purchasedQuantity: 0,
    }));
    expect(
      predictCloseUnpurchasedOutcome({
        ...request,
        items: untouched,
        purchaseOrder: { id: "po-1", status: "DRAFT", paymentStatus: "PAID" },
      }),
    ).toBe("FINISH_REQUEST");
    expect(predictCloseUnpurchasedOutcome(request)).toBe("KEEP_WAITING");
  });

  it("tidak tampil tanpa pengajuan", () => {
    expect(
      renderToStaticMarkup(
        <RestockCloseUnpurchasedModal state={makeState({ request: null })} />,
      ),
    ).toBe("");
  });
});

describe("aturan tutup sisa yang tidak jadi dibeli", () => {
  it("body permintaan berisi penanda tutup dan alasan yang dirapikan", () => {
    expect(buildCloseUnpurchasedPayload("  Barang habis di toko ")).toEqual({
      items: {},
      closeUnpurchased: true,
      closeReason: "Barang habis di toko",
    });
  });

  it("hanya menghitung sisa yang belum dibeli", () => {
    expect(getRestockUnpurchasedLines(request)).toEqual([
      {
        barangId: "barang-1",
        nama: "Kabel Fiber",
        satuan: "roll",
        quantity: 6,
      },
    ]);
  });

  it("pesan sukses mengikuti status pengajuan", () => {
    expect(getCloseUnpurchasedSuccessMessage("ORDERED")).toBe(
      "Tersimpan. Sisa yang tidak jadi dibeli sudah ditutup.",
    );
    expect(getCloseUnpurchasedSuccessMessage("CANCELLED")).toBe(
      "Pesanan dibatalkan. Tidak ada barang yang masuk gudang.",
    );
  });
});
