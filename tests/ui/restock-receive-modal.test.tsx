import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type {
  Barang,
  PurchaseRequest,
  PurchaseRequestItem,
} from "@/app/admin/inventory/restock/types";
import type { RestockEntryState } from "@/app/admin/inventory/restock/useRestockEntry";
import { makeRestockEntryState } from "@/tests/fixtures/restock-entry-state";

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title?: string;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

vi.mock("@/components/inventory/PhotoUpload", () => ({
  PhotoUpload: () => <div>Photo upload</div>,
}));

import { RestockReceiveModal } from "@/app/admin/inventory/restock/RestockReceiveModal";
import {
  NOTHING_ENTERED_MESSAGE,
  OVER_RECEIPT_REASON_MISSING_MESSAGE,
  PHOTO_MISSING_MESSAGE,
} from "@/app/admin/inventory/restock/restockReceiveForm";

const barangs: Barang[] = [
  { id: "barang-1", kode: "BRG-001", nama: "Kabel Fiber", satuan: "roll" },
  { id: "barang-2", kode: "BRG-002", nama: "Patch Cord", satuan: "pcs" },
];

function makeItem(
  overrides: Partial<PurchaseRequestItem> = {},
): PurchaseRequestItem {
  return {
    id: "item-1",
    barangId: "barang-1",
    jumlah: 10,
    receivedQuantity: 0,
    barang: { nama: "Kabel Fiber", kode: "BRG-001", satuan: "roll" },
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
    createdAt: "2026-04-19T00:00:00.000Z",
    requester: { name: "Rohadim" },
    gudangId: "gudang-a",
    gudang: { id: "gudang-a", nama: "Gudang A" },
    purchaseOrder: { id: "po-1", poNumber: "PO-2026-001", status: "DRAFT" },
    items: [makeItem()],
    ...overrides,
  };
}

const photo = { preview: "x" } as never;

interface RenderOptions {
  entry?: Partial<RestockEntryState>;
  canOverReceive?: boolean;
}

function renderReceiveModal({
  entry,
  canOverReceive = false,
}: RenderOptions = {}): string {
  return renderToStaticMarkup(
    <RestockReceiveModal
      entry={makeRestockEntryState({
        request: makeRequest(),
        receivedItems: { "barang-1": 10 },
        photos: [photo],
        ...entry,
      })}
      barangs={barangs}
      canOverReceive={canOverReceive}
    />,
  );
}

