import { describe, expect, it } from "vitest";

import type {
  RestockPurchaseContext,
  RestockPurchaseContextItem,
} from "@/modules/inventory/domain/ports/IRestockPurchaseRecordRepository";
import {
  buildPurchaseLinkExpiry,
  describePurchaseLinkAvailability,
  evaluatePurchaseListState,
  getEarliestLinkPurchaseDate,
  getOwnedPurchaseItems,
  isMergedPurchaseOrder,
  isPurchaseLinkUsable,
  isSameLinkSubmission,
} from "@/modules/inventory/domain/restock-purchase-link";

const NOW = new Date("2026-11-09T03:00:00Z");

function item(
  overrides: Partial<RestockPurchaseContextItem> = {},
): RestockPurchaseContextItem {
  return {
    id: "poi-1",
    barangId: "barang-1",
    quantity: 10,
    cancelledQuantity: 0,
    receivedQuantity: 0,
    purchasedQuantity: 0,
    barang: { nama: "Kabel", satuan: "roll" },
    ...overrides,
  };
}

function context(
  options: {
    requestStatus?: string;
    orderStatus?: string | null;
    items?: RestockPurchaseContextItem[];
    receivable?: string[];
    linkedRequestCount?: number;
    isLegacyPurchased?: boolean;
  } = {},
): RestockPurchaseContext {
  return {
    request: {
      id: "pr-1",
      nomorRequest: "PR-1",
      status: options.requestStatus ?? "ORDERED",
      purchaseOrderId: "po-1",
      receivableBarangIds: options.receivable ?? ["barang-1"],
    },
    purchaseOrder:
      options.orderStatus === null
        ? null
        : {
            id: "po-1",
            poNumber: "PO-1",
            status: options.orderStatus ?? "ORDERED",
            tenantId: "tenant-1",
            linkedRequestCount: options.linkedRequestCount ?? 1,
            isLegacyPurchased: options.isLegacyPurchased ?? false,
            items: options.items ?? [item()],
          },
  };
}

describe("isPurchaseLinkUsable", () => {
  const base = {
    revokedAt: null as Date | null,
    expiresAt: new Date(NOW.getTime() + 1000),
    tenantId: "tenant-1",
    isCreatorActive: true,
  };

  it("sah bila belum dicabut, belum kedaluwarsa, punya tenant", () => {
    expect(isPurchaseLinkUsable(base, NOW)).toBe(true);
  });

  it.each([
    ["dicabut", { revokedAt: NOW }],
    ["kedaluwarsa", { expiresAt: NOW }],
    ["tanpa tenant", { tenantId: null }],
    ["pembuatnya nonaktif", { isCreatorActive: false }],
  ])("tidak sah bila %s", (_label, overrides) => {
    expect(isPurchaseLinkUsable({ ...base, ...overrides }, NOW)).toBe(false);
  });
});

describe("isSameLinkSubmission", () => {
  const stored = {
    buyerName: "Joko",
    storeName: "Toko Sinar",
    purchasedAt: new Date("2026-11-08T17:30:00Z"),
    notes: null as string | null,
    items: [
      { purchaseOrderItemId: "poi-2", quantity: 1, unitPrice: 5000 },
      { purchaseOrderItemId: "poi-1", quantity: 2, unitPrice: null },
    ],
  };
  const same = {
    buyerName: "Joko",
    storeName: "Toko Sinar",
    purchasedAt: "2026-11-09",
    notes: null as string | null,
    items: [
      { purchaseOrderItemId: "poi-1", quantity: 2, unitPrice: null },
      { purchaseOrderItemId: "poi-2", quantity: 1, unitPrice: 5000 },
    ],
  };

  it("sama walau urutan barang berbeda; tanggal dibandingkan waktu Jakarta", () => {
    expect(isSameLinkSubmission(stored, same)).toBe(true);
  });

  it.each([
    ["nama pembeli", { buyerName: "Andi" }],
    ["toko", { storeName: "Toko Lain" }],
    ["tanggal", { purchasedAt: "2026-11-08" }],
    ["catatan", { notes: "lunas" }],
    [
      "jumlah",
      {
        items: [{ purchaseOrderItemId: "poi-1", quantity: 3, unitPrice: null }],
      },
    ],
    [
      "harga",
      { items: [same.items[0], { ...same.items[1], unitPrice: 6000 }] },
    ],
  ])("berbeda bila %s berubah", (_label, change) => {
    expect(isSameLinkSubmission(stored, { ...same, ...change })).toBe(false);
  });
});

