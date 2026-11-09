import { describe, expect, it } from "vitest";

import {
  canDeleteRestockRequest,
  getRestockProgress,
  getRestockPurchaseStep,
  isRestockPurchased,
} from "@/app/admin/inventory/restock/restockProgress";
import {
  buildPurchaseVoidUrl,
  canSendRestockPurchaseLink,
  hasRestockItemsToBuy,
  isRestockMergedOrder,
  describeLinePurchaseBreakdown,
  describePurchaseRecordContents,
  describePurchaseRecordVoid,
  getAllRestockPurchaseRecords,
  getRestockLinePurchase,
  getRestockPurchaseRecords,
  hasRestockPurchaseActivity,
  getRestockPurchaseState,
  isRestockLegacyPurchased,
  canCloseRestockUnpurchased,
  canRestockReceiveWithoutPurchaseReport,
  canVoidRestockPurchaseRecord,
  getRestockLineReceiveLimit,
  hasRestockItemsAwaitingArrival,
} from "@/app/admin/inventory/restock/restockPurchase";
import { LEGACY_PURCHASE_CASES } from "../modules/inventory/restock-legacy-purchase-cases";
import type {
  PurchaseRecordSummary,
  PurchaseRequest,
  PurchaseRequestItem,
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
    purchaseOrderItemId: "poi-1",
    purchasedQuantity: 0,
    barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
    ...overrides,
  };
}

const ont = (overrides: Partial<PurchaseRequestItem> = {}) =>
  makeItem({
    id: "item-2",
    barangId: "barang-2",
    purchaseOrderItemId: "poi-2",
    barang: { nama: "ONT", kode: "BRG-2", satuan: "pcs" },
    ...overrides,
  });

function makeRecord(
  overrides: Partial<PurchaseRecordSummary> = {},
): PurchaseRecordSummary {
  return {
    id: "rec-1",
    storeName: "Toko A",
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
        unitPrice: 12000,
      },
    ],
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
    purchaseRecords: [],
    items: [makeItem()],
    ...overrides,
  };
}

const ordered = { id: "po-1", poNumber: "PO-1", status: "ORDERED" };

