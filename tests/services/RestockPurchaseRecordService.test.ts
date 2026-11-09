import { beforeEach, describe, expect, it, vi } from "vitest";

const { logActivitySafe } = vi.hoisted(() => ({ logActivitySafe: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logActivitySafe }));

import type {
  IRestockPurchaseRecordRepository,
  RestockPurchaseContext,
  RestockPurchaseContextItem,
  RestockPurchaseRecordView,
} from "@/modules/inventory/domain/ports/IRestockPurchaseRecordRepository";
import {
  RestockPurchaseRecordService,
  type RecordRestockPurchaseCommand,
} from "@/modules/inventory/services/RestockPurchaseRecordService";

const NOW = new Date("2026-11-09T03:00:00Z");

function poItem(
  overrides: Partial<RestockPurchaseContextItem> = {},
): RestockPurchaseContextItem {
  return {
    id: "poi-1",
    barangId: "barang-1",
    quantity: 10,
    cancelledQuantity: 0,
    receivedQuantity: 0,
    purchasedQuantity: 0,
    barang: { nama: "Kabel Fiber", satuan: "roll" },
    ...overrides,
  };
}

function purchaseContext(
  overrides: Partial<RestockPurchaseContext["request"]> = {},
  purchaseOrder:
    | RestockPurchaseContext["purchaseOrder"]
    | undefined = undefined,
): RestockPurchaseContext {
  return {
    request: {
      id: "pr-1",
      nomorRequest: "PR-1",
      status: "APPROVED",
      purchaseOrderId: "po-1",
      receivableBarangIds: ["barang-1"],
      ...overrides,
    },
    purchaseOrder:
      purchaseOrder === undefined
        ? {
            id: "po-1",
            poNumber: "PO-1",
            status: "DRAFT",
            tenantId: "tenant-1",
            linkedRequestCount: 1,
            isLegacyPurchased: false,
            items: [poItem()],
          }
        : purchaseOrder,
  };
}

const recordView: RestockPurchaseRecordView = {
  id: "rec-1",
  storeName: "Toko Sinar",
  supplierId: null,
  purchasedAt: new Date("2026-11-09T05:00:00Z"),
  createdAt: NOW,
  recordedBy: { name: "Sari" },
  buyerName: "Joko",
  source: "PUBLIC_LINK",
  hasSignature: true,
  notes: null,
  fotoNota: [],
  voidedAt: null,
  voidedBy: null,
  voidReason: null,
  items: [],
};

const linkOrigin = {
  linkId: "link-1",
  linkCreatorId: "admin-1",
  linkCreatedAt: new Date("2026-11-05T02:00:00Z"),
  buyerName: "Joko",
  signatureKey: "restock-belanja/tenant-1/pr-1/ttd-x.png",
  clientRequestId: "11111111-1111-4111-8111-111111111111",
  ipAddress: "10.0.0.1",
  userAgent: "HP Android",
};

function command(
  overrides: Partial<RecordRestockPurchaseCommand> = {},
): RecordRestockPurchaseCommand {
  return {
    purchaseRequestId: "pr-1",
    tenantId: "tenant-1",
    origin: linkOrigin,
    purchasedAt: "2026-11-09",
    notes: null,
    items: [{ purchaseOrderItemId: "poi-1", quantity: 10, unitPrice: 12000 }],
    ...overrides,
  };
}

function setup() {
  const repository = {
    findPurchaseContext: vi.fn().mockResolvedValue(purchaseContext()),
    createPurchaseRecord: vi.fn().mockResolvedValue({
      kind: "CREATED",
      record: recordView,
      previousStatus: "DRAFT",
      purchaseOrderStatus: "ORDERED",
      items: [poItem({ purchasedQuantity: 10 })],
      revokedLinkCount: 0,
    }),
    findByClientRequestId: vi.fn().mockResolvedValue(null),
    findSignatureKey: vi.fn().mockResolvedValue(null),
    voidPurchaseRecord: vi.fn(),
  } satisfies IRestockPurchaseRecordRepository;
  const service = new RestockPurchaseRecordService(repository, () => NOW);
  return { repository, service };
}

