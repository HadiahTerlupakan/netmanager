import { describe, expect, it } from "vitest";

import * as inventoryClient from "@/modules/inventory/client";
import { RESTOCK_EDITABLE_STATUSES as EDITABLE_STATUSES_FROM_ERRORS } from "@/modules/inventory/domain/restock-request-errors";
import * as restockStatus from "@/modules/inventory/domain/restock-request-status";
import {
  APPROVED_OPEN_RESTOCK_STATUSES,
  AWAITING_APPROVAL_RESTOCK_STATUSES,
  canCancelRestockRequest,
  canDeleteRestockRequest,
  canEditRestockRequest,
  canEnterRestockGoods,
  getRequestedQuantity,
  getRestockLineProgress,
  getRestockStatusKey,
  hasRestockEnteredAnything,
  hasRestockJasaDone,
  isNotEnteredCancelReason,
  isRestockClosed,
  isRestockLineRejected,
  isRestockMergedOrder,
  isRestockServiceOnly,
  NOT_ENTERED_CANCEL_REASON,
  RESTOCK_EDITABLE_STATUSES,
  RESTOCK_JASA_DONE_STATUS,
  RESTOCK_STATUS_LABELS,
  wasRestockLineSubstituted,
  type RestockStatusInput,
  type RestockStatusJasa,
  type RestockStatusLine,
} from "@/modules/inventory/domain/restock-request-status";

/** Baris barang yang belum punya angka pesanan. */
function line(overrides: Partial<RestockStatusLine> = {}): RestockStatusLine {
  return { jumlah: 10, barangId: "barang-1", ...overrides };
}

/** Baris barang yang pesanannya sudah dibuat saat disetujui. */
function orderedLine(
  overrides: Partial<RestockStatusLine> = {},
): RestockStatusLine {
  return line({
    orderedQuantity: 10,
    receivedQuantity: 0,
    cancelledQuantity: 0,
    ...overrides,
  });
}

/** Baris barang yang ditolak atasan saat persetujuan. */
function rejectedLine(
  overrides: Partial<RestockStatusLine> = {},
): RestockStatusLine {
  return line({
    barangId: "barang-ditolak",
    statusApproval: "REJECTED",
    ...overrides,
  });
}

function jasa(overrides: Partial<RestockStatusJasa> = {}): RestockStatusJasa {
  return { statusKonfirmasi: "PENDING", ...overrides };
}

function doneJasa(
  overrides: Partial<RestockStatusJasa> = {},
): RestockStatusJasa {
  return jasa({ statusKonfirmasi: RESTOCK_JASA_DONE_STATUS, ...overrides });
}

/** Pengajuan baru (DRAFT) yang menunggu persetujuan: satu barang, tanpa pesanan. */
function request(
  overrides: Partial<RestockStatusInput> = {},
): RestockStatusInput {
  return { status: "DRAFT", items: [line()], ...overrides };
}

/**
 * Pengajuan yang baru disetujui: pesanan dibuat otomatis (pengajuan ORDERED,
 * pesanan DRAFT) dan belum ada barang yang masuk.
 */
function approvedRequest(
  overrides: Partial<RestockStatusInput> = {},
): RestockStatusInput {
  return request({
    status: "ORDERED",
    purchaseOrderId: "po-1",
    purchaseOrder: { status: "DRAFT" },
    items: [orderedLine()],
    ...overrides,
  });
}

/** Disetujui, tetapi pesanannya gagal dibuat saat persetujuan. */
function approvedWithoutOrder(
  overrides: Partial<RestockStatusInput> = {},
): RestockStatusInput {
  return request({ status: "APPROVED", ...overrides });
}

/** Pengajuan jasa saja yang sudah disetujui dan jasanya belum selesai. */
function approvedServiceOnly(
  overrides: Partial<RestockStatusInput> = {},
): RestockStatusInput {
  return request({
    status: "APPROVED",
    items: [],
    jasaItems: [jasa()],
    ...overrides,
  });
}

/** Data lama: sudah disetujui dan dipesan, barangnya baru sampai sebagian. */
function partiallyReceivedLegacyRequest(): RestockStatusInput {
  return approvedRequest({
    purchaseOrder: { status: "PARTIAL" },
    items: [orderedLine({ receivedQuantity: 4 })],
    goodsReceipts: [{ id: "grn-1" }],
  });
}