describe("status belanja di daftar pengajuan", () => {
  it("bergerak dari Belum Dibeli, Dibeli Sebagian, sampai Sudah Dibeli Semua", () => {
    const none = getRestockProgress(makeRequest());
    expect(none.key).toBe("NOT_PURCHASED");
    expect(none.label).toBe("Belum Dibeli");

    const partialQuantity = getRestockProgress(
      makeRequest({
        purchaseOrder: ordered,
        purchaseRecords: [makeRecord()],
        items: [makeItem({ purchasedQuantity: 3 })],
      }),
    );
    expect(partialQuantity.key).toBe("PURCHASING");
    expect(partialQuantity.label).toBe("Dibeli Sebagian");
    expect(partialQuantity.sentence).toBe(
      "Kabel Fiber dibeli 3 dari 10 roll. Sisanya menunggu laporan belanja dari link. Barang yang sudah dibeli bisa dicatat datang.",
    );
    expect(partialQuantity.badgeClassName).toContain("bg-sky-100");

    const partialKinds = getRestockProgress(
      makeRequest({
        purchaseOrder: ordered,
        purchaseRecords: [makeRecord()],
        items: [makeItem({ purchasedQuantity: 10 }), ont()],
      }),
    );
    expect(partialKinds.key).toBe("PURCHASING");
    expect(partialKinds.sentence).toBe(
      "Kabel Fiber dibeli 10 dari 10 roll. ONT dibeli 0 dari 10 pcs. Sisanya menunggu laporan belanja dari link. Barang yang sudah dibeli bisa dicatat datang.",
    );

    const all = getRestockProgress(
      makeRequest({
        purchaseOrder: ordered,
        purchaseRecords: [makeRecord()],
        items: [makeItem({ purchasedQuantity: 10 })],
      }),
    );
    expect(all.key).toBe("PURCHASED");
    expect(all.label).toBe("Menunggu Barang");
  });

  it("meringkas per jenis barang bila lebih dari dua barang", () => {
    const progress = getRestockProgress(
      makeRequest({
        purchaseOrder: ordered,
        purchaseRecords: [makeRecord()],
        items: [
          makeItem({ purchasedQuantity: 10 }),
          ont({ purchasedQuantity: 2 }),
          ont({ id: "item-3", purchaseOrderItemId: "poi-3" }),
        ],
      }),
    );
    expect(progress.sentence).toBe(
      "Dari 3 jenis barang: 1 sudah dibeli semua, 1 baru dibeli sebagian, 1 belum dibeli. Sisanya menunggu laporan belanja dari link. Barang yang sudah dibeli bisa dicatat datang.",
    );
  });

  it("tidak menulis 0 sudah dibeli seolah belum ada yang dibeli", () => {
    const progress = getRestockProgress(
      makeRequest({
        purchaseOrder: ordered,
        purchaseRecords: [makeRecord()],
        items: [
          makeItem({ purchasedQuantity: 1 }),
          ont({ purchasedQuantity: 2 }),
          ont({
            id: "item-3",
            purchaseOrderItemId: "poi-3",
            purchasedQuantity: 3,
          }),
        ],
      }),
    );
    expect(progress.label).toBe("Dibeli Sebagian");
    expect(progress.sentence).toBe(
      "Dari 3 jenis barang: 0 sudah dibeli semua, 3 baru dibeli sebagian. Sisanya menunggu laporan belanja dari link. Barang yang sudah dibeli bisa dicatat datang.",
    );
  });

  it("membaca pesanan lama yang sudah berjalan tanpa catatan sebagai sudah dibeli semua", () => {
    for (const purchaseOrder of [
      ordered,
      { id: "po-1", status: "DRAFT", issuedAt: "2026-11-08T05:00:00.000Z" },
    ]) {
      const request = makeRequest({ purchaseOrder });
      expect(isRestockLegacyPurchased(request)).toBe(true);
      expect(getRestockPurchaseState(request)).toBe("ALL");
      expect(getRestockProgress(request).key).toBe("PURCHASED");
      expect(hasRestockItemsToBuy(request)).toBe(false);
    }
  });

  it("pesanan lama yang ditandai dibeli sebelum barang datang tidak mundur statusnya", () => {
    const request = makeRequest({
      purchaseOrder: {
        ...ordered,
        status: "PARTIAL",
        issuedAt: "2026-11-02T03:00:00.000Z",
        goodsReceipts: [
          {
            id: "grn-1",
            grnNumber: "GRN-1",
            fotoBukti: [],
            receivedAt: "2026-11-04T03:00:00.000Z",
          },
        ],
      },
      items: [makeItem({ receivedQuantity: 3 })],
    });
    expect(isRestockLegacyPurchased(request)).toBe(true);
    expect(getRestockPurchaseState(request)).toBe("ALL");
    expect(hasRestockItemsToBuy(request)).toBe(false);
    expect(getRestockProgress(request).sentence).not.toContain("belum dibeli");
  });

  it("barang datang lewat alur lama tetap data lama walau tanggal beli diisi sesudahnya", () => {
    const request = makeRequest({
      purchaseOrder: {
        ...ordered,
        status: "PARTIAL",
        issuedAt: "2026-11-04T03:00:01.000Z",
        goodsReceipts: [
          {
            id: "grn-1",
            grnNumber: "GRN-1",
            fotoBukti: [],
            receivedAt: "2026-11-04T03:00:00.000Z",
          },
        ],
      },
      items: [makeItem({ receivedQuantity: 3 })],
    });
    expect(isRestockLegacyPurchased(request)).toBe(true);
    expect(getRestockPurchaseState(request)).toBe("ALL");
    expect(hasRestockItemsToBuy(request)).toBe(false);
  });

  it("barang yang datang tanpa catatan belanja (mis. dari halaman Pembelian) adalah data lama", () => {
    const request = makeRequest({
      purchaseOrder: { ...ordered, status: "PARTIAL" },
      items: [makeItem({ receivedQuantity: 4 })],
    });
    expect(isRestockLegacyPurchased(request)).toBe(true);
    expect(getRestockLinePurchase(request.items[0], false)).toMatchObject({
      limit: 10,
      purchased: 4,
      remainingToBuy: 6,
    });
    // Data lama dianggap sudah dibeli semua: sisanya tetap bisa dicatat
    // datang tanpa laporan belanja, dan link tidak ditawarkan.
    expect(getRestockPurchaseState(request)).toBe("ALL");
    expect(hasRestockItemsToBuy(request)).toBe(false);
    const progress = getRestockProgress(request);
    expect(progress).toMatchObject({
      key: "PARTIAL",
      stage: 4,
      label: "Datang Sebagian",
    });
    expect(progress.sentence).toBe(
      "Kabel Fiber datang 4 dari 10 roll. Masih ditunggu 6 roll.",
    );
    expect(isRestockPurchased(request)).toBe(true);
  });

  it("tidak menambah kalimat belum dibeli bila semua sudah dibeli", () => {
    const progress = getRestockProgress(
      makeRequest({
        purchaseOrder: { ...ordered, status: "PARTIAL" },
        purchaseRecords: [makeRecord()],
        items: [makeItem({ purchasedQuantity: 10, receivedQuantity: 4 })],
      }),
    );
    expect(progress.sentence).toBe(
      "Kabel Fiber datang 4 dari 10 roll. Masih ditunggu 6 roll.",
    );
  });

  it("membatasi jumlah dibeli ke jumlah pesanan setelah pesanan dikurangi", () => {
    expect(
      getRestockLinePurchase(
        makeItem({ orderedQuantity: 5, purchasedQuantity: 8 }),
        false,
      ),
    ).toMatchObject({ limit: 5, purchased: 5, remainingToBuy: 0 });
    expect(
      getRestockLinePurchase(
        makeItem({ cancelledQuantity: 4, purchasedQuantity: 3 }),
        false,
      ),
    ).toMatchObject({ limit: 6, purchased: 3, remainingToBuy: 3 });
  });

  it("tidak menghitung baris yang ditolak atasan", () => {
    const request = makeRequest({
      purchaseOrder: ordered,
      purchaseRecords: [makeRecord()],
      items: [
        makeItem({ purchasedQuantity: 10 }),
        ont({ statusApproval: "REJECTED", purchaseOrderItemId: null }),
      ],
    });
    expect(getRestockPurchaseState(request)).toBe("ALL");
  });
});