describe("evaluatePurchaseListState", () => {
  it.each(["DRAFT", "SUBMITTED", "REJECTED", "RECEIVED", "CANCELLED"])(
    "INACTIVE untuk pengajuan %s",
    (status) => {
      expect(
        evaluatePurchaseListState(context({ requestStatus: status })),
      ).toBe("INACTIVE");
    },
  );

  it.each(["RECEIVED", "CANCELLED"])("INACTIVE untuk pesanan %s", (status) => {
    expect(evaluatePurchaseListState(context({ orderStatus: status }))).toBe(
      "INACTIVE",
    );
  });

  it("INACTIVE tanpa pesanan", () => {
    expect(evaluatePurchaseListState(context({ orderStatus: null }))).toBe(
      "INACTIVE",
    );
  });

  it.each(["APPROVED", "ORDERED"])("ACTIVE untuk pengajuan %s", (status) => {
    expect(evaluatePurchaseListState(context({ requestStatus: status }))).toBe(
      "ACTIVE",
    );
  });

  it("barang di baris yang ditolak tidak dihitung", () => {
    const ctx = context({
      items: [item(), item({ id: "poi-2", barangId: "barang-tolak" })],
    });
    expect(getOwnedPurchaseItems(ctx).map((owned) => owned.id)).toEqual([
      "poi-1",
    ]);
  });

  it("INACTIVE bila semua barang milik pengajuan sudah datang", () => {
    const ctx = context({ items: [item({ receivedQuantity: 10 })] });
    expect(evaluatePurchaseListState(ctx)).toBe("INACTIVE");
  });

  it("ALL_PURCHASED bila semua dibeli tapi baru sebagian datang", () => {
    const ctx = context({
      items: [item({ purchasedQuantity: 10, receivedQuantity: 4 })],
    });
    expect(evaluatePurchaseListState(ctx)).toBe("ALL_PURCHASED");
  });
});

describe("describePurchaseLinkAvailability", () => {
  it.each([
    ["NOT_APPROVED", context({ requestStatus: "SUBMITTED" }), true],
    [
      "ALL_PURCHASED",
      context({ items: [item({ purchasedQuantity: 10 })] }),
      true,
    ],
    ["CLOSED", context({ requestStatus: "CANCELLED" }), true],
    ["MERGED_ORDER", context({ linkedRequestCount: 2 }), true],
    [
      "CLOSED",
      context({ requestStatus: "RECEIVED", linkedRequestCount: 2 }),
      true,
    ],
    ["STORAGE_OFF", context(), false],
    ["AVAILABLE", context(), true],
  ])("%s", (expected, ctx, isStorageAvailable) => {
    expect(describePurchaseLinkAvailability(ctx, isStorageAvailable)).toBe(
      expected,
    );
  });
});

describe("pesanan gabungan", () => {
  it("dikenali bila pesanan dipakai lebih dari satu pengajuan", () => {
    expect(isMergedPurchaseOrder(context({ linkedRequestCount: 2 }))).toBe(
      true,
    );
    expect(isMergedPurchaseOrder(context())).toBe(false);
    expect(isMergedPurchaseOrder(context({ orderStatus: null }))).toBe(false);
  });

  it("daftar publik INACTIVE walau masih ada yang perlu dibeli", () => {
    expect(evaluatePurchaseListState(context({ linkedRequestCount: 3 }))).toBe(
      "INACTIVE",
    );
  });
});

describe("getEarliestLinkPurchaseDate", () => {
  it("sehari sebelum tanggal link dibuat menurut WIB", () => {
    // 9 Nov 01.30 WIB = 8 Nov 18.30 UTC.
    expect(getEarliestLinkPurchaseDate(new Date("2026-11-08T18:30:00Z"))).toBe(
      "2026-11-08",
    );
    // 9 Nov 23.00 WIB.
    expect(getEarliestLinkPurchaseDate(new Date("2026-11-09T16:00:00Z"))).toBe(
      "2026-11-08",
    );
  });
});

it("buildPurchaseLinkExpiry = sekarang + 30 hari", () => {
  expect(buildPurchaseLinkExpiry(NOW).toISOString()).toBe(
    "2026-12-09T03:00:00.000Z",
  );
});

describe("link belanja pada pesanan data lama", () => {
  it("pemegang link lama melihat link tidak berlaku", () => {
    expect(
      evaluatePurchaseListState(context({ isLegacyPurchased: true })),
    ).toBe("INACTIVE");
  });

  it("admin melihat semua sudah dibeli, jadi link tidak bisa dibuat", () => {
    expect(
      describePurchaseLinkAvailability(
        context({ isLegacyPurchased: true }),
        true,
      ),
    ).toBe("ALL_PURCHASED");
  });

  it("pesanan biasa tetap bisa dibuatkan link", () => {
    expect(describePurchaseLinkAvailability(context(), true)).toBe("AVAILABLE");
  });

  it("data lama yang barangnya sudah datang semua tetap tertutup", () => {
    expect(
      describePurchaseLinkAvailability(
        context({
          isLegacyPurchased: true,
          items: [item({ receivedQuantity: 10 })],
        }),
        true,
      ),
    ).toBe("CLOSED");
  });
});