describe("RestockReceiveModal", () => {
  it("tidak merender apa pun sebelum ada pengajuan yang dibuka", () => {
    expect(
      renderToStaticMarkup(
        <RestockReceiveModal
          entry={makeRestockEntryState()}
          barangs={barangs}
          canOverReceive={false}
        />,
      ),
    ).toBe("");
  });

  it("memperkenalkan pengajuan, kode pesanan, status, dan gudang tujuan", () => {
    const markup = renderReceiveModal();

    expect(markup).toContain("Lapor Barang Sampai");
    expect(markup).toContain("Pengajuan PR-001");
    expect(markup).toContain("Kode pesanan: PO-2026-001");
    expect(markup).toContain("Disetujui");
    expect(markup).toContain("Gudang tujuan: Gudang A");
    expect(markup).not.toContain("belanja");
  });

  it("memberi label jumlah yang terlihat dan yang menyebut nama barang", () => {
    const markup = renderReceiveModal();

    expect(markup).toContain("Jumlah masuk");
    expect(markup).toContain('aria-label="Jumlah Kabel Fiber yang sampai"');
    expect(markup).toContain("Disetujui 10 roll");
    expect(markup).toContain("Simpan Laporan");
  });

  it("menjelaskan isian awal dan batasnya bagi petugas tanpa izin kelebihan", () => {
    const markup = renderReceiveModal();

    expect(markup).toContain(
      "Jumlah sudah terisi sesuai sisa yang belum sampai. Ubah kalau yang sampai lebih sedikit.",
    );
    expect(markup).toContain(
      "Terisi sesuai jumlah yang disetujui. Ubah kalau yang sampai lebih sedikit. Lebih dari ini hanya bisa dicatat petugas yang boleh mengubah pesanan.",
    );
    expect(markup).toContain('max="10"');
  });

  it("tidak menyebut jumlah disetujui atau sisa sebagai pengajuan", () => {
    const markup = renderReceiveModal({
      canOverReceive: true,
      entry: {
        request: makeRequest({
          items: [
            makeItem({ jumlah: 8, jumlahDiminta: 10, orderedQuantity: 8 }),
          ],
        }),
        receivedItems: { "barang-1": 10 },
      },
    });

    expect(markup).toContain("Disetujui 8 roll");
    expect(markup).toContain(
      "Masuk 2 roll lebih banyak dari jumlah yang disetujui. Kalau diterima, kelebihannya ikut dibayar ke toko. Tulis alasannya.",
    );
    expect(markup).toContain(
      "Kembalikan ke toko, lalu isi sesuai jumlah yang disetujui.",
    );
    expect(markup).not.toContain("dari pengajuan");
    expect(markup).not.toContain("sesuai pengajuan");
  });

  it("pesanan yang dinaikkan: terisi seluruh sisa pesanan dan menyebut jumlah pesanannya", () => {
    const raised = makeRequest({
      items: [makeItem({ orderedQuantity: 15 })],
    });
    const full = renderReceiveModal({
      entry: { request: raised, receivedItems: { "barang-1": 15 } },
    });

    expect(full).toContain("Disetujui 10 roll · Dipesan 15 roll");
    expect(full).toContain("Terisi sesuai sisa pesanan.");
    expect(full).toContain('max="15"');

    const short = renderReceiveModal({
      entry: { request: raised, receivedItems: { "barang-1": 10 } },
    });
    expect(short).toContain("5 roll tidak sampai.");
    expect(short).toContain("Kabel Fiber — 5 roll");
  });

  it("pesanan gabungan: hanya bagian pengajuan ini, dengan penjelasan satu baris", () => {
    const markup = renderReceiveModal({
      entry: {
        request: makeRequest({
          purchaseOrder: {
            id: "po-1",
            poNumber: "PO-2026-001",
            status: "ORDERED",
            linkedRequestCount: 2,
          },
          items: [makeItem({ jumlah: 5, orderedQuantity: 10 })],
        }),
        receivedItems: { "barang-1": 5 },
      },
    });

    expect(markup).toContain("Disetujui 5 roll");
    expect(markup).not.toContain("Dipesan");
    expect(markup).toContain("Terisi sesuai jumlah yang disetujui.");
    expect(markup).toContain("Tidak ada.");
    expect(markup).toContain(
      "Pesanan ini dipakai bersama pengajuan lain; sisa milik pengajuan lain yang belum selesai tidak ikut ditutup.",
    );
  });

  it("tidak menampilkan penjelasan pesanan gabungan untuk pesanan milik satu pengajuan", () => {
    expect(renderReceiveModal()).not.toContain(
      "Pesanan ini dipakai bersama pengajuan lain",
    );
  });

  it("tidak membatasi jumlah bagi petugas yang boleh mengubah pesanan", () => {
    const markup = renderReceiveModal({ canOverReceive: true });

    expect(markup).not.toContain("max=");
    expect(markup).not.toContain("hanya bisa dicatat petugas");
    expect(markup).toContain("lebih sedikit atau lebih banyak");
  });

  it("menyebut kelebihan terhadap sisa pesanan pada pengajuan lama yang sudah menerima sebagian", () => {
    const markup = renderReceiveModal({
      canOverReceive: true,
      entry: {
        request: makeRequest({ items: [makeItem({ receivedQuantity: 4 })] }),
        receivedItems: { "barang-1": 8 },
      },
    });

    expect(markup).toContain(
      "Masuk 2 roll lebih banyak dari sisa pesanan. Kalau diterima, kelebihannya ikut dibayar ke toko. Tulis alasannya.",
    );
  });

  it("menunjukkan kemajuan baris pengajuan lama yang sudah menerima sebagian", () => {
    const markup = renderReceiveModal({
      entry: {
        request: makeRequest({
          items: [
            makeItem({
              receivedQuantity: 4,
              cancelledQuantity: 2,
              cancelReason: "Barang habis di toko",
            }),
          ],
        }),
        receivedItems: { "barang-1": 4 },
      },
    });

    expect(markup).toContain(
      "Disetujui 10 roll · Sudah sampai 4 roll · Sisa 4 roll",
    );
    expect(markup).toContain(
      "Sebelumnya tidak masuk: 2 roll (Barang habis di toko)",
    );
    expect(markup).toContain(
      "Sudah sampai 4 roll sebelumnya, jadi barangnya tidak bisa diganti lagi.",
    );
  });

  it("menjelaskan kenapa belum bisa disimpan saat foto belum ada", () => {
    const markup = renderReceiveModal({ entry: { photos: [] } });

    expect(markup).toContain("Belum bisa disimpan:");
    expect(markup).toContain(PHOTO_MISSING_MESSAGE);
    expect(markup).toContain('aria-disabled="true"');
  });

  it("meminta jumlah dan mengarah ke Batalkan bila semua diisi 0", () => {
    const markup = renderReceiveModal({
      entry: { receivedItems: { "barang-1": 0 }, photos: [] },
    });

    expect(markup).toContain(NOTHING_ENTERED_MESSAGE);
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain("Simpan Laporan");
    expect(markup).not.toContain("Selesaikan tanpa barang tambahan");
  });

  it("menawarkan Selesaikan tanpa barang tambahan untuk data lama, tanpa foto", () => {
    const markup = renderReceiveModal({
      entry: {
        request: makeRequest({ items: [makeItem({ receivedQuantity: 4 })] }),
        receivedItems: { "barang-1": 0 },
        photos: [],
      },
    });

    expect(markup).toContain("Selesaikan tanpa barang tambahan");
    expect(markup).not.toContain("Belum bisa disimpan:");
    expect(markup).toMatch(
      /<section[^>]*hidden=""[^>]*>\s*<h3[^>]*>2\. Foto bukti barang/,
    );
  });

  it("menampilkan ringkasan dan pengingat bahwa pengajuan selesai", () => {
    const complete = renderReceiveModal();
    expect(complete).toContain(">Sampai<");
    expect(complete).toContain("Kabel Fiber — 10 roll");
    expect(complete).toContain("Tidak sampai");
    expect(complete).toContain("Tidak ada.");
    expect(complete).toContain("Pengajuan akan selesai setelah disimpan.");

    const short = renderReceiveModal({
      entry: { receivedItems: { "barang-1": 6 } },
    });
    expect(short).toContain("Kabel Fiber — 4 roll");
    expect(short).toContain("4 roll tidak sampai.");
  });

  it("mengingatkan jasa yang masih ditandai lewat Konfirmasi Jasa", () => {
    const markup = renderReceiveModal({
      entry: {
        request: makeRequest({
          jasaItems: [
            {
              id: "jasa-item-1",
              jasaId: "jasa-1",
              jumlah: 1,
              hargaPerUnit: 0,
              totalHarga: 0,
              statusKonfirmasi: "PENDING",
              jasa: {
                id: "jasa-1",
                kode: "JS",
                nama: "Instalasi",
                satuan: "job",
              },
            },
          ],
        }),
      },
    });

    expect(markup).toContain(
      "Pengajuan akan selesai setelah disimpan. Jasa tetap ditandai lewat Konfirmasi Jasa.",
    );
  });

  it("menawarkan ganti barang bila yang masuk berbeda", () => {
    expect(renderReceiveModal()).toContain(
      "Yang sampai barang lain? Pilih barangnya",
    );
  });

  it("menampilkan barang pengganti beserta satuannya dan ringkasan penggantian", () => {
    const markup = renderReceiveModal({
      entry: {
        receivedItems: { "barang-1": 4 },
        substitutions: { "barang-1": "barang-2" },
      },
    });

    expect(markup).toContain("Patch Cord");
    expect(markup).toContain("Barang diganti");
    expect(markup).toContain("Kembalikan ke Kabel Fiber");
    expect(markup).toContain("Patch Cord — 4 pcs");
    expect(markup).toContain(
      "1 barang diganti dengan barang lain yang masuk. Catatan pesanan ikut disesuaikan.",
    );
  });

  it("meminta alasan bila yang masuk lebih banyak dari sisa", () => {
    const markup = renderReceiveModal({
      canOverReceive: true,
      entry: { receivedItems: { "barang-1": 12 } },
    });

    expect(markup).toContain(
      "Masuk 2 roll lebih banyak dari jumlah yang disetujui. Kalau diterima, kelebihannya ikut dibayar ke toko. Tulis alasannya.",
    );
    expect(markup).toContain('aria-label="Alasan kelebihan Kabel Fiber"');
    expect(markup).toContain(OVER_RECEIPT_REASON_MISSING_MESSAGE);
  });

  it("membolehkan simpan kelebihan setelah alasannya diisi", () => {
    const markup = renderReceiveModal({
      canOverReceive: true,
      entry: {
        receivedItems: { "barang-1": 12 },
        overReceipts: { "barang-1": "Bonus dari toko" },
      },
    });

    expect(markup).not.toContain("Belum bisa disimpan:");
    expect(markup).toContain('aria-disabled="false"');
  });

  it("tidak menampilkan baris yang ditolak atasan atau yang sudah habis sisanya", () => {
    const markup = renderReceiveModal({
      entry: {
        request: makeRequest({
          items: [
            makeItem(),
            makeItem({
              id: "item-2",
              barangId: "barang-3",
              statusApproval: "REJECTED",
              barang: { nama: "Konektor", kode: "BRG-003", satuan: "pcs" },
            }),
            makeItem({
              id: "item-3",
              barangId: "barang-4",
              receivedQuantity: 10,
              barang: { nama: "ONT", kode: "BRG-004", satuan: "pcs" },
            }),
          ],
        }),
      },
    });

    expect(markup).not.toContain("Jumlah Konektor yang masuk");
    expect(markup).not.toContain("Jumlah ONT yang masuk");
  });
});
