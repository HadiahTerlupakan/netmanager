// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/inventory/PhotoUpload", () => ({
  PhotoUpload: () => <div>Photo upload</div>,
}));

import { RestockReceiveModal } from "@/app/admin/inventory/restock/RestockReceiveModal";
import type { PurchaseRequest } from "@/app/admin/inventory/restock/types";

const REQUEST: PurchaseRequest = {
  id: "pr-1",
  nomorRequest: "PR-001",
  status: "ORDERED",
  createdAt: "2026-11-01T00:00:00.000Z",
  requester: { name: "Budi" },
  gudangId: "gudang-1",
  gudang: { id: "gudang-1", nama: "Gudang Utama" },
  purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "ORDERED" },
  items: [
    {
      id: "item-1",
      barangId: "barang-1",
      jumlah: 10,
      receivedQuantity: 0,
      barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
    },
  ],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function findButton(text: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.includes(text),
  );
  if (!button) throw new Error(`Tombol "${text}" tidak ditemukan`);
  return button as HTMLButtonElement;
}

function renderFinishingModal(onClose = vi.fn(), onSubmit = vi.fn()) {
  act(() => {
    root.render(
      <RestockReceiveModal
        request={REQUEST}
        receivedItems={{ "barang-1": 6 }}
        onReceivedItemsChange={() => {}}
        barangs={[]}
        substitutions={{}}
        onSubstitutionsChange={() => {}}
        cancellations={{}}
        onCancellationsChange={() => {}}
        overReceipts={{}}
        onOverReceiptsChange={() => {}}
        receivedPhotos={[{ preview: "x" } as never]}
        onReceivedPhotosChange={() => {}}
        isFinishingOrder
        onIsFinishingOrderChange={() => {}}
        closeReason="Toko tidak mengirim"
        onCloseReasonChange={() => {}}
        submitting={false}
        photoUploadRef={{ current: null }}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );
  });
  return { onClose, onSubmit };
}

describe("konfirmasi barang kurang di modal penerimaan", () => {
  it("mengembalikan fokus ke tombol simpan setelah Kembali", () => {
    renderFinishingModal();
    act(() => findButton("Simpan & selesaikan pesanan").click());
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();

    act(() => findButton("Kembali").click());

    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.activeElement).toBe(
      findButton("Simpan & selesaikan pesanan"),
    );
  });

  it("menganggap Escape sebagai Kembali, bukan menutup modal", () => {
    const { onClose } = renderFinishingModal();
    act(() => findButton("Simpan & selesaikan pesanan").click());

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("memberi nama yang bisa dibaca pada dialog konfirmasi", () => {
    renderFinishingModal();
    act(() => findButton("Simpan & selesaikan pesanan").click());

    const dialog = document.querySelector('[role="alertdialog"]');
    const labelId = dialog?.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId!)?.textContent).toContain(
      "Selesaikan dengan barang kurang?",
    );
  });
});