/**
 * Pengajuan disetujui di pesanan gabungan (dipakai dua pengajuan): pesanan
 * sudah menerima barang pengajuan lain, pengajuan ini belum menerima apa pun
 * miliknya sendiri.
 */
function mergedOrderRequest(
  overrides: Partial<RestockStatusInput> = {},
): RestockStatusInput {
  return approvedRequest({
    purchaseOrder: { status: "PARTIAL", linkedRequestCount: 2 },
    items: [orderedLine({ orderedQuantity: 15, receivedQuantity: 5 })],
    goodsReceipts: [{ id: "grn-milik-pengajuan-lain" }],
    ...overrides,
  });
}

/** Data lama: semua barang sudah masuk tetapi pengajuannya belum ditutup. */
function settledLegacyRequest(): RestockStatusInput {
  return approvedRequest({
    purchaseOrder: { status: "PARTIAL" },
    items: [orderedLine({ receivedQuantity: 10 })],
    goodsReceipts: [{ id: "grn-1" }],
  });
}

describe("konstanta status restock", () => {
  it("menunggu persetujuan = DRAFT dan SUBMITTED", () => {
    expect(AWAITING_APPROVAL_RESTOCK_STATUSES).toEqual(["DRAFT", "SUBMITTED"]);
  });

  it("disetujui dan masih terbuka = APPROVED dan ORDERED", () => {
    expect(APPROVED_OPEN_RESTOCK_STATUSES).toEqual(["APPROVED", "ORDERED"]);
  });

  it("status yang boleh diubah tetap DRAFT dan SUBMITTED, juga lewat restock-request-errors", () => {
    expect(RESTOCK_EDITABLE_STATUSES).toEqual(["DRAFT", "SUBMITTED"]);
    expect(EDITABLE_STATUSES_FROM_ERRORS).toBe(RESTOCK_EDITABLE_STATUSES);
  });

  it("label status memakai kata yang dilihat pengguna", () => {
    expect(RESTOCK_STATUS_LABELS).toEqual({
      AWAITING_APPROVAL: "Menunggu Persetujuan",
      APPROVED: "Disetujui",
      RECEIVED: "Sudah Sampai",
      REJECTED: "Ditolak",
      CANCELLED: "Dibatalkan",
    });
  });

  it("alasan baku sisa yang tidak sampai", () => {
    expect(NOT_ENTERED_CANCEL_REASON).toBe("Tidak sampai");
  });

  it("mengenali alasan baku versi kini dan versi lama, bukan alasan lain", () => {
    expect(isNotEnteredCancelReason("Tidak sampai")).toBe(true);
    expect(isNotEnteredCancelReason("Tidak dimasukkan ke gudang")).toBe(true);
    expect(isNotEnteredCancelReason("Barang habis di toko")).toBe(false);
  });

  it("status jasa selesai sama dengan yang ditulis saat konfirmasi jasa", () => {
    expect(RESTOCK_JASA_DONE_STATUS).toBe("SELESAI");
  });
});

describe("isRestockLineRejected", () => {
  it.each([
    ["REJECTED", true],
    ["APPROVED", false],
    ["PENDING", false],
    [null, false],
    [undefined, false],
  ])("statusApproval %s → %s", (statusApproval, expected) => {
    expect(isRestockLineRejected(line({ statusApproval }))).toBe(expected);
  });

  it("berlaku juga untuk baris jasa", () => {
    expect(isRestockLineRejected(jasa({ statusApproval: "REJECTED" }))).toBe(
      true,
    );
    expect(isRestockLineRejected(jasa())).toBe(false);
  });
});

