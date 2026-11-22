import { describe, expect, it } from "vitest";

import {
  getRestockLineCancelReason,
  getRestockStatus,
} from "@/app/admin/inventory/restock/restockStatus";
import type {
  GoodsReceiptSummary,
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseRequestJasaItem,
} from "@/app/admin/inventory/restock/types";

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
    barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
    ...overrides,
  };
}

function makeJasa(
  overrides: Partial<PurchaseRequestJasaItem> = {},
): PurchaseRequestJasaItem {
  return {
    id: "jasa-item-1",
    jasaId: "jasa-1",
    jumlah: 1,
    hargaPerUnit: 0,
    totalHarga: 0,
    statusKonfirmasi: "PENDING",
    jasa: { id: "jasa-1", kode: "JS-1", nama: "Instalasi", satuan: "job" },
    ...overrides,
  };
}

function makeRequest(
  overrides: Partial<PurchaseRequest> = {},
): PurchaseRequest {
  return {
    id: "pr-1",
    nomorRequest: "PR-001",
    status: "APPROVED",
    createdAt: "2026-11-01T00:00:00.000Z",
    requester: { name: "Budi" },
    gudangId: "gudang-a",
    gudang: { id: "gudang-a", nama: "Gudang Utama" },
    purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "DRAFT" },
    items: [makeItem()],
    ...overrides,
  };
}

function makeReceipt(): GoodsReceiptSummary {
  return { id: "grn-1", grnNumber: "GRN-1", fotoBukti: [] };
}

const ont = makeItem({
  id: "item-2",
  barangId: "barang-2",
  jumlah: 2,
  orderedQuantity: 2,
  barang: { nama: "ONT", kode: "BRG-2", satuan: "pcs" },
});
const konektor = makeItem({
  id: "item-3",
  barangId: "barang-3",
  barang: { nama: "Konektor", kode: "BRG-3", satuan: "pcs" },
});

describe("getRestockStatus — menunggu persetujuan", () => {
  it.each(["DRAFT", "SUBMITTED"] as const)(
    "%s menunggu keputusan atasan, dengan badge abu-abu",
    (status) => {
      const result = getRestockStatus(
        makeRequest({ status, purchaseOrder: null }),
      );
      expect(result).toMatchObject({
        key: "AWAITING_APPROVAL",
        label: "Menunggu Persetujuan",
        sentence: "Belum diputuskan atasan.",
      });
      expect(result.badgeClassName).toContain("bg-gray-100");
    },
  );
});

describe("getRestockStatus — disetujui", () => {
  it.each(["APPROVED", "ORDERED"] as const)(
    "%s tanpa barang masuk menunggu admin memasukkan barang, dengan badge amber",
    (status) => {
      const result = getRestockStatus(makeRequest({ status }));
      expect(result).toMatchObject({
        key: "APPROVED",
        label: "Disetujui",
        sentence: "Menunggu laporan barang sampai.",
      });
      expect(result.badgeClassName).toBe(
        "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
      );
    },
  );

  it("disetujui tanpa pesanan (pembuatan pesanan gagal) tetap menunggu admin", () => {
    expect(
      getRestockStatus(makeRequest({ purchaseOrder: null })).sentence,
    ).toBe("Menunggu laporan barang sampai.");
  });

  it("data lama yang sudah menerima sebagian menunggu admin menyelesaikannya", () => {
    const partly = getRestockStatus(
      makeRequest({
        status: "ORDERED",
        items: [makeItem({ receivedQuantity: 4 })],
      }),
    );
    expect(partly.key).toBe("APPROVED");
    expect(partly.sentence).toBe(
      "Sebagian barang sudah sampai. Menunggu admin menyelesaikan pengajuan ini.",
    );
  });

  it("menganggap catatan barang masuk sebagai barang yang sudah masuk", () => {
    expect(
      getRestockStatus(makeRequest({ goodsReceipts: [makeReceipt()] }))
        .sentence,
    ).toBe(
      "Sebagian barang sudah sampai. Menunggu admin menyelesaikan pengajuan ini.",
    );
  });

  it("pengajuan jasa saja menunggu jasanya ditandai selesai", () => {
    expect(
      getRestockStatus(makeRequest({ items: [], jasaItems: [makeJasa()] }))
        .sentence,
    ).toBe("Menunggu jasa ditandai selesai.");
  });

  it("jasa yang selesai tidak dibaca sebagai barang yang sudah masuk", () => {
    expect(
      getRestockStatus(
        makeRequest({ jasaItems: [makeJasa({ statusKonfirmasi: "SELESAI" })] }),
      ).sentence,
    ).toBe("Menunggu laporan barang sampai.");
  });
});