describe("RestockPurchaseRecordService.recordPurchase", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pesanan data lama ditolak sebelum apa pun ditulis", async () => {
    const { repository, service } = setup();
    repository.findPurchaseContext.mockResolvedValue(
      purchaseContext(
        {},
        {
          id: "po-1",
          poNumber: "PO-1",
          status: "ORDERED",
          tenantId: "tenant-1",
          linkedRequestCount: 1,
          isLegacyPurchased: true,
          items: [poItem()],
        },
      ),
    );

    const result = await service.recordPurchase(command());

    expect(result).toEqual({
      success: false,
      code: "LINK_INACTIVE",
      error:
        "Barang pesanan ini sudah dibeli sebelum ada link belanja, jadi belanjanya tidak perlu dicatat lagi.",
    });
    expect(repository.createPurchaseRecord).not.toHaveBeenCalled();
  });

  it("belanja semua barang pada pesanan DRAFT → ORDERED dan sudah dibeli semua", async () => {
    const { repository, service } = setup();

    const result = await service.recordPurchase(command());

    expect(result).toEqual({
      success: true,
      data: {
        record: recordView,
        purchaseOrderStatus: "ORDERED",
        isFullyPurchased: true,
        message:
          "Tersimpan. Semua barang sudah dibeli. Sekarang tunggu barangnya datang.",
        isReplay: false,
      },
    });
    expect(repository.createPurchaseRecord).toHaveBeenCalledWith({
      purchaseOrderId: "po-1",
      purchaseRequestId: "pr-1",
      receivableBarangIds: ["barang-1"],
      tenantId: "tenant-1",
      // Penanggung jawab = pembuat link.
      recordedById: "admin-1",
      purchasedAt: new Date("2026-11-09T05:00:00Z"),
      // Tanggal beli pesanan memakai waktu server, bukan tanggal isian.
      issuedAt: NOW,
      notes: null,
      lines: [
        {
          purchaseOrderItemId: "poi-1",
          barangId: "barang-1",
          quantity: 10,
          unitPrice: 12000,
          expected: { quantity: 10, cancelledQuantity: 0 },
        },
      ],
      buyerName: "Joko",
      buyerSignatureKey: linkOrigin.signatureKey,
      purchaseLinkId: "link-1",
      clientRequestId: linkOrigin.clientRequestId,
      ipAddress: "10.0.0.1",
      userAgent: "HP Android",
    });
  });

  it("belanja sebagian pada pesanan ORDERED → belum dibeli semua", async () => {
    const { repository, service } = setup();
    repository.createPurchaseRecord.mockResolvedValue({
      kind: "CREATED",
      record: recordView,
      previousStatus: "ORDERED",
      purchaseOrderStatus: "ORDERED",
      items: [poItem({ purchasedQuantity: 4 })],
      revokedLinkCount: 0,
    });

    const result = await service.recordPurchase(
      command({
        items: [{ purchaseOrderItemId: "poi-1", quantity: 4, unitPrice: null }],
      }),
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        isFullyPurchased: false,
        message:
          "Tersimpan. Belanjanya sudah dicatat. Masih ada barang yang belum dibeli.",
      },
    });
  });

  it("mencatat aktivitas RECORD_PURCHASE atas nama link", async () => {
    const { service } = setup();

    await service.recordPurchase(command());

    expect(logActivitySafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "RECORD_PURCHASE",
        subject: "Purchase Order PO-1",
        tenantId: "tenant-1",
        details: expect.objectContaining({
          purchaseRequestId: "pr-1",
          purchaseRecordId: "rec-1",
          tanggalBelanja: "2026-11-09",
          barang: [{ barangId: "barang-1", jumlah: 10, hargaSatuan: 12000 }],
          statusLama: "DRAFT",
          statusBaru: "ORDERED",
        }),
      }),
    );
  });

  it("NOT_FOUND bila pengajuan tidak ada", async () => {
    const { repository, service } = setup();
    repository.findPurchaseContext.mockResolvedValue(null);

    expect(await service.recordPurchase(command())).toMatchObject({
      success: false,
      code: "NOT_FOUND",
    });
  });

  it("INVALID bila pengajuan belum punya daftar belanja", async () => {
    const { repository, service } = setup();
    repository.findPurchaseContext.mockResolvedValue(
      purchaseContext({ purchaseOrderId: null }, null),
    );

    const result = await service.recordPurchase(command());

    expect(result).toMatchObject({ success: false, code: "INVALID" });
    expect(result.success === false && result.error).toContain(
      "belum punya daftar belanja",
    );
  });

  it("NOT_FOUND bila pesanannya tidak ditemukan", async () => {
    const { repository, service } = setup();
    repository.findPurchaseContext.mockResolvedValue(purchaseContext({}, null));

    const result = await service.recordPurchase(command());

    expect(result).toMatchObject({ success: false, code: "NOT_FOUND" });
    expect(result.success === false && result.error).toContain(
      "Daftar belanja",
    );
  });

  it("INVALID bila tanggal belanja di hari yang akan datang", async () => {
    const { repository, service } = setup();

    const result = await service.recordPurchase(
      command({ purchasedAt: "2026-11-20" }),
    );

    expect(result).toEqual({
      success: false,
      code: "INVALID",
      error: "Tanggal belanja tidak boleh di hari yang akan datang.",
    });
    expect(repository.findPurchaseContext).not.toHaveBeenCalled();
  });

  it("meneruskan pesanan tertutup sebagai CONFLICT", async () => {
    const { repository, service } = setup();
    repository.createPurchaseRecord.mockResolvedValue({ kind: "CLOSED" });

    const result = await service.recordPurchase(command());

    expect(result).toMatchObject({ success: false, code: "CONFLICT" });
    expect(result.success === false && result.error).toContain(
      "sudah selesai atau dibatalkan",
    );
    expect(logActivitySafe).not.toHaveBeenCalled();
  });

  it("meneruskan perubahan bersamaan sebagai CONFLICT", async () => {
    const { repository, service } = setup();
    repository.createPurchaseRecord.mockResolvedValue({ kind: "CONFLICT" });

    const result = await service.recordPurchase(command());

    expect(result).toMatchObject({ success: false, code: "CONFLICT" });
    expect(result.success === false && result.error).toContain(
      "baru saja diubah orang lain",
    );
  });

  it("menolak jumlah yang melebihi sisa sebelum menulis", async () => {
    const { repository, service } = setup();

    const result = await service.recordPurchase(
      command({
        items: [
          { purchaseOrderItemId: "poi-1", quantity: 11, unitPrice: null },
        ],
      }),
    );

    expect(result).toEqual({
      success: false,
      code: "INVALID",
      error:
        "Kabel Fiber: tinggal 10 roll yang belum dibeli. Isi paling banyak 10.",
    });
    expect(repository.createPurchaseRecord).not.toHaveBeenCalled();
  });

  describe("lewat link belanja", () => {
    it("log memakai pelaku link, tanpa userId, token, atau kunci tanda tangan", async () => {
      const { service } = setup();

      await service.recordPurchase(command());

      const entry = logActivitySafe.mock.calls[0][0];
      expect(entry.userId).toBeUndefined();
      expect(entry.actor).toEqual({ type: "purchase_link", id: "link-1" });
      expect(entry.ipAddress).toBe("10.0.0.1");
      expect(entry.details).toMatchObject({
        lewatLink: true,
        namaPembeli: "Joko",
        linkId: "link-1",
        keterangan: "Dicatat lewat link belanja oleh Joko",
      });
      expect(JSON.stringify(entry)).not.toContain("ttd-x.png");
    });

    it("DUPLICATE dari repository menjadi sukses kiriman ulang tanpa log", async () => {
      const { repository, service } = setup();
      repository.createPurchaseRecord.mockResolvedValue({
        kind: "DUPLICATE",
        record: recordView,
      });

      const result = await service.recordPurchase(command());

      expect(result).toMatchObject({ success: true, data: { isReplay: true } });
      expect(logActivitySafe).not.toHaveBeenCalled();
    });

    it("DUPLICATE menghitung ulang status lengkap dari data terbaru", async () => {
      const { repository, service } = setup();
      repository.findPurchaseContext
        .mockResolvedValueOnce(purchaseContext())
        .mockResolvedValueOnce(
          purchaseContext(
            {},
            {
              id: "po-1",
              poNumber: "PO-1",
              status: "ORDERED",
              tenantId: "tenant-1",
              linkedRequestCount: 1,
              isLegacyPurchased: false,
              items: [poItem({ purchasedQuantity: 10 })],
            },
          ),
        );
      repository.createPurchaseRecord.mockResolvedValue({
        kind: "DUPLICATE",
        record: recordView,
      });

      const result = await service.recordPurchase(command());

      expect(result).toMatchObject({
        success: true,
        data: {
          isReplay: true,
          isFullyPurchased: true,
          purchaseOrderStatus: "ORDERED",
        },
      });
    });

    it("tanggal beli pesanan DRAFT memakai waktu server, bukan tanggal isian", async () => {
      const { repository, service } = setup();

      await service.recordPurchase(command({ purchasedAt: "2026-11-05" }));

      expect(repository.createPurchaseRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          purchasedAt: new Date("2026-11-05T05:00:00Z"),
          issuedAt: NOW,
        }),
      );
    });

    it("menerima tanggal sehari sebelum link dibuat (WIB)", async () => {
      const { repository, service } = setup();

      // Link dibuat 5 Nov 09.00 WIB → paling awal 4 Nov.
      const result = await service.recordPurchase(
        command({ purchasedAt: "2026-11-04" }),
      );

      expect(result.success).toBe(true);
      expect(repository.createPurchaseRecord).toHaveBeenCalled();
    });

    it("menolak tanggal lebih dari sehari sebelum link dibuat", async () => {
      const { repository, service } = setup();

      const result = await service.recordPurchase(
        command({ purchasedAt: "2026-11-03" }),
      );

      expect(result).toEqual({
        success: false,
        code: "INVALID",
        error:
          "Tanggal belanja tidak boleh lebih awal dari tanggal daftar belanja ini dikirim. Isi tanggal waktu barangnya dibeli.",
      });
      expect(repository.createPurchaseRecord).not.toHaveBeenCalled();
    });

    it("LIMIT_REACHED bila link sudah mencapai batas catatan", async () => {
      const { repository, service } = setup();
      repository.createPurchaseRecord.mockResolvedValue({ kind: "LINK_LIMIT" });

      expect(await service.recordPurchase(command())).toEqual({
        success: false,
        code: "LIMIT_REACHED",
        error:
          "Link ini sudah dipakai mencatat 30 kali belanja. Minta link baru ke admin gudang.",
      });
    });

    it("mencatat jumlah link yang dicabut otomatis di log", async () => {
      const { repository, service } = setup();
      repository.createPurchaseRecord.mockResolvedValue({
        kind: "CREATED",
        record: recordView,
        previousStatus: "ORDERED",
        purchaseOrderStatus: "ORDERED",
        items: [poItem({ purchasedQuantity: 10 })],
        revokedLinkCount: 1,
      });

      await service.recordPurchase(command());

      expect(logActivitySafe.mock.calls[0][0].details).toMatchObject({
        linkBelanjaDimatikan: 1,
      });
    });

    it("LINK_INACTIVE bila link dicabut saat dikunci", async () => {
      const { repository, service } = setup();
      repository.createPurchaseRecord.mockResolvedValue({
        kind: "LINK_INACTIVE",
      });

      expect(await service.recordPurchase(command())).toMatchObject({
        success: false,
        code: "LINK_INACTIVE",
      });
    });
  });
});