describe("hasRestockItemsToBuy", () => {
  it("hanya muncul bila masih ada barang yang bisa dibeli", () => {
    expect(hasRestockItemsToBuy(makeRequest())).toBe(true);
    expect(hasRestockItemsToBuy(makeRequest({ purchaseOrder: null }))).toBe(
      false,
    );
    for (const status of ["RECEIVED", "CANCELLED"]) {
      expect(
        hasRestockItemsToBuy(
          makeRequest({ purchaseOrder: { id: "po-1", status } }),
        ),
      ).toBe(false);
    }
    expect(hasRestockItemsToBuy(makeRequest({ status: "RECEIVED" }))).toBe(
      false,
    );
    expect(
      hasRestockItemsToBuy(
        makeRequest({
          purchaseOrder: ordered,
          purchaseRecords: [makeRecord()],
          items: [makeItem({ purchasedQuantity: 10 })],
        }),
      ),
    ).toBe(false);
  });

  it("tidak muncul pada pengajuan jasa saja atau baris tanpa item pesanan", () => {
    expect(
      hasRestockItemsToBuy(
        makeRequest({
          items: [],
          jasaItems: [
            {
              id: "jasa-line-1",
              jasaId: "jasa-1",
              jumlah: 1,
              hargaPerUnit: 100,
              totalHarga: 100,
              statusKonfirmasi: "PENDING",
              jasa: {
                id: "jasa-1",
                kode: "J-1",
                nama: "Tarik Kabel",
                satuan: "titik",
              },
            },
          ],
        }),
      ),
    ).toBe(false);
    expect(
      hasRestockItemsToBuy(
        makeRequest({ items: [makeItem({ purchaseOrderItemId: null })] }),
      ),
    ).toBe(false);
  });
});

