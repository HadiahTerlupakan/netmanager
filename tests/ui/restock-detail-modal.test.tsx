import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type {
  PurchaseRequest,
  PurchaseRequestJasaItem,
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

describe("RestockDetailModal riwayat dan barang", () => {
  const legacyPartial: PurchaseRequest = {
    ...request,
    status: "ORDERED",
    approvedAt: "2026-11-02T03:00:00.000Z",
    keterangan: "Untuk tarikan cluster Depok",
    purchaseOrder: { id: "po-1", poNumber: "PO-2026-009", status: "PARTIAL" },
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

  const approvedFresh: PurchaseRequest = {
    ...request,
    status: "ORDERED",
    approvedAt: "2026-11-02T03:00:00.000Z",
    purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "DRAFT" },
    goodsReceipts: [],
    items: [
      { ...request.items[0], orderedQuantity: 8, receivedQuantity: 0 },
      request.items[1],
    ],
  };

  function renderDetail(
    target: PurchaseRequest,
    props: Partial<React.ComponentProps<typeof RestockDetailModal>> = {},
  ): string {
    return renderToStaticMarkup(
      <RestockDetailModal request={target} onClose={vi.fn()} {...props} />,
    );
  }

  it("menunjukkan status, gudang tujuan, catatan, dan keputusan atasan", () => {
    const markup = renderDetail(legacyPartial);

    expect(markup).toContain("Disetujui");
    expect(markup).toContain(
      "Sebagian barang sudah sampai. Menunggu admin menyelesaikan pengajuan ini.",
    );
    expect(markup).toContain("Gudang tujuan");
    expect(markup).toContain("Gudang A");
    expect(markup).toContain("Untuk tarikan cluster Depok");
    expect(markup).toContain("Keputusan Atasan");
    expect(markup).not.toContain("Tahap");
  });

  it("menulis riwayat dari diajukan sampai barang masuk, terlama dulu", () => {
    const markup = renderDetail(legacyPartial);

    expect(markup).toContain("Riwayat");
    expect(markup).toContain("Diajukan · 1 Nov 2026 · Rohadim");
    expect(markup).toContain("Disetujui 2 Nov 2026 · Manajer Gudang");
    expect(markup.indexOf("Barang sampai ke-1")).toBeLessThan(
      markup.indexOf("Barang sampai ke-2"),
    );
    expect(markup).toContain("dicatat Budi");
    expect(markup).toContain("Kabel Dropcore 4 roll (1 foto)");
    expect(markup).toContain('aria-label="Buka foto 1 barang sampai ke-1"');
    expect(markup).toContain("No. catatan: GRN-1");
    expect(markup).toContain("Menunggu laporan barang sampai");
    expect(markup).toContain("Kode pesanan: PO-2026-009");
    expect(markup).not.toContain("belanja");
  });

  it("menyebut catatan barang masuk tanpa nomor urut bila hanya satu", () => {
    const markup = renderDetail({
      ...legacyPartial,
      status: "RECEIVED",
      goodsReceipts: [legacyPartial.goodsReceipts![1]],
    });

    expect(markup).toContain("Barang sampai · ");
    expect(markup).not.toContain("Barang sampai ke-1");
    expect(markup).not.toContain("Menunggu laporan barang sampai");
  });

  it("menampilkan jumlah diajukan, disetujui, masuk gudang, dan sisa per barang", () => {
    const markup = renderDetail(legacyPartial);

    for (const header of ["Diajukan", "Disetujui", "Sampai", "Sisa"]) {
      expect(markup).toContain(`<span class="text-right">${header}</span>`);
    }
    expect(markup).toContain(">10 roll<");
    expect(markup).toContain(">8 roll<");
    expect(markup).toContain(">6 roll<");
    expect(markup).toContain(">1 roll<");
    expect(markup).toContain("Alasan tidak sampai: Barang habis di toko");
  });

  it("menghitung sisa sebagai tidak masuk setelah pengajuan selesai", () => {
    const markup = renderDetail({ ...legacyPartial, status: "RECEIVED" });

    expect(markup).toContain('<span class="text-right">Tidak sampai</span>');
    expect(markup).toContain(">2 roll<");
    expect(markup).toContain("Sudah Sampai");
    expect(markup).toContain("Kabel Dropcore sampai 6 dari 8 roll.");
  });

  it("menandai barang yang masuk lebih banyak dari yang disetujui", () => {
    const markup = renderDetail({
      ...approvedFresh,
      status: "RECEIVED",
      items: [
        {
          ...approvedFresh.items[0],
          orderedQuantity: 10,
          receivedQuantity: 10,
        },
      ],
    });

    expect(markup).toContain("10 roll (+2 lebih)");
  });

  it("menutup riwayat tanpa barang masuk atau dengan pembatalan beserta alasannya", () => {
    const finished = renderDetail({
      ...approvedFresh,
      status: "RECEIVED",
      items: [
        {
          ...approvedFresh.items[0],
          receivedQuantity: 0,
          cancelledQuantity: 8,
        },
      ],
    });
    expect(finished).toContain("Selesai tanpa barang sampai");

    const cancelled = renderDetail({
      ...approvedFresh,
      status: "CANCELLED",
      cancelReason: "Proyek ditunda",
    });
    expect(cancelled).toContain("Dibatalkan");
    expect(cancelled).toContain("Alasan: Proyek ditunda");
    expect(cancelled).toContain(
      "Pengajuan ini dibatalkan. Alasan: Proyek ditunda",
    );
    expect(cancelled).not.toContain("Menunggu laporan barang sampai");
  });

  it("menampilkan pengajuan yang belum diputuskan tanpa kolom barang masuk", () => {
    const markup = renderDetail(
      {
        ...request,
        status: "DRAFT",
        approver: null,
        catatanApproval: null,
        items: [
          {
            ...request.items[0],
            statusApproval: "PENDING",
            jumlahDiminta: null,
            barangIdDiminta: null,
            barangDiminta: null,
            catatanApproval: null,
          },
        ],
      },
      { canVerify: true, onOpenReceive: vi.fn(), onOpenCancel: vi.fn() },
    );

    expect(markup).toContain("Menunggu Persetujuan");
    expect(markup).toContain("Belum diputuskan atasan.");
    expect(markup).toContain("Menunggu keputusan atasan");
    expect(markup).not.toContain('<span class="text-right">Sampai</span>');
    expect(markup).not.toContain("Keputusan Atasan");
    expect(markup).not.toContain("Lapor Barang Sampai");
    expect(markup).not.toContain("Batalkan Pengajuan");
  });

  it("menulis penolakan atasan di riwayat dan statusnya", () => {
    const markup = renderDetail({
      ...request,
      status: "REJECTED",
      catatanApproval: "Stok gudang masih cukup",
    });

    expect(markup).toContain("Ditolak · Manajer Gudang");
    expect(markup).toContain(
      "Pengajuan ini ditolak. Alasan: Stok gudang masih cukup",
    );
    expect(markup).not.toContain('<span class="text-right">Sampai</span>');
  });
});

describe("RestockDetailModal tombol lanjutan", () => {
  const approved: PurchaseRequest = {
    ...request,
    status: "ORDERED",
    purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "DRAFT" },
    items: [{ ...request.items[0], receivedQuantity: 0 }],
  };
  const handlers = { onOpenReceive: vi.fn(), onOpenCancel: vi.fn() };

  it("memberi petugas verifikasi Lapor Barang Sampai dan Batalkan Pengajuan", () => {
    const markup = renderToStaticMarkup(
      <RestockDetailModal
        request={approved}
        onClose={vi.fn()}
        canVerify
        {...handlers}
      />,
    );

    expect(markup).toContain('aria-label="Lapor Barang Sampai untuk PR-001"');
    expect(markup).toContain("bg-indigo-700");
    expect(markup).toContain('aria-label="Batalkan Pengajuan PR-001"');
    expect(markup.indexOf("Lapor Barang Sampai untuk")).toBeLessThan(
      markup.indexOf("Batalkan Pengajuan PR-001"),
    );
  });

  it("tidak menampilkan tombol lanjutan untuk yang hanya melihat", () => {
    const markup = renderToStaticMarkup(
      <RestockDetailModal request={approved} onClose={vi.fn()} {...handlers} />,
    );

    expect(markup).not.toContain("Lapor Barang Sampai");
    expect(markup).not.toContain("Batalkan Pengajuan");
  });

  it("tidak menawarkan Batalkan setelah ada barang yang masuk", () => {
    const markup = renderToStaticMarkup(
      <RestockDetailModal
        request={{
          ...approved,
          items: [{ ...approved.items[0], receivedQuantity: 4 }],
        }}
        onClose={vi.fn()}
        canVerify
        {...handlers}
      />,
    );

    expect(markup).toContain("Lapor Barang Sampai");
    expect(markup).not.toContain("Batalkan Pengajuan");
  });

  it("menawarkan Batalkan pada pesanan gabungan walau pengajuan lain sudah memasukkan barang", () => {
    const merged: PurchaseRequest = {
      ...approved,
      purchaseOrder: {
        id: "po-1",
        poNumber: "PO-1",
        status: "PARTIAL",
        linkedRequestCount: 2,
      },
      goodsReceipts: [{ id: "grn-1", grnNumber: "GRN-1", fotoBukti: [] }],
    };
    const markup = renderToStaticMarkup(
      <RestockDetailModal
        request={merged}
        onClose={vi.fn()}
        canVerify
        {...handlers}
      />,
    );

    expect(markup).toContain('aria-label="Batalkan Pengajuan PR-001"');
  });

  it("tidak menawarkan Batalkan pada pesanan gabungan bila jasa pengajuan ini sudah selesai", () => {
    const markup = renderToStaticMarkup(
      <RestockDetailModal
        request={{
          ...approved,
          purchaseOrder: {
            id: "po-1",
            poNumber: "PO-1",
            status: "ORDERED",
            linkedRequestCount: 2,
          },
          jasaItems: [
            {
              id: "jasa-item-1",
              jasaId: "jasa-1",
              jumlah: 1,
              hargaPerUnit: 100,
              totalHarga: 100,
              statusKonfirmasi: "SELESAI",
              jasa: {
                id: "jasa-1",
                kode: "JS-1",
                nama: "Splicing",
                satuan: "job",
              },
            },
          ],
        }}
        onClose={vi.fn()}
        canVerify
        {...handlers}
      />,
    );

    expect(markup).not.toContain("Batalkan Pengajuan");
  });

  it("tidak menampilkan tombol lanjutan untuk pengajuan yang sudah selesai", () => {
    const markup = renderToStaticMarkup(
      <RestockDetailModal
        request={{
          ...approved,
          status: "RECEIVED",
          items: [{ ...approved.items[0], receivedQuantity: 8 }],
        }}
        onClose={vi.fn()}
        canVerify
        {...handlers}
      />,
    );

    expect(markup).not.toContain("Lapor Barang Sampai");
    expect(markup).not.toContain("Batalkan Pengajuan");
  });
});