describe("getRestockLineProgress", () => {
  it("baris tanpa pesanan: dipesan = jumlah, belum ada yang masuk", () => {
    expect(getRestockLineProgress(line())).toEqual({
      ordered: 10,
      received: 0,
      cancelled: 0,
      remaining: 10,
    });
  });

  it("angka pesanan yang null dibaca seperti belum ada pesanan", () => {
    expect(
      getRestockLineProgress(
        line({
          orderedQuantity: null,
          receivedQuantity: null,
          cancelledQuantity: null,
        }),
      ),
    ).toEqual({ ordered: 10, received: 0, cancelled: 0, remaining: 10 });
  });

  it("pesanan gabungan: jumlah dipesan diambil dari pesanan, bukan baris", () => {
    expect(
      getRestockLineProgress(
        orderedLine({ orderedQuantity: 15, receivedQuantity: 5 }),
      ),
    ).toEqual({ ordered: 15, received: 5, cancelled: 0, remaining: 10 });
  });

  it("sisa = dipesan − masuk − dicoret", () => {
    expect(
      getRestockLineProgress(
        orderedLine({ receivedQuantity: 4, cancelledQuantity: 2 }),
      ),
    ).toEqual({ ordered: 10, received: 4, cancelled: 2, remaining: 4 });
  });

  it("sisa tidak pernah negatif saat barang masuk lebih banyak", () => {
    expect(
      getRestockLineProgress(orderedLine({ receivedQuantity: 12 })).remaining,
    ).toBe(0);
  });

  it("pengajuan tertutup: sisa dihitung tidak masuk", () => {
    expect(
      getRestockLineProgress(
        orderedLine({ receivedQuantity: 4, cancelledQuantity: 2 }),
        true,
      ),
    ).toEqual({ ordered: 10, received: 4, cancelled: 6, remaining: 0 });
  });

  it("pengajuan tertutup tanpa sisa: angka dicoret tidak berubah", () => {
    expect(
      getRestockLineProgress(
        orderedLine({ receivedQuantity: 8, cancelledQuantity: 2 }),
        true,
      ),
    ).toEqual({ ordered: 10, received: 8, cancelled: 2, remaining: 0 });
  });
});