describe("canSendRestockPurchaseLink", () => {
  const merged = {
    id: "po-1",
    status: "DRAFT",
    _count: { purchaseRequests: 2 },
  };

  it("aksi utama selama masih ada barang yang belum dibeli", () => {
    expect(canSendRestockPurchaseLink(makeRequest())).toBe(true);
    expect(
      canSendRestockPurchaseLink(
        makeRequest({
          purchaseOrder: ordered,
          items: [makeItem({ purchasedQuantity: 10 })],
        }),
      ),
    ).toBe(false);
  });

  it("pesanan gabungan tidak memakai link; statusnya ikut barang datang", () => {
    const request = makeRequest({ purchaseOrder: merged });

    expect(isRestockMergedOrder(request)).toBe(true);
    expect(hasRestockItemsToBuy(request)).toBe(true);
    expect(canSendRestockPurchaseLink(request)).toBe(false);
    expect(getRestockProgress(request).sentence).toBe(
      "Pengajuan ini digabung dengan pengajuan lain dalam satu pesanan, jadi belanjanya tidak dicatat. Statusnya mengikuti barang yang datang. Barangnya bisa langsung dicatat datang.",
    );
  });

  it("belum dibeli mengarahkan ke link belanja", () => {
    expect(isRestockMergedOrder(makeRequest())).toBe(false);
    expect(getRestockProgress(makeRequest()).sentence).toBe(
      "Menunggu laporan belanja dari link. Barang baru bisa dicatat datang setelah dilaporkan dibeli.",
    );
  });
});

describe("rincian belanja", () => {
  it("menjumlahkan per toko dan menyebut sisa tanpa catatan belanja", () => {
    const request = makeRequest({
      purchaseOrder: ordered,
      purchaseRecords: [
        makeRecord(),
        makeRecord({
          id: "rec-2",
          storeName: "Toko B",
          items: [{ ...makeRecord().items[0], id: "ri-2", quantity: 2 }],
        }),
        makeRecord({
          id: "rec-3",
          items: [{ ...makeRecord().items[0], id: "ri-3", quantity: 1 }],
        }),
      ],
      items: [makeItem({ purchasedQuantity: 6, receivedQuantity: 8 })],
    });
    expect(describeLinePurchaseBreakdown(request.items[0], request)).toBe(
      "Toko A 4, Toko B 2, 2 lainnya tanpa catatan belanja",
    );
  });

  it("belanja tanpa nama toko dirinci per nama pembeli", () => {
    const request = makeRequest({
      purchaseOrder: ordered,
      purchaseRecords: [
        makeRecord({
          storeName: null,
          buyerName: "Budi",
          source: "PUBLIC_LINK",
        }),
        makeRecord({
          id: "rec-2",
          storeName: null,
          buyerName: "Andi",
          source: "PUBLIC_LINK",
          items: [{ ...makeRecord().items[0], id: "ri-2", quantity: 2 }],
        }),
        makeRecord({
          id: "rec-3",
          storeName: null,
          buyerName: "Budi",
          source: "PUBLIC_LINK",
          items: [{ ...makeRecord().items[0], id: "ri-3", quantity: 1 }],
        }),
      ],
      items: [makeItem({ purchasedQuantity: 6 })],
    });
    expect(describeLinePurchaseBreakdown(request.items[0], request)).toBe(
      "Budi 4, Andi 2",
    );
  });

  it("belanja sesudah barang datang tanpa catatan menghabiskan sisa", () => {
    // Dipesan 8, datang 5 tanpa catatan, lalu 3 dibeli di Toko B. Server
    // menaikkan jumlah dibeli dari GREATEST(dibeli, datang): 5 + 3 = 8.
    const request = makeRequest({
      purchaseOrder: { ...ordered, status: "PARTIAL" },
      purchaseRecords: [
        makeRecord({
          storeName: "Toko B",
          items: [{ ...makeRecord().items[0], quantity: 3 }],
        }),
      ],
      items: [
        makeItem({
          jumlah: 8,
          orderedQuantity: 8,
          receivedQuantity: 5,
          purchasedQuantity: 8,
        }),
      ],
    });
    expect(getRestockPurchaseState(request)).toBe("ALL");
    expect(hasRestockItemsToBuy(request)).toBe(false);
    expect(describeLinePurchaseBreakdown(request.items[0], request)).toBe(
      "Toko B 3, 5 lainnya tanpa catatan belanja",
    );
  });

  it("menyebut barang yang sudah dibeli tapi dicoret karena tidak dikirim", () => {
    const request = makeRequest({
      purchaseOrder: { ...ordered, status: "RECEIVED" },
      purchaseRecords: [
        makeRecord({ items: [{ ...makeRecord().items[0], quantity: 8 }] }),
      ],
      items: [
        makeItem({
          jumlah: 8,
          orderedQuantity: 8,
          receivedQuantity: 5,
          cancelledQuantity: 3,
          purchasedQuantity: 8,
        }),
      ],
    });
    expect(getRestockLinePurchase(request.items[0], false)).toEqual({
      limit: 5,
      purchased: 5,
      remainingToBuy: 0,
      purchasedTotal: 8,
      boughtButNotDelivered: 3,
    });
    expect(describeLinePurchaseBreakdown(request.items[0], request)).toBe(
      "Toko A 8",
    );
  });

  it("tidak memberi rincian bila belum ada yang dibeli", () => {
    const request = makeRequest();
    expect(describeLinePurchaseBreakdown(request.items[0], request)).toBeNull();
  });

  it("menulis barang yang datang tanpa catatan apa adanya", () => {
    const request = makeRequest({
      purchaseOrder: { ...ordered, status: "PARTIAL" },
      items: [makeItem({ receivedQuantity: 4 })],
    });
    expect(describeLinePurchaseBreakdown(request.items[0], request)).toBe(
      "10 tanpa catatan belanja",
    );
  });

  it("menulis isi belanja dengan harga bila ada", () => {
    const record = makeRecord({
      items: [
        makeRecord().items[0],
        {
          id: "ri-2",
          purchaseOrderItemId: "poi-2",
          barangId: "barang-2",
          nama: "ONT",
          satuan: "pcs",
          quantity: 2,
          unitPrice: null,
        },
      ],
    });
    expect(describePurchaseRecordContents(record)).toBe(
      "Kabel Fiber 3 roll @ Rp12.000, ONT 2 pcs",
    );
  });

  it("mengurutkan catatan belanja dari yang paling lama", () => {
    const records = getRestockPurchaseRecords(
      makeRequest({
        purchaseRecords: [
          makeRecord({ id: "late", purchasedAt: "2026-11-09T05:00:00.000Z" }),
          makeRecord({ id: "early", purchasedAt: "2026-11-07T05:00:00.000Z" }),
        ],
      }),
    );
    expect(records.map((record) => record.id)).toEqual(["early", "late"]);
  });
});

