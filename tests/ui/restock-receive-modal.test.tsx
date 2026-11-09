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
  purchaseOrder: { id: "po-1", poNumber: "PO-2026-001", status: "ORDERED" },
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

const photo = [{ preview: "x" } as never];

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
      cancellations={props?.cancellations ?? {}}
      onCancellationsChange={props?.onCancellationsChange ?? vi.fn()}
      overReceipts={props?.overReceipts ?? {}}
      onOverReceiptsChange={props?.onOverReceiptsChange ?? vi.fn()}
      receivedPhotos={props?.receivedPhotos ?? []}
      onReceivedPhotosChange={props?.onReceivedPhotosChange ?? vi.fn()}
      isFinishingOrder={props?.isFinishingOrder ?? false}
      onIsFinishingOrderChange={props?.onIsFinishingOrderChange ?? vi.fn()}
      closeReason={props?.closeReason ?? ""}
      onCloseReasonChange={props?.onCloseReasonChange ?? vi.fn()}
      submitting={props?.submitting ?? false}
      photoUploadRef={props?.photoUploadRef ?? { current: null }}
      onClose={props?.onClose ?? vi.fn()}
      onSubmit={props?.onSubmit ?? vi.fn()}
    />,
  );
}

describe("RestockReceiveModal", () => {
  it("introduces the request, order code, status and destination", () => {
    const markup = renderReceiveModal();

    expect(markup).toContain("Pengajuan PR-001");
    expect(markup).toContain("Kode pesanan: PO-2026-001");
    expect(markup).toContain("Sudah Dibeli Semua, Tunggu Barangnya");
    expect(markup).toContain("Masuk ke gudang: Gudang A");
    expect(markup).not.toContain("Belum ada catatan belanja");
  });

  it("reassures staff when nothing was recorded as bought yet", () => {
    const markup = renderReceiveModal({
      request: {
        ...request,
        purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "DRAFT" },
      },
    });

    expect(markup).toContain(
      "Belum ada catatan belanja. Tidak apa-apa, barang yang datang dihitung sudah dibeli.",
    );
  });

  it("stays quiet once part of the goods was recorded as bought", () => {
    const markup = renderReceiveModal({
      request: {
        ...request,
        purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "ORDERED" },
        items: request.items.map((item) => ({
          ...item,
          purchaseOrderItemId: `poi-${item.id}`,
          purchasedQuantity: 1,
        })),
      },
    });

    expect(markup).not.toContain("Belum ada catatan belanja");
  });

  it("labels the quantity input visibly and with the item name", () => {
    const markup = renderReceiveModal();

    expect(markup).toContain("1. Barang apa yang datang hari ini?");
    expect(markup).toContain(">Datang hari ini</label>");
    expect(markup).toContain(
      'aria-label="Jumlah Kabel Fiber yang datang hari ini"',
    );
    expect(markup).toContain("Semua datang lengkap");
  });

  it("shows the order progress of each line", () => {
    const fresh = renderReceiveModal();
    const partial = renderReceiveModal({
      request: {
        ...request,
        items: [{ ...request.items[0], receivedQuantity: 6 }],
      },
      receivedItems: { "barang-1": 4 },
    });

    expect(fresh).toContain("Dipesan 10 roll · Belum ada yang datang");
    expect(partial).toContain(
      "Dipesan 10 roll · Sudah datang 6 · Masih ditunggu 4",
    );
    expect(partial).toContain(
      "Sudah terisi semua sisa. Ubah kalau yang datang lebih sedikit.",
    );
  });

  it("explains why saving is blocked when the photo is missing", () => {
    const markup = renderReceiveModal({ receivedPhotos: [] });

    expect(markup).toContain("Belum bisa disimpan:");
    expect(markup).toContain("Foto barang yang datang dulu.");
    expect(markup).toContain('aria-disabled="true"');
  });

  it("tells staff to come back later when nothing arrived", () => {
    const markup = renderReceiveModal({ receivedItems: { "barang-1": 0 } });

    expect(markup).toContain(
      "Belum ada jumlah barang yang diisi. Kalau barangnya belum datang, tekan Tutup dan catat nanti saat barang tiba.",
    );
    expect(markup).toContain(
      "pilih &quot;Tidak, sisanya tidak akan datang&quot; di bagian 3.",
    );
  });

  it("shows the green box and complete label when everything arrives", () => {
    const markup = renderReceiveModal({
      receivedItems: { "barang-1": 10 },
      receivedPhotos: photo,
    });

    expect(markup).toContain(
      "Semua barang sudah lengkap. Setelah disimpan, pesanan ini selesai.",
    );
    expect(markup).not.toContain("3. Apakah masih ada barang");
    expect(markup).toContain("Simpan, pesanan lengkap");
  });

  it("asks whether the remainder still comes, defaulting to yes", () => {
    const markup = renderReceiveModal({ receivedPhotos: photo });

    expect(markup).toContain("3. Apakah masih ada barang yang akan menyusul?");
    expect(markup).toMatch(/<legend[^>]*>3\. Apakah/);
    expect(markup).toMatch(
      /type="radio"[^>]*checked=""[^>]*\/?>\s*<span><span[^>]*>Ya, sisanya masih ditunggu/,
    );
    expect(markup).toContain("Tidak, sisanya tidak akan datang");
    expect(markup).toContain("Simpan, sisa masih ditunggu");
    expect(markup).toContain("Sisa 2 roll ini tidak akan datang?");
  });

  it("lists what will not come and needs a reason when the answer is no", () => {
    const markup = renderReceiveModal({
      receivedPhotos: photo,
      isFinishingOrder: true,
    });

    expect(markup).toContain("Barang yang tidak jadi datang:");
    expect(markup).toContain("• Kabel Fiber — 2 roll");
    expect(markup).toContain(
      "Barang ini tidak masuk gudang. Kalau sudah terlanjur dibayar, beri tahu admin.",
    );
    expect(markup).toContain("Pilih alasan kenapa sisanya tidak datang.");
    expect(markup).toContain("Simpan &amp; selesaikan pesanan");
    expect(markup).not.toContain("Sisa 2 roll ini tidak akan datang?");
  });

  it("cancels an order with nothing ever received, without a photo", () => {
    const markup = renderReceiveModal({
      receivedItems: { "barang-1": 0 },
      isFinishingOrder: true,
      closeReason: "Toko tidak mengirim",
    });

    // Bagian foto tetap terpasang (fotonya tidak hilang) tapi disembunyikan.
    expect(markup).toMatch(/<section class="space-y-3" hidden="">/);
    expect(markup).toContain("2. Apakah masih ada barang yang akan menyusul?");
    expect(markup).not.toContain("3. Apakah masih ada barang");
    expect(markup).not.toContain("Belum bisa disimpan:");
    expect(markup).toContain("Batalkan pesanan");
    expect(markup).toContain(
      "Belum ada barang yang datang. Pesanan ini dibatalkan dan tidak ada barang yang masuk gudang.",
    );
    expect(markup).toContain(
      "Belum ada barang yang datang. Kalau disimpan, pesanan ini dibatalkan.",
    );
    expect(markup).not.toContain("Belum ada catatan belanja");
  });

  it("finishes (not cancels) a shared order without delivery", () => {
    const markup = renderReceiveModal({
      request: {
        ...request,
        purchaseOrder: {
          ...request.purchaseOrder,
          _count: { purchaseRequests: 2 },
        },
      },
      receivedItems: { "barang-1": 0 },
      isFinishingOrder: true,
      closeReason: "Toko tidak mengirim",
    });

    expect(markup).toContain("Selesaikan pesanan");
    expect(markup).not.toContain("Batalkan pesanan");
    expect(markup).toContain(
      "Pesanan selesai dengan barang kurang. Sisanya tidak bisa dicatat datang lagi.",
    );
  });

  it("uses the replacement's unit in the over-delivery warning", () => {
    const markup = renderReceiveModal({
      barangs: [
        ...barangs,
        {
          id: "barang-3",
          kode: "BRG-003",
          nama: "Kabel Meteran",
          satuan: "meter",
        },
      ],
      substitutions: { "barang-1": "barang-3" },
      receivedItems: { "barang-1": 12 },
      receivedPhotos: photo,
    });

    expect(markup).toContain("Datang 2 meter lebih banyak dari pesanan.");
    expect(markup).not.toContain("Datang 2 roll lebih banyak");
  });

  it("shows the live summary blocks", () => {
    const markup = renderReceiveModal({ receivedPhotos: photo });

    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("Masuk gudang hari ini");
    expect(markup).toContain("• Kabel Fiber — 8 roll");
    expect(markup).toContain("Masih ditunggu");
  });

  it("offers replacing an item whose goods arrived different", () => {
    const markup = renderReceiveModal();

    expect(markup).toContain("Yang datang barang lain? Pilih barangnya");
  });

  it("shows the replacement item and a substitution summary", () => {
    const markup = renderReceiveModal({
      substitutions: { "barang-1": "barang-2" },
    });

    expect(markup).toContain("Kabel Dropcore");
    expect(markup).toContain("Barang diganti");
    expect(markup).toContain("Kembalikan ke Kabel Fiber");
    expect(markup).toContain(
      "1 barang diganti dengan barang lain yang datang.",
    );
  });

  it("requires a reason once an item is marked as not coming", () => {
    const markup = renderReceiveModal({
      cancellations: { "barang-1": "" },
      receivedPhotos: photo,
    });

    expect(markup).toContain("2 roll Kabel Fiber tidak akan datang");
    expect(markup).toContain("Kenapa tidak datang?");
    expect(markup).toContain("Alasannya wajib diisi.");
    expect(markup).toContain("Pilih alasan kenapa Kabel Fiber tidak datang.");
    expect(markup).toContain("Ternyata masih datang");
    expect(markup).not.toContain("Tulis alasannya…");
  });

  it("shows the free text field only for a custom reason", () => {
    const markup = renderReceiveModal({
      cancellations: { "barang-1": "Supir sakit" },
      receivedPhotos: photo,
    });

    expect(markup).toContain('placeholder="Tulis alasannya…"');
    expect(markup).toContain("Lainnya (tulis sendiri)");
  });

  it("shows quantities that will not come from earlier receipts", () => {
    const markup = renderReceiveModal({
      request: {
        ...request,
        items: [
          {
            ...request.items[0],
            cancelledQuantity: 3,
            cancelReason: "Barang habis di toko",
          },
        ],
      },
    });

    expect(markup).toContain(
      "Tidak jadi datang: 3 roll (Barang habis di toko)",
    );
  });

  it("blocks substitution for items already partially received", () => {
    const markup = renderReceiveModal({
      request: {
        ...request,
        items: [{ ...request.items[0], receivedQuantity: 2 }],
      },
    });

    expect(markup).toContain(
      "Sudah datang 2 roll sebelumnya, jadi barangnya tidak bisa diganti lagi.",
    );
    expect(markup).not.toContain("Yang datang barang lain?");
  });

  it("asks for a reason when more arrives than ordered", () => {
    const markup = renderReceiveModal({
      receivedItems: { "barang-1": 20 },
      receivedPhotos: photo,
    });

    expect(markup).toContain('aria-label="Alasan kelebihan Kabel Fiber"');
    expect(markup).toContain(
      "Datang 10 roll lebih banyak dari pesanan. Kalau diterima, kelebihannya ikut dibayar ke toko. Tulis alasannya.",
    );
    expect(markup).toContain("Tidak mau membayar kelebihannya?");
    expect(markup).toContain("Tulis alasan barang yang datang lebih banyak.");
  });

  it("allows saving a larger delivery once its reason is filled", () => {
    const markup = renderReceiveModal({
      receivedItems: { "barang-1": 20 },
      overReceipts: { "barang-1": "Bonus dari toko" },
      receivedPhotos: photo,
    });

    expect(markup).not.toContain("Belum bisa disimpan:");
    expect(markup).toContain("Simpan, pesanan lengkap");
  });
});
