import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateLinkToken, hashLinkToken } from "@/lib/security/link-token";
import type {
  RestockPurchaseContext,
  RestockPurchaseContextItem,
} from "@/modules/inventory/domain/ports/IRestockPurchaseRecordRepository";
import { PURCHASE_LINK_MESSAGES } from "@/modules/inventory/domain/restock-purchase-link";
import {
  RestockPublicPurchaseService,
  type PublicPurchaseSubmitInput,
  type UsablePurchaseLink,
} from "@/modules/inventory/services/RestockPublicPurchaseService";

import { buildPngDataUrl } from "../helpers/png-fixture";

const NOW = new Date("2026-11-09T03:00:00Z");
function pngDataUrl(width = 600, height = 200): string {
  return buildPngDataUrl({ width, height });
}

function item(
  overrides: Partial<RestockPurchaseContextItem> = {},
): RestockPurchaseContextItem {
  return {
    id: "poi-1",
    barangId: "barang-1",
    quantity: 10,
    cancelledQuantity: 2,
    receivedQuantity: 0,
    purchasedQuantity: 3,
    barang: { nama: "Kabel Fiber", satuan: "roll" },
    ...overrides,
  };
}

function context(
  items = [item()],
  status = "ORDERED",
  linkedRequestCount = 1,
): RestockPurchaseContext {
  return {
    request: {
      id: "pr-1",
      nomorRequest: "PR-001",
      status,
      purchaseOrderId: "po-1",
      receivableBarangIds: ["barang-1", "barang-0"],
    },
    purchaseOrder: {
      id: "po-1",
      poNumber: "PO-RAHASIA",
      status: "ORDERED",
      tenantId: "tenant-1",
      linkedRequestCount,
      isLegacyPurchased: false,
      items,
    },
  };
}

const link: UsablePurchaseLink = {
  id: "link-1",
  purchaseRequestId: "pr-1",
  tenantId: "tenant-1",
  createdById: "admin-1",
  expiresAt: new Date("2026-12-09T03:00:00Z"),
  createdAt: new Date("2026-11-09T01:00:00Z"),
};

const input: PublicPurchaseSubmitInput = {
  clientRequestId: "6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f",
  buyerName: "Joko",
  storeName: "Toko Sinar",
  purchasedAt: "2026-11-09",
  notes: null,
  signatureDataUrl: pngDataUrl(),
  items: [{ purchaseOrderItemId: "poi-1", quantity: 2, unitPrice: null }],
};
const client = { ipAddress: "10.0.0.1", userAgent: "x".repeat(900) };

/** Catatan tersimpan yang isinya sama dengan `input`. */
const storedSameAsInput = {
  id: "rec-1",
  buyerName: "Joko",
  storeName: "Toko Sinar",
  purchasedAt: new Date("2026-11-09T05:00:00Z"),
  notes: null as string | null,
  items: [
    {
      purchaseOrderItemId: "poi-1",
      quantity: 2,
      unitPrice: null as number | null,
    },
  ],
};

function setup() {
  const links = {
    findByTokenHash: vi.fn(),
    findActiveForRequest: vi.fn(),
    replaceActiveLink: vi.fn(),
    revokeActiveLinks: vi.fn(),
    touchLastUsed: vi.fn(),
    findPublicListSource: vi.fn(),
  };
  const records = {
    findPurchaseContext: vi.fn().mockResolvedValue(context()),
    findByClientRequestId: vi.fn().mockResolvedValue(null),
  };
  const recorder = {
    recordPurchase: vi.fn().mockResolvedValue({
      success: true,
      data: {
        record: {},
        purchaseOrderStatus: "ORDERED",
        isFullyPurchased: false,
        message: "",
        isReplay: false,
      },
    }),
  };
  const storage = {
    isAvailable: vi.fn().mockResolvedValue(true),
    save: vi.fn().mockResolvedValue("restock-belanja/tenant-1/pr-1/ttd-1.png"),
    read: vi.fn(),
    remove: vi.fn(),
  };
  const service = new RestockPublicPurchaseService(
    links,
    records,
    recorder,
    storage,
    () => NOW,
  );
  return { links, records, recorder, storage, service };
}