describe("langkah pembelian di riwayat", () => {
  it("tidak menambah langkah bila semua sudah tercatat lewat belanja", () => {
    expect(
      getRestockPurchaseStep(
        makeRequest({
          purchaseOrder: ordered,
          purchaseRecords: [makeRecord()],
          items: [makeItem({ purchasedQuantity: 10 })],
        }),
      ),
    ).toBeNull();
  });

  it("menunjukkan sisa yang belum dibeli selama pesanan berjalan", () => {
    expect(
      getRestockPurchaseStep(
        makeRequest({
          purchaseOrder: ordered,
          purchaseRecords: [makeRecord()],
          items: [makeItem({ purchasedQuantity: 3 })],
        }),
      ),
    ).toMatchObject({
      isDone: false,
      label: "Masih ada barang yang belum dibeli",
    });
  });

  it("barang yang datang tanpa catatan dicatat sebagai dibeli sekaligus (data lama)", () => {
    expect(
      getRestockPurchaseStep(
        makeRequest({
          purchaseOrder: { ...ordered, status: "RECEIVED" },
          status: "RECEIVED",
          items: [makeItem({ receivedQuantity: 10 })],
        }),
      ),
    ).toMatchObject({
      isDone: true,
      label: "Sudah dibeli semua (tanggal tidak tercatat)",
    });
  });

  it("pesanan gabungan: belanjanya tidak dicatat, bukan menunggu link", () => {
    const merged = {
      ...ordered,
      status: "DRAFT",
      _count: { purchaseRequests: 2 },
    };
    expect(
      getRestockPurchaseStep(makeRequest({ purchaseOrder: merged })),
    ).toMatchObject({
      isDone: true,
      label: "Belanja pesanan gabungan tidak dicatat",
    });
    expect(
      getRestockPurchaseStep(
        makeRequest({
          purchaseOrder: { ...merged, status: "RECEIVED" },
          status: "RECEIVED",
          items: [makeItem({ receivedQuantity: 10 })],
        }),
      )?.label,
    ).toBe("Belanja pesanan gabungan tidak dicatat");
  });

  it("tanpa daftar belanja: langkahnya menyebut daftar belanja belum ada", () => {
    expect(
      getRestockPurchaseStep(
        makeRequest({ status: "APPROVED", purchaseOrder: null }),
      ),
    ).toMatchObject({ isDone: false, label: "Daftar belanja belum ada" });
  });
});