describe("getRestockStatusKey", () => {
  describe("1. ditolak atasan", () => {
    it("REJECTED → REJECTED", () => {
      expect(getRestockStatusKey(request({ status: "REJECTED" }))).toBe(
        "REJECTED",
      );
    });

    it.each(["RECEIVED", "CANCELLED"])(
      "REJECTED menang atas pesanan %s",
      (orderStatus) => {
        expect(
          getRestockStatusKey(
            request({
              status: "REJECTED",
              purchaseOrder: { status: orderStatus },
            }),
          ),
        ).toBe("REJECTED");
      },
    );
  });

  describe("2. dibatalkan", () => {
    it("CANCELLED → CANCELLED", () => {
      expect(getRestockStatusKey(request({ status: "CANCELLED" }))).toBe(
        "CANCELLED",
      );
    });

    it.each(["APPROVED", "ORDERED"])(
      "pesanan CANCELLED menimpa status pengajuan %s",
      (status) => {
        expect(
          getRestockStatusKey(
            approvedRequest({ status, purchaseOrder: { status: "CANCELLED" } }),
          ),
        ).toBe("CANCELLED");
      },
    );

    it("pembatalan pesanan diperiksa sebelum status selesai pengajuan", () => {
      expect(
        getRestockStatusKey(
          approvedRequest({
            status: "RECEIVED",
            purchaseOrder: { status: "CANCELLED" },
          }),
        ),
      ).toBe("CANCELLED");
    });
  });

  describe("3. sudah dimasukkan", () => {
    it("RECEIVED → RECEIVED walau sisanya tidak dimasukkan dan pesanan gabungannya masih terbuka", () => {
      expect(
        getRestockStatusKey(
          approvedRequest({
            status: "RECEIVED",
            purchaseOrder: { status: "PARTIAL" },
            items: [orderedLine({ receivedQuantity: 6 })],
          }),
        ),
      ).toBe("RECEIVED");
    });

    it("jasa saja yang jasanya sudah dikonfirmasi semua → RECEIVED", () => {
      expect(
        getRestockStatusKey(
          approvedServiceOnly({
            status: "RECEIVED",
            jasaItems: [doneJasa()],
          }),
        ),
      ).toBe("RECEIVED");
    });

    it.each(["APPROVED", "ORDERED"])(
      "pesanan RECEIVED menimpa status pengajuan %s",
      (status) => {
        expect(
          getRestockStatusKey(
            approvedRequest({ status, purchaseOrder: { status: "RECEIVED" } }),
          ),
        ).toBe("RECEIVED");
      },
    );
  });

  describe("4. menunggu persetujuan", () => {
    it.each(["DRAFT", "SUBMITTED"])("%s → AWAITING_APPROVAL", (status) => {
      expect(getRestockStatusKey(request({ status }))).toBe(
        "AWAITING_APPROVAL",
      );
    });

    it("barang yang tampak sudah masuk semua tidak membuatnya selesai", () => {
      expect(
        getRestockStatusKey(
          request({ items: [orderedLine({ receivedQuantity: 10 })] }),
        ),
      ).toBe("AWAITING_APPROVAL");
    });
  });

  describe("5. disetujui dan semua barangnya sudah beres (data lama/gabungan)", () => {
    it.each(["APPROVED", "ORDERED"])(
      "%s yang semua barangnya sudah masuk → RECEIVED",
      (status) => {
        expect(getRestockStatusKey({ ...settledLegacyRequest(), status })).toBe(
          "RECEIVED",
        );
      },
    );

    it("sebagian masuk dan sisanya dicoret → RECEIVED", () => {
      expect(
        getRestockStatusKey(
          approvedRequest({
            purchaseOrder: { status: "PARTIAL" },
            items: [orderedLine({ receivedQuantity: 7, cancelledQuantity: 3 })],
          }),
        ),
      ).toBe("RECEIVED");
    });

    it("pesanan gabungan lunas di tingkat pesanan → RECEIVED", () => {
      expect(
        getRestockStatusKey(
          approvedRequest({
            purchaseOrder: { status: "PARTIAL" },
            items: [
              orderedLine({
                jumlah: 4,
                orderedQuantity: 9,
                receivedQuantity: 9,
              }),
            ],
          }),
        ),
      ).toBe("RECEIVED");
    });

    it("baris yang ditolak tidak ikut dihitung sebagai sisa", () => {
      expect(
        getRestockStatusKey(
          approvedRequest({
            items: [rejectedLine(), orderedLine({ receivedQuantity: 10 })],
          }),
        ),
      ).toBe("RECEIVED");
    });
  });

  describe("6. selain itu: disetujui, menunggu barang dimasukkan", () => {
    it.each<[string, RestockStatusInput]>([
      ["baru disetujui, pesanan DRAFT", approvedRequest()],
      [
        "pesanan sudah diproses, belum ada yang masuk",
        approvedRequest({ purchaseOrder: { status: "ORDERED" } }),
      ],
      ["pesanannya gagal dibuat saat persetujuan", approvedWithoutOrder()],
      ["data lama yang baru masuk sebagian", partiallyReceivedLegacyRequest()],
      [
        "pesanan gabungan yang masih punya sisa",
        approvedRequest({
          purchaseOrder: { status: "PARTIAL" },
          items: [
            orderedLine({ jumlah: 4, orderedQuantity: 9, receivedQuantity: 4 }),
          ],
        }),
      ],
      ["jasa saja yang jasanya belum selesai", approvedServiceOnly()],
      [
        "jasa saja tidak pernah selesai lewat aturan barang",
        approvedServiceOnly({ jasaItems: [doneJasa()] }),
      ],
      [
        "barangnya ditolak semua, hanya jasa yang disetujui",
        approvedWithoutOrder({
          items: [rejectedLine({ orderedQuantity: 0 })],
          jasaItems: [jasa()],
        }),
      ],
      [
        "status di luar daftar tidak selesai lewat aturan barang",
        { ...settledLegacyRequest(), status: "UNKNOWN" },
      ],
    ])("%s → APPROVED", (_label, input) => {
      expect(getRestockStatusKey(input)).toBe("APPROVED");
    });
  });
});

describe("isRestockClosed", () => {
  it.each<[string, RestockStatusInput, boolean]>([
    ["menunggu persetujuan", request(), false],
    ["disetujui", approvedRequest(), false],
    ["data lama yang masuk sebagian", partiallyReceivedLegacyRequest(), false],
    ["sudah dimasukkan", request({ status: "RECEIVED" }), true],
    [
      "data lama yang barangnya sudah masuk semua",
      settledLegacyRequest(),
      true,
    ],
    [
      "pesanan dibatalkan",
      approvedRequest({ purchaseOrder: { status: "CANCELLED" } }),
      true,
    ],
    ["dibatalkan", request({ status: "CANCELLED" }), true],
    ["ditolak", request({ status: "REJECTED" }), true],
  ])("%s → %s", (_label, input, expected) => {
    expect(isRestockClosed(input)).toBe(expected);
  });
});