describe("getRestockStatus — sudah dimasukkan", () => {
  it("semua barang masuk: badge hijau dan kalimat lengkap", () => {
    const result = getRestockStatus(
      makeRequest({
        status: "RECEIVED",
        purchaseOrder: { id: "po-1", status: "RECEIVED" },
        items: [makeItem({ receivedQuantity: 10 })],
      }),
    );
    expect(result).toMatchObject({
      key: "RECEIVED",
      label: "Sudah Sampai",
      sentence: "Semua barang sudah sampai.",
    });
    expect(result.badgeClassName).toContain("bg-green-100");
  });

  it("menyebut barang yang sampai kurang dari yang disetujui, satu per satu", () => {
    const result = getRestockStatus(
      makeRequest({
        status: "RECEIVED",
        items: [
          makeItem({ receivedQuantity: 6, cancelledQuantity: 4 }),
          { ...ont, receivedQuantity: 1, cancelledQuantity: 1 },
        ],
      }),
    );
    expect(result.sentence).toBe(
      "Kabel Fiber sampai 6 dari 10 roll. ONT sampai 1 dari 2 pcs.",
    );
  });

  it("menghitung jenis barang bila lebih dari dua yang kurang", () => {
    const result = getRestockStatus(
      makeRequest({
        status: "RECEIVED",
        items: [
          makeItem({ receivedQuantity: 6, cancelledQuantity: 4 }),
          { ...ont, receivedQuantity: 1, cancelledQuantity: 1 },
          { ...konektor, receivedQuantity: 0, cancelledQuantity: 10 },
        ],
      }),
    );
    expect(result.sentence).toBe(
      "3 jenis barang sampai kurang dari yang disetujui.",
    );
  });

  it("membandingkan dengan jumlah disetujui walau pesanannya diturunkan", () => {
    expect(
      getRestockStatus(
        makeRequest({
          status: "RECEIVED",
          purchaseOrder: { id: "po-1", status: "RECEIVED" },
          items: [makeItem({ orderedQuantity: 6, receivedQuantity: 6 })],
        }),
      ).sentence,
    ).toBe("Kabel Fiber sampai 6 dari 10 roll.");
  });

  it("tidak menyebut kekurangan bila yang disetujui sudah masuk walau pesanannya dinaikkan", () => {
    expect(
      getRestockStatus(
        makeRequest({
          status: "RECEIVED",
          purchaseOrder: { id: "po-1", status: "RECEIVED" },
          items: [
            makeItem({
              orderedQuantity: 15,
              receivedQuantity: 10,
              cancelledQuantity: 5,
            }),
          ],
        }),
      ).sentence,
    ).toBe("Semua barang sudah sampai.");
  });

  it("menghitung sisa yang tidak dicoret pada data lama yang sudah ditutup", () => {
    expect(
      getRestockStatus(
        makeRequest({
          status: "RECEIVED",
          items: [makeItem({ receivedQuantity: 6 })],
        }),
      ).sentence,
    ).toBe("Kabel Fiber sampai 6 dari 10 roll.");
  });

  it("mengabaikan baris yang ditolak atasan", () => {
    expect(
      getRestockStatus(
        makeRequest({
          status: "RECEIVED",
          items: [
            makeItem({ receivedQuantity: 10 }),
            { ...ont, statusApproval: "REJECTED", orderedQuantity: 0 },
          ],
        }),
      ).sentence,
    ).toBe("Semua barang sudah sampai.");
  });

  it("menambahkan jasa yang belum ditandai selesai", () => {
    expect(
      getRestockStatus(
        makeRequest({
          status: "RECEIVED",
          items: [makeItem({ receivedQuantity: 10 })],
          jasaItems: [makeJasa()],
        }),
      ).sentence,
    ).toBe("Semua barang sudah sampai. Jasa belum ditandai selesai.");
  });

  it("pengajuan jasa saja: selesai, atau jasa masih belum ditandai", () => {
    const done = getRestockStatus(
      makeRequest({
        status: "RECEIVED",
        items: [],
        jasaItems: [makeJasa({ statusKonfirmasi: "SELESAI" })],
      }),
    );
    expect(done.sentence).toBe("Semua jasa sudah selesai.");

    const pending = getRestockStatus(
      makeRequest({ status: "RECEIVED", items: [], jasaItems: [makeJasa()] }),
    );
    expect(pending.sentence).toBe("Jasa belum ditandai selesai.");
  });

  it("mengikuti pesanan yang sudah selesai walau pengajuannya masih terbuka", () => {
    expect(
      getRestockStatus(
        makeRequest({
          status: "ORDERED",
          purchaseOrder: { id: "po-1", status: "RECEIVED" },
          items: [makeItem({ receivedQuantity: 6 })],
        }),
      ),
    ).toMatchObject({
      key: "RECEIVED",
      sentence: "Kabel Fiber sampai 6 dari 10 roll.",
    });
  });

  it("menganggap data lama tanpa sisa sebagai sudah dimasukkan", () => {
    expect(
      getRestockStatus(
        makeRequest({
          status: "ORDERED",
          items: [makeItem({ receivedQuantity: 10 })],
        }),
      ).key,
    ).toBe("RECEIVED");
  });
});

