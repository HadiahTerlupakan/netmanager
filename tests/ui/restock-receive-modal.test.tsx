import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type {
  Barang,
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

vi.mock("@/components/inventory/PhotoUpload", () => ({
  PhotoUpload: () => <div>Photo upload</div>,
}));

import { RestockReceiveModal } from "@/app/admin/inventory/restock/RestockReceiveModal";

const barangs: Barang[] = [
  { id: "barang-1", kode: "BRG-001", nama: "Kabel Fiber", satuan: "roll" },
  { id: "barang-2", kode: "BRG-002", nama: "Kabel Dropcore", satuan: "roll" },
];

const request: PurchaseRequest = {
  id: "pr-1",
  nomorRequest: "PR-001",
  status: "ORDERED",
  createdAt: "2026-04-19T00:00:00.000Z",
  requester: { name: "Rohadim" },
  gudangId: "gudang-a",
  gudang: { id: "gudang-a", nama: "Gudang A" },
  items: [
    {
      id: "item-1",
      barangId: "barang-1",
      jumlah: 10,
      receivedQuantity: 0,
      barang: { nama: "Kabel Fiber", kode: "BRG-001", satuan: "roll" },
    },
  ],
};

function renderReceiveModal(
  props?: Partial<React.ComponentProps<typeof RestockReceiveModal>>,
) {
  return renderToStaticMarkup(
    <RestockReceiveModal
      request={props?.request ?? request}
      receivedItems={props?.receivedItems ?? { "barang-1": 8 }}
      onReceivedItemsChange={props?.onReceivedItemsChange ?? vi.fn()}
      barangs={props?.barangs ?? barangs}
      substitutions={props?.substitutions ?? {}}
      onSubstitutionsChange={props?.onSubstitutionsChange ?? vi.fn()}
      receivedPhotos={props?.receivedPhotos ?? []}
      onReceivedPhotosChange={props?.onReceivedPhotosChange ?? vi.fn()}
      isFinishingPO={props?.isFinishingPO ?? true}
      onIsFinishingPOChange={props?.onIsFinishingPOChange ?? vi.fn()}
      submitting={props?.submitting ?? false}
      photoUploadRef={props?.photoUploadRef ?? { current: null }}
      onClose={props?.onClose ?? vi.fn()}
      onSubmit={props?.onSubmit ?? vi.fn()}
    />,
  );
}

describe("RestockReceiveModal", () => {
  it("labels item controls with the item name", () => {
    const markup = renderReceiveModal();

    expect(markup).toContain('aria-label="Sertakan Kabel Fiber"');
    expect(markup).toContain('aria-label="Jumlah Kabel Fiber diterima"');
  });

  it("explains why submit is disabled when proof photo is missing", () => {
    const markup = renderReceiveModal({ receivedPhotos: [] });

    expect(markup).toContain("Unggah foto bukti terlebih dahulu");
    expect(markup).toContain('aria-disabled="true"');
  });

  it("warns when all item quantities are zero", () => {
    const markup = renderReceiveModal({ receivedItems: { "barang-1": 0 } });

    expect(markup).toContain("Minimal satu barang harus diterima");
  });

  it("offers replacing an item whose goods arrived different", () => {
    const markup = renderReceiveModal();

    expect(markup).toContain("Barang yang sampai beda? Ganti Kabel Fiber");
  });

  it("shows the replacement item and a substitution summary", () => {
    const markup = renderReceiveModal({
      substitutions: { "barang-1": "barang-2" },
    });

    expect(markup).toContain("Kabel Dropcore");
    expect(markup).toContain("Barang diganti");
    expect(markup).toContain("Pesanan: Kabel Fiber");
    expect(markup).toContain("1 barang diganti");
  });

  it("blocks substitution for items already partially received", () => {
    const partiallyReceived: PurchaseRequest = {
      ...request,
      items: [{ ...request.items[0], receivedQuantity: 2 }],
    };
    const markup = renderReceiveModal({ request: partiallyReceived });

    expect(markup).toContain("barang tidak bisa diganti");
    expect(markup).not.toContain("Barang yang sampai beda?");
  });
});