describe("RestockPublicPurchaseService.resolveLink", () => {
  const usable = {
    id: "link-1",
    purchaseRequestId: "pr-1",
    tenantId: "tenant-1",
    createdById: "admin-1",
    expiresAt: new Date("2026-12-09T03:00:00Z"),
    revokedAt: null as Date | null,
    lastUsedAt: null as Date | null,
    createdAt: new Date("2026-11-09T01:00:00Z"),
    isCreatorActive: true,
  };

  it("mencari lewat hash token, bukan token mentah", async () => {
    const { links, service } = setup();
    links.findByTokenHash.mockResolvedValue(usable);
    const token = generateLinkToken();

    expect(await service.resolveLink(token)).toMatchObject({
      id: "link-1",
      tenantId: "tenant-1",
    });
    expect(links.findByTokenHash).toHaveBeenCalledWith(hashLinkToken(token));
  });

  it.each([
    ["tidak ada", null],
    ["dicabut", { ...usable, revokedAt: NOW }],
    ["kedaluwarsa", { ...usable, expiresAt: NOW }],
    ["tanpa tenant", { ...usable, tenantId: null }],
    ["pembuatnya nonaktif", { ...usable, isCreatorActive: false }],
  ])("null bila link %s", async (_label, row) => {
    const { links, service } = setup();
    links.findByTokenHash.mockResolvedValue(row);

    expect(await service.resolveLink(generateLinkToken())).toBeNull();
  });

  it("format salah tidak menyentuh database", async () => {
    const { links, service } = setup();

    expect(await service.resolveLink("salah")).toBeNull();
    expect(links.findByTokenHash).not.toHaveBeenCalled();
  });
});

describe("RestockPublicPurchaseService.getList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hanya field whitelist dan hanya barang milik pengajuan", async () => {
    const { links, service } = setup();
    links.findPublicListSource.mockResolvedValue({
      context: context([
        item(),
        item({
          id: "poi-0",
          barangId: "barang-0",
          barang: { nama: "Adaptor", satuan: null },
        }),
        item({
          id: "poi-lain",
          barangId: "barang-lain",
          barang: { nama: "Milik Lain", satuan: "pcs" },
        }),
      ]),
      warehouseName: "Gudang Pusat",
      records: [
        {
          storeName: "Toko A",
          purchasedAt: new Date("2026-11-08T05:00:00Z"),
          items: [
            { purchaseOrderItemId: "poi-1", quantity: 3 },
            { purchaseOrderItemId: "poi-lain", quantity: 1 },
          ],
        },
      ],
    });

    const result = await service.getList(link);

    expect(result.success).toBe(true);
    if (result.success !== true) return;
    expect(Object.keys(result.data).sort()).toEqual([
      "items",
      "requestNumber",
      "state",
      "validUntil",
      "warehouseName",
    ]);
    expect(result.data.items.map((entry) => entry.name)).toEqual([
      "Adaptor",
      "Kabel Fiber",
    ]);
    expect(Object.keys(result.data.items[0]).sort()).toEqual([
      "name",
      "needed",
      "purchaseOrderItemId",
      "purchased",
      "remaining",
      "stores",
      "unit",
    ]);
    expect(result.data.items[1]).toEqual({
      purchaseOrderItemId: "poi-1",
      name: "Kabel Fiber",
      unit: "roll",
      needed: 8,
      purchased: 3,
      remaining: 5,
      stores: [{ storeName: "Toko A", purchasedAt: "2026-11-08", quantity: 3 }],
    });
    expect(JSON.stringify(result.data)).not.toContain("PO-RAHASIA");
    expect(links.touchLastUsed).toHaveBeenCalledWith("link-1", "tenant-1", NOW);
  });

  it.each([
    ["pengajuan hilang", null],
    [
      "pengajuan selesai",
      {
        context: context([item()], "RECEIVED"),
        warehouseName: "G",
        records: [],
      },
    ],
    [
      "semua barang datang",
      {
        context: context([item({ receivedQuantity: 8 })]),
        warehouseName: "G",
        records: [],
      },
    ],
    [
      "pesanannya digabung dengan pengajuan lain",
      {
        context: context([item()], "ORDERED", 2),
        warehouseName: "G",
        records: [],
      },
    ],
  ])("LINK_INACTIVE bila %s", async (_label, source) => {
    const { links, service } = setup();
    links.findPublicListSource.mockResolvedValue(source);

    expect(await service.getList(link)).toMatchObject({
      success: false,
      code: "LINK_INACTIVE",
    });
  });
});