describe("getRestockStatus — ditolak dan dibatalkan", () => {
  it("menulis alasan penolakan atasan bila ada", () => {
    expect(
      getRestockStatus(
        makeRequest({
          status: "REJECTED",
          purchaseOrder: null,
          catatanApproval: " Stok masih cukup ",
        }),
      ),
    ).toMatchObject({
      key: "REJECTED",
      label: "Ditolak",
      sentence: "Pengajuan ini ditolak. Alasan: Stok masih cukup",
    });
    expect(
      getRestockStatus(makeRequest({ status: "REJECTED", purchaseOrder: null }))
        .sentence,
    ).toBe("Pengajuan ini ditolak.");
  });

  it("menulis alasan pembatalan admin bila ada", () => {
    expect(
      getRestockStatus(
        makeRequest({
          status: "CANCELLED",
          cancelReason: "Barang sudah tidak dibutuhkan",
        }),
      ),
    ).toMatchObject({
      key: "CANCELLED",
      label: "Dibatalkan",
      sentence:
        "Pengajuan ini dibatalkan. Alasan: Barang sudah tidak dibutuhkan",
    });
    expect(
      getRestockStatus(makeRequest({ status: "CANCELLED" })).sentence,
    ).toBe("Pengajuan ini dibatalkan.");
  });

  it("menganggap pesanan yang dibatalkan sebagai pengajuan yang dibatalkan", () => {
    expect(
      getRestockStatus(
        makeRequest({
          status: "ORDERED",
          purchaseOrder: { id: "po-1", status: "CANCELLED" },
        }),
      ).key,
    ).toBe("CANCELLED");
  });

  it("memberi tiap status warna badge yang berbeda", () => {
    const classes = [
      makeRequest({ status: "DRAFT", purchaseOrder: null }),
      makeRequest(),
      makeRequest({ status: "RECEIVED" }),
      makeRequest({ status: "REJECTED" }),
      makeRequest({ status: "CANCELLED" }),
    ].map((request) => getRestockStatus(request).badgeClassName);
    expect(new Set(classes).size).toBe(5);
  });
});

describe("getRestockLineCancelReason", () => {
  it("tidak menulis alasan baku untuk sisa yang tidak sampai, termasuk versi lama", () => {
    expect(
      getRestockLineCancelReason({
        cancelReason: "Tidak sampai",
      }),
    ).toBeNull();
    expect(
      getRestockLineCancelReason({
        cancelReason: "Tidak dimasukkan ke gudang",
      }),
    ).toBeNull();
    expect(getRestockLineCancelReason({ cancelReason: null })).toBeNull();
    expect(getRestockLineCancelReason({ cancelReason: "  " })).toBeNull();
  });

  it("menulis alasan lain apa adanya, tanpa spasi di tepi", () => {
    expect(
      getRestockLineCancelReason({ cancelReason: " Barang habis di toko " }),
    ).toBe("Barang habis di toko");
  });
});