describe("hapus pengajuan", () => {
  it("disembunyikan setelah ada belanja", () => {
    expect(canDeleteRestockRequest(makeRequest(), true)).toBe(true);
    expect(
      canDeleteRestockRequest(
        makeRequest({ items: [makeItem({ purchasedQuantity: 1 })] }),
        true,
      ),
    ).toBe(false);
    expect(
      canDeleteRestockRequest(
        makeRequest({ purchaseRecords: [makeRecord()] }),
        true,
      ),
    ).toBe(false);
  });
});

describe("catatan belanja yang dibatalkan", () => {
  const voided = makeRecord({
    id: "rec-batal",
    storeName: "Toko Nakal",
    voidedAt: "2026-11-09T02:00:00.000Z",
    voidedBy: { name: "Sari" },
    voidReason: "Bukan belanja kita",
    items: [{ ...makeRecord().items[0], id: "ri-batal", quantity: 5 }],
  });

  it("tidak dihitung di daftar catatan, tapi tetap ada untuk riwayat", () => {
    const request = makeRequest({
      purchaseOrder: ordered,
      purchaseRecords: [voided, makeRecord()],
    });

    expect(getRestockPurchaseRecords(request).map((r) => r.id)).toEqual([
      "rec-1",
    ]);
    expect(getAllRestockPurchaseRecords(request).map((r) => r.id)).toEqual([
      "rec-batal",
      "rec-1",
    ]);
  });

  it("tidak ikut rincian toko", () => {
    const request = makeRequest({
      purchaseOrder: ordered,
      purchaseRecords: [voided, makeRecord()],
      items: [makeItem({ purchasedQuantity: 3 })],
    });

    expect(describeLinePurchaseBreakdown(request.items[0], request)).toBe(
      "Toko A 3",
    );
  });

  it("hanya catatan batal tidak dianggap sudah ada belanja", () => {
    const request = makeRequest({
      purchaseOrder: ordered,
      purchaseRecords: [voided],
    });

    expect(hasRestockPurchaseActivity(request)).toBe(false);
  });

  it("membatalkan satu-satunya catatan mengembalikan pengajuan ke belum dibeli, bukan data lama", () => {
    const request = makeRequest({
      purchaseOrder: {
        ...ordered,
        issuedAt: "2026-11-08T05:00:00.000Z",
        processedBy: { name: "Sari" },
      },
      purchaseRecords: [voided],
      items: [makeItem({ purchasedQuantity: 0 })],
    });

    expect(isRestockLegacyPurchased(request)).toBe(false);
    expect(getRestockPurchaseState(request)).toBe("NONE");
    expect(hasRestockItemsToBuy(request)).toBe(true);
    expect(getRestockLinePurchase(request.items[0], false).remainingToBuy).toBe(
      10,
    );
    expect(getRestockPurchaseStep(request)).toMatchObject({
      isDone: false,
      label: "Tahap pembelian: menunggu laporan belanja dari link",
    });
  });

  it("kalimat riwayat menyebut siapa dan alasannya", () => {
    expect(describePurchaseRecordVoid(voided)).toBe(
      "Dibatalkan oleh Sari: Bukan belanja kita",
    );
    expect(
      describePurchaseRecordVoid({ voidedBy: null, voidReason: null }),
    ).toBe("Dibatalkan");
  });

  it("alamat API pembatalan di-encode", () => {
    expect(buildPurchaseVoidUrl("pr 1", "rec/1")).toBe(
      "/api/inventory/restock/requests/pr%201/purchases/rec%2F1/void",
    );
  });
});

describe("aturan data lama sama dengan server", () => {
  it.each(LEGACY_PURCHASE_CASES)("$name", (testCase) => {
    const request = makeRequest({
      status: "ORDERED",
      purchaseOrder: {
        id: "po-1",
        status: testCase.purchaseOrderStatus,
        issuedAt: testCase.issuedAt,
      },
      purchaseRecords: Array.from(
        { length: testCase.voidedRecordCount },
        (_, index) =>
          makeRecord({
            id: `rec-${index}`,
            voidedAt: "2026-10-02T00:00:00.000Z",
          }),
      ),
      goodsReceipts: testCase.firstReceiptAt
        ? [
            {
              id: "grn-1",
              grnNumber: "GRN-1",
              fotoBukti: [],
              receivedAt: testCase.firstReceiptAt,
            },
          ]
        : [],
      items: [
        makeItem({
          purchasedQuantity: testCase.purchasedQuantity,
          receivedQuantity: testCase.receivedQuantity,
        }),
      ],
    });

    expect(isRestockLegacyPurchased(request)).toBe(testCase.expected);
  });
});