describe("hasRestockEnteredAnything", () => {
  it("pengajuan baru belum menerima apa pun", () => {
    expect(hasRestockEnteredAnything(request())).toBe(false);
  });

  it("pengajuan yang baru disetujui belum menerima apa pun", () => {
    expect(hasRestockEnteredAnything(approvedRequest())).toBe(false);
  });

  it("ada catatan barang masuk", () => {
    expect(
      hasRestockEnteredAnything(
        approvedRequest({ goodsReceipts: [{ id: "grn-1" }] }),
      ),
    ).toBe(true);
  });

  it.each([[[]], [null]])(
    "catatan barang masuk %j tidak dihitung",
    (goodsReceipts) => {
      expect(
        hasRestockEnteredAnything(approvedRequest({ goodsReceipts })),
      ).toBe(false);
    },
  );

  it("ada baris barang yang sudah diterima", () => {
    expect(
      hasRestockEnteredAnything(
        approvedRequest({ items: [orderedLine({ receivedQuantity: 1 })] }),
      ),
    ).toBe(true);
  });

  it("baris yang ditolak tidak dihitung walau tercatat diterima", () => {
    expect(
      hasRestockEnteredAnything(
        approvedRequest({ items: [rejectedLine({ receivedQuantity: 3 })] }),
      ),
    ).toBe(false);
  });

  it("ada jasa yang sudah dikonfirmasi selesai", () => {
    expect(
      hasRestockEnteredAnything(
        approvedRequest({ jasaItems: [jasa(), doneJasa()] }),
      ),
    ).toBe(true);
  });

  it("jasa yang ditolak tidak dihitung walau bertanda selesai", () => {
    expect(
      hasRestockEnteredAnything(
        approvedRequest({
          jasaItems: [doneJasa({ statusApproval: "REJECTED" })],
        }),
      ),
    ).toBe(false);
  });

  it("jasaItems null dibaca sebagai tanpa jasa", () => {
    expect(
      hasRestockEnteredAnything(approvedRequest({ jasaItems: null })),
    ).toBe(false);
  });
});

describe("isRestockMergedOrder", () => {
  it.each<[string, RestockStatusInput["purchaseOrder"], boolean]>([
    [
      "dipakai dua pengajuan",
      { status: "ORDERED", linkedRequestCount: 2 },
      true,
    ],
    [
      "dipakai satu pengajuan",
      { status: "ORDERED", linkedRequestCount: 1 },
      false,
    ],
    ["jumlah pengajuan tidak diketahui", { status: "ORDERED" }, false],
    ["tanpa pesanan", null, false],
    ["pesanan tidak dimuat", undefined, false],
  ])("%s → %s", (_label, purchaseOrder, expected) => {
    expect(isRestockMergedOrder({ purchaseOrder })).toBe(expected);
  });
});

describe("hasRestockJasaDone", () => {
  it.each<[string, RestockStatusJasa[] | null, boolean]>([
    ["ada jasa yang selesai", [jasa(), doneJasa()], true],
    ["jasanya belum selesai", [jasa()], false],
    [
      "jasa selesai yang ditolak tidak dihitung",
      [doneJasa({ statusApproval: "REJECTED" })],
      false,
    ],
    ["tanpa jasa", null, false],
  ])("%s → %s", (_label, jasaItems, expected) => {
    expect(hasRestockJasaDone(approvedRequest({ jasaItems }))).toBe(expected);
  });
});

describe("isRestockServiceOnly", () => {
  it.each<[string, RestockStatusInput, boolean]>([
    ["jasa saja", approvedServiceOnly(), true],
    [
      "barangnya ditolak semua, jasanya tidak",
      approvedWithoutOrder({ items: [rejectedLine()], jasaItems: [jasa()] }),
      true,
    ],
    ["barang dan jasa", approvedRequest({ jasaItems: [jasa()] }), false],
    ["barang saja", approvedRequest(), false],
    [
      "tanpa barang, jasanya ditolak semua",
      approvedServiceOnly({
        jasaItems: [jasa({ statusApproval: "REJECTED" })],
      }),
      false,
    ],
    ["kosong", request({ items: [], jasaItems: null }), false],
  ])("%s → %s", (_label, input, expected) => {
    expect(isRestockServiceOnly(input)).toBe(expected);
  });
});