describe("RestockDetailModal jasa", () => {
  const jasa = (
    overrides: Partial<PurchaseRequestJasaItem>,
  ): PurchaseRequestJasaItem => ({
    id: "jasa-item-1",
    jasaId: "jasa-1",
    jumlah: 1,
    hargaPerUnit: 100,
    totalHarga: 100,
    statusKonfirmasi: "PENDING",
    jasa: { id: "jasa-1", kode: "JS-1", nama: "Splicing", satuan: "job" },
    ...overrides,
  });

  it("menandai jasa yang ditolak atasan lewat info persetujuannya", () => {
    const markup = renderToStaticMarkup(
      <RestockDetailModal
        request={{
          ...request,
          items: [],
          jasaItems: [
            jasa({
              statusApproval: "REJECTED",
              catatanApproval: "Tidak perlu",
            }),
            jasa({
              id: "jasa-item-2",
              jasa: {
                id: "jasa-2",
                kode: "JS-2",
                nama: "Tarik Kabel",
                satuan: "job",
              },
            }),
          ],
        }}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain("Daftar Jasa");
    expect(markup).toContain("Ditolak");
    expect(markup).toContain("Catatan atasan: Tidak perlu");
    expect(markup.split("Menunggu Konfirmasi").length).toBe(2);
  });

  it("memakai warna teks kecil yang terbaca di mode terang dan gelap", () => {
    const markup = renderToStaticMarkup(
      <RestockDetailModal
        request={{
          ...request,
          items: [],
          jasaItems: [
            jasa({
              statusKonfirmasi: "SELESAI",
              tanggalSelesai: "2026-11-02T00:00:00.000Z",
              keterangan: "Splicing 12 core",
            }),
            jasa({ id: "jasa-item-2" }),
          ],
        }}
        onClose={vi.fn()}
      />,
    );

    expect(markup).not.toContain("text-violet-400");
    expect(markup).not.toContain("text-emerald-600");
    expect(markup).toMatch(
      /class="[^"]*text-violet-700 dark:text-violet-300[^"]*">Daftar Jasa</,
    );
    expect(markup).toMatch(
      /class="[^"]*text-gray-600 dark:text-gray-400[^"]*">Splicing 12 core</,
    );
    expect(markup).toMatch(
      /class="[^"]*text-emerald-700 dark:text-emerald-300[^"]*">Selesai:/,
    );
    expect(markup).toMatch(
      /class="[^"]*dark:bg-emerald-900\/50 dark:text-emerald-100[^"]*">Selesai</,
    );
    expect(markup).toMatch(
      /class="[^"]*dark:bg-yellow-900\/50 dark:text-yellow-100[^"]*">Menunggu Konfirmasi</,
    );
    expect(markup).toMatch(
      /class="[^"]*text-violet-600 dark:text-violet-300[^"]*">1\b/,
    );
  });
});