describe("RestockPurchaseRecordService.voidPurchase", () => {
  beforeEach(() => vi.clearAllMocks());

  const voidCommand = {
    purchaseRequestId: "pr-1",
    recordId: "rec-1",
    tenantId: "tenant-1",
    actorId: "admin-1",
    reason: "Bukan belanja kita",
  };
  const voidedView: RestockPurchaseRecordView = {
    ...recordView,
    source: "PUBLIC_LINK",
    buyerName: "Joko",
    voidedAt: NOW,
    voidedBy: { name: "Admin" },
    voidReason: "Bukan belanja kita",
    items: [
      {
        id: "line-1",
        purchaseOrderItemId: "poi-1",
        barangId: "barang-1",
        nama: "Kabel Fiber",
        satuan: "roll",
        quantity: 3,
        unitPrice: null,
      },
    ],
  };

  it("membatalkan, meneruskan waktu sekarang, dan mencatat log VOID_PURCHASE", async () => {
    const { repository, service } = setup();
    repository.voidPurchaseRecord.mockResolvedValue({
      kind: "VOIDED",
      record: voidedView,
      audit: {
        buyerSignatureKey: "restock-belanja/tenant-1/pr-1/ttd.png",
        purchaseLinkId: "link-1",
        clientRequestId: "6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f",
        ipAddress: "10.0.0.1",
        userAgent: "Peramban Uji",
      },
      poNumber: "PO-1",
    });

    const result = await service.voidPurchase(voidCommand);

    expect(repository.voidPurchaseRecord).toHaveBeenCalledWith({
      ...voidCommand,
      now: NOW,
    });
    expect(result).toEqual({
      success: true,
      data: {
        record: voidedView,
        message:
          "Catatan belanja dibatalkan. Jumlah barangnya kembali jadi belum dibeli.",
      },
    });
    expect(logActivitySafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "VOID_PURCHASE",
        subject: "Purchase Order PO-1",
        userId: "admin-1",
        details: expect.objectContaining({
          purchaseRecordId: "rec-1",
          alasan: "Bukan belanja kita",
          lewatLink: true,
          namaPembeli: "Joko",
          // Salinan lengkap: catatan batal bisa ikut terhapus bersama
          // pesanannya, dan log ini yang tersisa sebagai jejak audit.
          purchaseLinkId: "link-1",
          clientRequestId: "6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f",
          kunciTandaTangan: "restock-belanja/tenant-1/pr-1/ttd.png",
          ipPembeli: "10.0.0.1",
          perangkatPembeli: "Peramban Uji",
          tanggalBelanja: voidedView.purchasedAt.toISOString(),
          barang: [
            {
              barangId: "barang-1",
              purchaseOrderItemId: "poi-1",
              nama: "Kabel Fiber",
              jumlah: 3,
              hargaSatuan: null,
            },
          ],
        }),
      }),
    );
    // Kunci tanda tangan hanya di log, tidak pernah di jawaban ke peramban.
    expect(JSON.stringify(result)).not.toContain("ttd.png");
  });

  it.each([
    ["NOT_FOUND", "NOT_FOUND", "Catatan belanja tidak ditemukan"],
    ["ALREADY_VOIDED", "CONFLICT", "sudah dibatalkan sebelumnya"],
    ["CLOSED", "CONFLICT", "tidak bisa dibatalkan lagi"],
    [
      "SHARED_WITH_OTHER_REQUEST",
      "CONFLICT",
      "juga berisi barang pengajuan lain",
    ],
  ] as const)("%s → %s tanpa log", async (kind, code, message) => {
    const { repository, service } = setup();
    repository.voidPurchaseRecord.mockResolvedValue({ kind });

    const result = await service.voidPurchase(voidCommand);

    expect(result).toMatchObject({ success: false, code });
    expect(result.success === false && result.error).toContain(message);
    expect(logActivitySafe).not.toHaveBeenCalled();
  });

  it("ALREADY_RECEIVED → CONFLICT dengan pesan awam yang menyebut barangnya", async () => {
    const { repository, service } = setup();
    repository.voidPurchaseRecord.mockResolvedValue({
      kind: "ALREADY_RECEIVED",
      lines: [
        { nama: "Kabel", received: 3, satuan: "roll" },
        { nama: "ONT", received: 1, satuan: null },
      ],
    });

    const result = await service.voidPurchase(voidCommand);

    expect(result).toMatchObject({ success: false, code: "CONFLICT" });
    expect(result.success === false && result.error).toBe(
      "Belanja ini tidak bisa dibatalkan karena barangnya sudah dicatat datang di gudang (Kabel 3 roll sudah datang, ONT 1 sudah datang). Kalau dibatalkan, barang yang sudah datang jadi tercatat belum dibeli.",
    );
    expect(logActivitySafe).not.toHaveBeenCalled();
  });
});