describe("canEnterRestockGoods", () => {
  it.each<[string, RestockStatusInput, boolean]>([
    ["baru disetujui, pesanan DRAFT", approvedRequest(), true],
    [
      "pesanan sudah diproses",
      approvedRequest({ purchaseOrder: { status: "ORDERED" } }),
      true,
    ],
    ["pesanannya gagal dibuat saat persetujuan", approvedWithoutOrder(), true],
    ["data lama yang masih punya sisa", partiallyReceivedLegacyRequest(), true],
    ["barang dan jasa", approvedRequest({ jasaItems: [jasa()] }), true],
    [
      "sebagian baris ditolak",
      approvedRequest({ items: [rejectedLine(), orderedLine()] }),
      true,
    ],
    ["DRAFT menunggu persetujuan", request(), false],
    ["SUBMITTED menunggu persetujuan", request({ status: "SUBMITTED" }), false],
    ["jasa saja", approvedServiceOnly(), false],
    [
      "barangnya ditolak semua",
      approvedWithoutOrder({ items: [rejectedLine()], jasaItems: [jasa()] }),
      false,
    ],
    [
      "data lama yang semua barangnya sudah masuk",
      settledLegacyRequest(),
      false,
    ],
    [
      "pesanan RECEIVED menimpa pengajuan terbuka",
      approvedRequest({ purchaseOrder: { status: "RECEIVED" } }),
      false,
    ],
    [
      "pesanan CANCELLED menimpa pengajuan terbuka",
      approvedRequest({ purchaseOrder: { status: "CANCELLED" } }),
      false,
    ],
    ["sudah dimasukkan", request({ status: "RECEIVED" }), false],
    ["dibatalkan", request({ status: "CANCELLED" }), false],
    ["ditolak", request({ status: "REJECTED" }), false],
  ])("%s → %s", (_label, input, expected) => {
    expect(canEnterRestockGoods(input)).toBe(expected);
  });
});

describe("canCancelRestockRequest", () => {
  it.each<[string, RestockStatusInput, boolean]>([
    ["baru disetujui, pesanan DRAFT", approvedRequest(), true],
    [
      "pesanan sudah diproses, belum ada yang masuk",
      approvedRequest({ purchaseOrder: { status: "ORDERED" } }),
      true,
    ],
    ["pesanannya gagal dibuat saat persetujuan", approvedWithoutOrder(), true],
    ["jasa saja yang belum selesai", approvedServiceOnly(), true],
    ["DRAFT menunggu persetujuan", request(), false],
    ["SUBMITTED menunggu persetujuan", request({ status: "SUBMITTED" }), false],
    [
      "data lama yang sudah menerima sebagian",
      partiallyReceivedLegacyRequest(),
      false,
    ],
    [
      "sudah ada catatan barang masuk",
      approvedRequest({ goodsReceipts: [{ id: "grn-1" }] }),
      false,
    ],
    [
      "ada jasa yang sudah selesai",
      approvedRequest({ jasaItems: [doneJasa()] }),
      false,
    ],
    [
      "pesanan RECEIVED menimpa pengajuan terbuka",
      approvedRequest({ purchaseOrder: { status: "RECEIVED" } }),
      false,
    ],
    [
      "pesanan CANCELLED menimpa pengajuan terbuka",
      approvedRequest({ purchaseOrder: { status: "CANCELLED" } }),
      false,
    ],
    ["sudah dimasukkan", request({ status: "RECEIVED" }), false],
    ["sudah dibatalkan", request({ status: "CANCELLED" }), false],
    ["ditolak", request({ status: "REJECTED" }), false],
    [
      "pesanan gabungan: barang masuk milik pengajuan lain tidak menahan",
      mergedOrderRequest(),
      true,
    ],
    [
      "pesanan gabungan: jasa pengajuan ini yang sudah selesai tetap menahan",
      mergedOrderRequest({ jasaItems: [doneJasa()] }),
      false,
    ],
    [
      "pesanan gabungan yang sudah selesai tetap tidak bisa dibatalkan",
      mergedOrderRequest({
        purchaseOrder: { status: "RECEIVED", linkedRequestCount: 2 },
      }),
      false,
    ],
    [
      "pesanan milik satu pengajuan dengan catatan barang masuk tetap menahan",
      mergedOrderRequest({
        purchaseOrder: { status: "PARTIAL", linkedRequestCount: 1 },
      }),
      false,
    ],
  ])("%s → %s", (_label, input, expected) => {
    expect(canCancelRestockRequest(input)).toBe(expected);
  });
});