describe("batas catat barang datang di layar", () => {
  it("hanya yang sudah dibeli dan belum datang pada pesanan lewat link", () => {
    const request = makeRequest({
      status: "ORDERED",
      purchaseOrder: ordered,
      items: [makeItem({ purchasedQuantity: 6, receivedQuantity: 2 })],
    });
    expect(canRestockReceiveWithoutPurchaseReport(request)).toBe(false);
    expect(getRestockLineReceiveLimit(request.items[0], request)).toBe(4);
    expect(hasRestockItemsAwaitingArrival(request)).toBe(true);
    expect(hasRestockItemsAwaitingArrival(makeRequest())).toBe(false);
  });

  it("seluruh sisa pada pesanan gabungan", () => {
    const request = makeRequest({
      purchaseOrder: {
        id: "po-1",
        status: "DRAFT",
        _count: { purchaseRequests: 2 },
      },
    });
    expect(canRestockReceiveWithoutPurchaseReport(request)).toBe(true);
    expect(getRestockLineReceiveLimit(request.items[0], request)).toBe(10);
  });
});

describe("canVoidRestockPurchaseRecord", () => {
  it("boleh bila barangnya belum datang", () => {
    const request = makeRequest({
      purchaseOrder: ordered,
      items: [makeItem({ purchasedQuantity: 3 })],
    });
    expect(canVoidRestockPurchaseRecord(makeRecord(), request)).toBe(true);
  });

  it("ditolak bila sesudah dibatalkan jumlah dibeli < jumlah datang", () => {
    const request = makeRequest({
      purchaseOrder: { ...ordered, status: "PARTIAL" },
      items: [makeItem({ purchasedQuantity: 3, receivedQuantity: 1 })],
    });
    expect(canVoidRestockPurchaseRecord(makeRecord(), request)).toBe(false);
  });

  it("boleh bila belanja lain masih menutup barang yang sudah datang", () => {
    const request = makeRequest({
      purchaseOrder: { ...ordered, status: "PARTIAL" },
      items: [makeItem({ purchasedQuantity: 8, receivedQuantity: 5 })],
    });
    expect(canVoidRestockPurchaseRecord(makeRecord(), request)).toBe(true);
  });
});

describe("canCloseRestockUnpurchased", () => {
  it("tersedia selama masih ada yang belum dibeli", () => {
    expect(canCloseRestockUnpurchased(makeRequest())).toBe(true);
    expect(
      canCloseRestockUnpurchased(
        makeRequest({
          purchaseOrder: ordered,
          items: [makeItem({ purchasedQuantity: 4 })],
        }),
      ),
    ).toBe(true);
  });

  it("tersedia walau daftar belanja belum ada", () => {
    expect(
      canCloseRestockUnpurchased(makeRequest({ purchaseOrder: null })),
    ).toBe(true);
  });

  it("tidak tersedia bila semua sudah dibeli, pesanan tutup, atau dikecualikan", () => {
    expect(
      canCloseRestockUnpurchased(
        makeRequest({
          purchaseOrder: ordered,
          items: [makeItem({ purchasedQuantity: 10 })],
        }),
      ),
    ).toBe(false);
    expect(
      canCloseRestockUnpurchased(
        makeRequest({ purchaseOrder: { ...ordered, status: "RECEIVED" } }),
      ),
    ).toBe(false);
    expect(
      canCloseRestockUnpurchased(
        makeRequest({
          purchaseOrder: {
            id: "po-1",
            status: "DRAFT",
            _count: { purchaseRequests: 2 },
          },
        }),
      ),
    ).toBe(false);
    expect(
      canCloseRestockUnpurchased(
        makeRequest({
          purchaseOrder: {
            ...ordered,
            issuedAt: "2026-10-01T00:00:00.000Z",
          },
        }),
      ),
    ).toBe(false);
    expect(
      canCloseRestockUnpurchased(makeRequest({ status: "SUBMITTED" })),
    ).toBe(false);
  });
});