describe("RestockPublicPurchaseService.submit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menyimpan tanda tangan lalu mencatat dengan asal link", async () => {
    const { recorder, storage, links, service } = setup();

    const result = await service.submit(link, input, client);

    expect(result).toEqual({
      success: true,
      data: {
        state: "ACTIVE",
        message: "Masih ada barang yang belum dibeli di daftar ini.",
        isReplay: false,
      },
    });
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        purchaseRequestId: "pr-1",
      }),
    );
    const command = recorder.recordPurchase.mock.calls[0][0];
    expect(command).toMatchObject({
      purchaseRequestId: "pr-1",
      tenantId: "tenant-1",
      origin: {
        linkId: "link-1",
        linkCreatorId: "admin-1",
        linkCreatedAt: link.createdAt,
        buyerName: "Joko",
        signatureKey: "restock-belanja/tenant-1/pr-1/ttd-1.png",
        clientRequestId: input.clientRequestId,
        ipAddress: "10.0.0.1",
      },
    });
    expect(command.origin.userAgent).toHaveLength(500);
    expect(storage.remove).not.toHaveBeenCalled();
    expect(links.touchLastUsed).toHaveBeenCalled();
  });

  it("kiriman ulang dikenali sebelum unggah", async () => {
    const { records, storage, recorder, service } = setup();
    records.findByClientRequestId.mockResolvedValue(storedSameAsInput);

    const result = await service.submit(link, input, client);

    expect(result).toMatchObject({ success: true, data: { isReplay: true } });
    expect(storage.save).not.toHaveBeenCalled();
    expect(recorder.recordPurchase).not.toHaveBeenCalled();
  });

  it.each([
    ["toko lain", { storeName: "Toko Lain" }],
    [
      "jumlah lain",
      {
        items: [{ purchaseOrderItemId: "poi-1", quantity: 3, unitPrice: null }],
      },
    ],
    [
      "barang tambahan",
      {
        items: [
          ...input.items,
          { purchaseOrderItemId: "poi-2", quantity: 1, unitPrice: null },
        ],
      },
    ],
  ])(
    "kiriman ulang dengan isi berbeda (%s) → CONFLICT, bukan tersimpan",
    async (_label, change) => {
      const { records, storage, recorder, service } = setup();
      records.findByClientRequestId.mockResolvedValue(storedSameAsInput);

      const result = await service.submit(
        link,
        { ...input, ...change },
        client,
      );

      expect(result).toEqual({
        success: false,
        code: "CONFLICT",
        error: PURCHASE_LINK_MESSAGES.replayMismatch,
      });
      expect(storage.save).not.toHaveBeenCalled();
      expect(recorder.recordPurchase).not.toHaveBeenCalled();
    },
  );

  it("kiriman ulang tetap dikenali walau semua barang sudah dibeli", async () => {
    const { records, service } = setup();
    records.findPurchaseContext.mockResolvedValue(
      context([item({ purchasedQuantity: 8 })]),
    );
    records.findByClientRequestId.mockResolvedValue(storedSameAsInput);

    expect(await service.submit(link, input, client)).toMatchObject({
      success: true,
      data: { isReplay: true, state: "ALL_PURCHASED" },
    });
  });

  it.each([
    ["bukan PNG", "data:image/png;base64,PGh0bWw+PC9odG1sPg=="],
    ["dimensi terlalu besar", pngDataUrl(5000, 200)],
  ])(
    "tanda tangan %s → INVALID tanpa unggah",
    async (_label, signatureDataUrl) => {
      const { storage, service } = setup();

      const result = await service.submit(
        link,
        { ...input, signatureDataUrl },
        client,
      );

      expect(result).toMatchObject({ success: false, code: "INVALID" });
      expect(storage.save).not.toHaveBeenCalled();
    },
  );

  it("STORAGE_UNAVAILABLE bila penyimpanan mati", async () => {
    const { storage, service } = setup();
    storage.isAvailable.mockResolvedValue(false);

    expect(await service.submit(link, input, client)).toMatchObject({
      success: false,
      code: "STORAGE_UNAVAILABLE",
    });
    expect(storage.save).not.toHaveBeenCalled();
  });

  it("galat tulis menghapus tanda tangan yang sudah diunggah", async () => {
    const { recorder, storage, service } = setup();
    recorder.recordPurchase.mockRejectedValue(new Error("db mati"));

    await expect(service.submit(link, input, client)).rejects.toThrow(
      "db mati",
    );
    expect(storage.remove).toHaveBeenCalledWith(
      "restock-belanja/tenant-1/pr-1/ttd-1.png",
    );
  });

  it("DUPLICATE dari balapan → hapus unggahan dan isReplay", async () => {
    const { recorder, storage, service } = setup();
    recorder.recordPurchase.mockResolvedValue({
      success: true,
      data: {
        record: storedSameAsInput,
        purchaseOrderStatus: "ORDERED",
        isFullyPurchased: true,
        message: "",
        isReplay: true,
      },
    });

    expect(await service.submit(link, input, client)).toMatchObject({
      success: true,
      data: { isReplay: true, state: "ALL_PURCHASED" },
    });
    expect(storage.remove).toHaveBeenCalled();
  });

  it("DUPLICATE dari balapan dengan isi berbeda → CONFLICT", async () => {
    const { recorder, storage, service } = setup();
    recorder.recordPurchase.mockResolvedValue({
      success: true,
      data: {
        record: { ...storedSameAsInput, storeName: "Toko Lama" },
        purchaseOrderStatus: "ORDERED",
        isFullyPurchased: false,
        message: "",
        isReplay: true,
      },
    });

    expect(await service.submit(link, input, client)).toMatchObject({
      success: false,
      code: "CONFLICT",
      error: PURCHASE_LINK_MESSAGES.replayMismatch,
    });
    expect(storage.remove).toHaveBeenCalled();
  });

  it.each([
    [
      "CONFLICT",
      "CONFLICT",
      "Daftar belanja baru saja berubah. Cek lagi jumlahnya, lalu simpan ulang.",
    ],
    ["LINK_INACTIVE", "LINK_INACTIVE", "Link ini sudah tidak berlaku."],
    ["LIMIT_REACHED", "CONFLICT", "x"],
    ["NOT_FOUND", "LINK_INACTIVE", "Link ini sudah tidak berlaku."],
  ])(
    "galat %s dipetakan ke %s dan unggahan dihapus",
    async (code, expected, message) => {
      const { recorder, storage, service } = setup();
      recorder.recordPurchase.mockResolvedValue({
        success: false,
        code,
        error: "x",
      });

      expect(await service.submit(link, input, client)).toEqual({
        success: false,
        code: expected,
        error: message,
      });
      expect(storage.remove).toHaveBeenCalled();
    },
  );

  it("semua sudah dibeli → CONFLICT tanpa unggah", async () => {
    const { records, storage, service } = setup();
    records.findPurchaseContext.mockResolvedValue(
      context([item({ purchasedQuantity: 8 })]),
    );

    expect(await service.submit(link, input, client)).toEqual({
      success: false,
      code: "CONFLICT",
      error: "Semua barang sudah dibeli. Terima kasih.",
    });
    expect(storage.save).not.toHaveBeenCalled();
  });

  it("pesanan gabungan → LINK_INACTIVE tanpa unggah", async () => {
    const { records, storage, recorder, service } = setup();
    records.findPurchaseContext.mockResolvedValue(
      context([item()], "ORDERED", 2),
    );

    expect(await service.submit(link, input, client)).toMatchObject({
      success: false,
      code: "LINK_INACTIVE",
    });
    expect(storage.save).not.toHaveBeenCalled();
    expect(recorder.recordPurchase).not.toHaveBeenCalled();
  });

  it("pengajuan dibatalkan → LINK_INACTIVE", async () => {
    const { records, service } = setup();
    records.findPurchaseContext.mockResolvedValue(
      context([item()], "CANCELLED"),
    );

    expect(await service.submit(link, input, client)).toMatchObject({
      success: false,
      code: "LINK_INACTIVE",
    });
  });
});