describe("canEditRestockRequest", () => {
  it.each(["DRAFT", "SUBMITTED"])("%s tanpa pesanan boleh diubah", (status) => {
    expect(
      canEditRestockRequest(request({ status, jasaItems: [jasa()] })),
    ).toBe(true);
  });

  it("pengajuan barang saja tanpa daftar jasa boleh diubah", () => {
    expect(canEditRestockRequest(request({ jasaItems: undefined }))).toBe(true);
  });

  it.each(["APPROVED", "ORDERED", "RECEIVED", "CANCELLED", "REJECTED"])(
    "%s tidak boleh diubah",
    (status) => {
      expect(canEditRestockRequest(request({ status }))).toBe(false);
    },
  );

  it("sudah punya pesanan (hanya id) → tidak boleh diubah", () => {
    expect(canEditRestockRequest(request({ purchaseOrderId: "po-1" }))).toBe(
      false,
    );
  });

  it("sudah punya pesanan (objek pesanan) → tidak boleh diubah", () => {
    expect(
      canEditRestockRequest(request({ purchaseOrder: { status: "DRAFT" } })),
    ).toBe(false);
  });
});

describe("canDeleteRestockRequest", () => {
  it.each<[string, RestockStatusInput, boolean]>([
    ["DRAFT menunggu persetujuan", request(), true],
    ["SUBMITTED menunggu persetujuan", request({ status: "SUBMITTED" }), true],
    ["dibatalkan", request({ status: "CANCELLED" }), true],
    ["ditolak", request({ status: "REJECTED" }), true],
    ["disetujui, pesanan masih DRAFT", approvedRequest(), true],
    ["disetujui tanpa pesanan", approvedWithoutOrder(), true],
    ["sudah dimasukkan", request({ status: "RECEIVED" }), false],
    [
      "pesanan sudah diproses",
      approvedRequest({ purchaseOrder: { status: "ORDERED" } }),
      false,
    ],
    [
      "status pesanan tidak diketahui (hanya id)",
      approvedRequest({ purchaseOrder: null }),
      false,
    ],
    [
      "pesanan DRAFT tetapi sudah ada barang masuk",
      approvedRequest({
        items: [orderedLine({ receivedQuantity: 2 })],
        goodsReceipts: [{ id: "grn-1" }],
      }),
      false,
    ],
    [
      "ada jasa yang sudah selesai",
      approvedWithoutOrder({ jasaItems: [doneJasa()] }),
      false,
    ],
  ])("%s → %s", (_label, input, expected) => {
    expect(canDeleteRestockRequest(input)).toBe(expected);
  });
});

describe("getRequestedQuantity", () => {
  it("memakai jumlah yang semula diajukan bila atasan mengubahnya", () => {
    expect(getRequestedQuantity({ jumlah: 8, jumlahDiminta: 10 })).toBe(10);
  });

  it.each([null, undefined])(
    "jumlahDiminta %s → jumlah baris",
    (jumlahDiminta) => {
      expect(getRequestedQuantity({ jumlah: 8, jumlahDiminta })).toBe(8);
    },
  );
});

describe("wasRestockLineSubstituted", () => {
  it.each<[string | null | undefined, boolean]>([
    ["barang-asal", true],
    ["barang-1", false],
    [null, false],
    [undefined, false],
    ["", false],
  ])("barangIdDiminta %j → %s", (barangIdDiminta, expected) => {
    expect(
      wasRestockLineSubstituted({ barangId: "barang-1", barangIdDiminta }),
    ).toBe(expected);
  });
});

describe("public API client", () => {
  it("modules/inventory/client mengekspor semua nilai modul status", () => {
    const clientExports: Record<string, unknown> = inventoryClient;
    for (const [name, value] of Object.entries(restockStatus)) {
      expect(clientExports[name], name).toBe(value);
    }
  });
});
