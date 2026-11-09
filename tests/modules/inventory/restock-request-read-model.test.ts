import { describe, expect, it, vi } from "vitest";

import { InventoryPurchaseRequestRepository } from "@/modules/inventory/repositories/InventoryPurchaseRequestRepository";
import type { PurchaseRecordViewRow } from "@/modules/inventory/repositories/restock-purchase-record.mapper";
import { toRestockReadModel } from "@/modules/inventory/repositories/restock-request-read-model";

function createRepository(requests: unknown[]) {
  const db = {
    purchaseRequest: {
      findMany: vi.fn().mockResolvedValue(requests),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
  return {
    db,
    repository: new InventoryPurchaseRequestRepository(db as never),
  };
}

const purchaseOrder = {
  items: [
    {
      barangId: "barang-1",
      quantity: 6,
      receivedQuantity: 2,
      cancelledQuantity: 0,
      cancelReason: null as string | null,
    },
  ],
  goodsReceipts: [] as unknown[],
};

describe("InventoryPurchaseRequestRepository — keputusan per baris", () => {
  it("menghitung jumlah dipesan 0 untuk baris yang ditolak, tanpa jatuh ke jumlah", async () => {
    const { repository } = createRepository([
      {
        id: "pr-1",
        purchaseOrder,
        items: [
          {
            id: "item-1",
            barangId: "barang-1",
            jumlah: 6,
            statusApproval: "APPROVED",
          },
          {
            id: "item-2",
            barangId: "barang-2",
            jumlah: 4,
            statusApproval: "REJECTED",
          },
          {
            id: "item-3",
            barangId: "barang-3",
            jumlah: 5,
            statusApproval: "PENDING",
          },
        ],
      },
    ]);

    const [request] = await repository.findPurchaseRequests({
      tenantId: "tenant-1",
    });

    expect(request.items.map((item) => item.orderedQuantity)).toEqual([
      6, 0, 5,
    ]);
    expect(request.items[0].receivedQuantity).toBe(2);
    expect(request.items[1]).toMatchObject({
      receivedQuantity: 0,
      cancelledQuantity: 0,
      cancelReason: null,
    });
  });

  it("memuat barang yang semula diminta dan nama penyetuju", async () => {
    const { db, repository } = createRepository([]);

    await repository.findPurchaseRequests({ tenantId: "tenant-1" });
    await repository.findPurchaseRequestDetail("pr-1", "tenant-1");

    const barangDiminta = {
      select: { id: true, nama: true, kode: true, satuan: true },
    };
    const [listQuery] = db.purchaseRequest.findMany.mock.calls[0];
    expect(listQuery.include.items.include.barangDiminta).toEqual(
      barangDiminta,
    );
    expect(listQuery.include.approver).toEqual({ select: { name: true } });

    const [detailQuery] = db.purchaseRequest.findFirst.mock.calls[0];
    expect(detailQuery.where).toEqual({ id: "pr-1", tenantId: "tenant-1" });
    expect(detailQuery.include.items.include.barangDiminta).toEqual(
      barangDiminta,
    );
    expect(detailQuery.include.approver).toEqual({ select: { name: true } });
  });

  it("memuat tanggal beli, pembeli, dan kiriman terlama dulu", async () => {
    const { db, repository } = createRepository([]);

    await repository.findPurchaseRequests({ tenantId: "tenant-1" });
    await repository.findPurchaseRequestDetail("pr-1", "tenant-1");

    const [listQuery] = db.purchaseRequest.findMany.mock.calls[0];
    const [detailQuery] = db.purchaseRequest.findFirst.mock.calls[0];
    for (const purchaseOrderQuery of [
      listQuery.include.purchaseOrder.include,
      detailQuery.include.purchaseOrder.select,
    ]) {
      expect(purchaseOrderQuery.processedBy).toEqual({
        select: { name: true },
      });
      expect(purchaseOrderQuery.goodsReceipts.orderBy).toEqual({
        receivedAt: "asc",
      });
      expect(purchaseOrderQuery.goodsReceipts.select).toMatchObject({
        receivedBy: { select: { name: true } },
        items: expect.any(Object),
      });
    }
    expect(detailQuery.include.purchaseOrder.select.issuedAt).toBe(true);
  });

  it("menyajikan kiriman per GRN dengan penerima dan isinya", async () => {
    const firstArrival = {
      id: "grn-1",
      grnNumber: "GRN-001",
      fotoBukti: ["/a.webp"],
      receivedAt: new Date("2026-11-02T08:00:00Z"),
      receivedBy: { name: "Budi" },
      items: [
        {
          barangId: "barang-1",
          quantity: 2,
          barang: { nama: "Kabel Fiber", satuan: "roll" },
        },
      ],
    };
    const secondArrival = {
      ...firstArrival,
      id: "grn-2",
      grnNumber: "GRN-002",
      receivedAt: new Date("2026-11-05T08:00:00Z"),
      receivedBy: null as { name: string } | null,
    };
    const processedPurchaseOrder = {
      ...purchaseOrder,
      id: "po-1",
      poNumber: "PO-1",
      status: "PARTIAL",
      issuedAt: new Date("2026-11-01T08:00:00Z"),
      processedBy: { name: "Sari" },
      goodsReceipts: [firstArrival, secondArrival],
    };
    const { db, repository } = createRepository([
      {
        id: "pr-1",
        purchaseOrder: processedPurchaseOrder,
        items: [
          {
            id: "item-1",
            barangId: "barang-1",
            jumlah: 6,
            statusApproval: "APPROVED",
          },
        ],
      },
    ]);
    db.purchaseRequest.findFirst.mockResolvedValue({
      id: "pr-1",
      purchaseOrder: processedPurchaseOrder,
      items: [
        {
          id: "item-1",
          barangId: "barang-1",
          jumlah: 6,
          statusApproval: "APPROVED",
        },
      ],
    });

    const [listed] = await repository.findPurchaseRequests({
      tenantId: "tenant-1",
    });
    const detail = await repository.findPurchaseRequestDetail(
      "pr-1",
      "tenant-1",
    );

    for (const request of [listed, detail]) {
      expect(request?.purchaseOrder).toMatchObject({
        issuedAt: processedPurchaseOrder.issuedAt,
        processedBy: { name: "Sari" },
      });
      expect(request?.goodsReceipts).toEqual([
        {
          id: "grn-1",
          grnNumber: "GRN-001",
          receivedAt: firstArrival.receivedAt,
          fotoBukti: ["/a.webp"],
          receivedBy: { name: "Budi" },
          items: [
            {
              barangId: "barang-1",
              nama: "Kabel Fiber",
              satuan: "roll",
              quantity: 2,
            },
          ],
        },
        expect.objectContaining({ id: "grn-2", receivedBy: null }),
      ]);
      // Daftar lama di purchaseOrder tetap terbaru dulu.
      expect(
        request?.purchaseOrder?.goodsReceipts.map((receipt) => receipt.id),
      ).toEqual(["grn-2", "grn-1"]);
      expect(request?.items[0]).toMatchObject({
        orderedQuantity: 6,
        receivedQuantity: 2,
      });
    }
  });

  it("memberi daftar kiriman kosong untuk pengajuan tanpa pesanan", async () => {
    const { repository } = createRepository([
      {
        id: "pr-1",
        purchaseOrder: null,
        items: [
          {
            id: "item-1",
            barangId: "barang-1",
            jumlah: 3,
            statusApproval: "PENDING",
          },
        ],
      },
    ]);

    const [request] = await repository.findPurchaseRequests({
      tenantId: "tenant-1",
    });

    expect(request.goodsReceipts).toEqual([]);
    expect(request.purchaseOrder).toBeNull();
    expect(request.items[0].orderedQuantity).toBe(3);
  });

  it("mendeteksi pesanan yang sudah menerima barang", async () => {
    const db = {
      goodsReceipt: { count: vi.fn().mockResolvedValue(0) },
      purchaseOrderItem: { count: vi.fn().mockResolvedValue(1) },
    };
    const repository = new InventoryPurchaseRequestRepository(db as never);

    expect(await repository.hasArrivedGoods("po-1")).toBe(true);
    db.purchaseOrderItem.count.mockResolvedValue(0);
    expect(await repository.hasArrivedGoods("po-1")).toBe(false);
    db.goodsReceipt.count.mockResolvedValue(2);
    expect(await repository.hasArrivedGoods("po-1")).toBe(true);
    expect(db.purchaseOrderItem.count).toHaveBeenCalledWith({
      where: { purchaseOrderId: "po-1", receivedQuantity: { gt: 0 } },
    });
  });
});

describe("toRestockReadModel — catatan belanja per toko", () => {
  const recordRow = (
    id: string,
    storeName: string,
    items: Array<{
      purchaseOrderItemId: string;
      barangId: string;
      quantity: number;
    }>,
  ): PurchaseRecordViewRow => ({
    id,
    storeName,
    supplierId: null,
    purchasedAt: new Date("2026-11-08T05:00:00Z"),
    createdAt: new Date("2026-11-08T06:00:00Z"),
    notes: null,
    fotoNota: [],
    recordedBy: { name: "Sari" },
    buyerName: null,
    source: "ADMIN",
    buyerSignatureKey: null,
    voidedAt: null,
    voidReason: null,
    voidedBy: null,
    items: items.map((item, index) => ({
      id: `${id}-line-${index}`,
      unitPrice: null as number | null,
      barang: { nama: `Nama ${item.barangId}`, satuan: "pcs" },
      ...item,
    })),
  });

  const mergedOrder = {
    items: [
      {
        id: "poi-1",
        barangId: "barang-1",
        quantity: 6,
        receivedQuantity: 0,
        cancelledQuantity: 0,
        cancelReason: null as string | null,
        purchasedQuantity: 4,
      },
      {
        id: "poi-2",
        barangId: "barang-2",
        quantity: 3,
        receivedQuantity: 0,
        cancelledQuantity: 0,
        cancelReason: null as string | null,
        purchasedQuantity: 3,
      },
      {
        id: "poi-other",
        barangId: "barang-other",
        quantity: 2,
        receivedQuantity: 0,
        cancelledQuantity: 0,
        cancelReason: null as string | null,
        purchasedQuantity: 2,
      },
    ],
    goodsReceipts: [] as never[],
    purchaseRecords: [
      recordRow("rec-1", "Toko A", [
        { purchaseOrderItemId: "poi-1", barangId: "barang-1", quantity: 3 },
        {
          purchaseOrderItemId: "poi-other",
          barangId: "barang-other",
          quantity: 2,
        },
      ]),
      recordRow("rec-2", "Toko B", [
        {
          purchaseOrderItemId: "poi-other",
          barangId: "barang-other",
          quantity: 0,
        },
      ]),
      recordRow("rec-3", "Toko C", [
        { purchaseOrderItemId: "poi-1", barangId: "barang-1", quantity: 1 },
      ]),
    ],
  };

  const request = {
    id: "pr-1",
    purchaseOrder: mergedOrder,
    items: [
      {
        id: "item-1",
        barangId: "barang-1",
        jumlah: 6,
        statusApproval: "APPROVED",
      },
      {
        id: "item-2",
        barangId: "barang-2",
        jumlah: 3,
        statusApproval: "REJECTED",
      },
    ],
  };

  it("mengisi purchaseOrderItemId dan purchasedQuantity; baris ditolak null/0", () => {
    const model = toRestockReadModel(request);

    expect(model.items[0]).toMatchObject({
      purchaseOrderItemId: "poi-1",
      purchasedQuantity: 4,
    });
    expect(model.items[1]).toMatchObject({
      purchaseOrderItemId: null,
      purchasedQuantity: 0,
    });
  });

  it("menyaring baris catatan ke pengajuan ini dan membuang catatan tanpa baris", () => {
    const model = toRestockReadModel(request);

    expect(model.purchaseRecords.map((record) => record.id)).toEqual([
      "rec-1",
      "rec-3",
    ]);
    expect(model.purchaseRecords[0].items).toEqual([
      {
        id: "rec-1-line-0",
        purchaseOrderItemId: "poi-1",
        barangId: "barang-1",
        nama: "Nama barang-1",
        satuan: "pcs",
        quantity: 3,
        unitPrice: null,
      },
    ]);
    expect(model.purchaseRecords[0].recordedBy).toEqual({ name: "Sari" });
  });

  it("catatan yang dibatalkan tetap ada (untuk riwayat) beserta siapa & alasannya", () => {
    const voidedAt = new Date("2026-11-09T02:00:00Z");
    const model = toRestockReadModel({
      ...request,
      purchaseOrder: {
        ...mergedOrder,
        purchaseRecords: [
          {
            ...recordRow("rec-9", "Toko Z", [
              {
                purchaseOrderItemId: "poi-1",
                barangId: "barang-1",
                quantity: 2,
              },
            ]),
            voidedAt,
            voidReason: "Salah catat",
            voidedBy: { name: "Admin" },
          },
        ],
      },
    });

    expect(model.purchaseRecords[0]).toMatchObject({
      id: "rec-9",
      voidedAt,
      voidReason: "Salah catat",
      voidedBy: { name: "Admin" },
    });
  });

  it("tidak menyertakan catatan belanja mentah di objek pesanan", () => {
    const model = toRestockReadModel(request);

    expect(model.purchaseOrder).not.toHaveProperty("purchaseRecords");
  });

  it("memberi daftar kosong bila belum ada pesanan", () => {
    const model = toRestockReadModel({ ...request, purchaseOrder: null });

    expect(model.purchaseRecords).toEqual([]);
    expect(model.items[0]).toMatchObject({
      purchaseOrderItemId: null,
      purchasedQuantity: 0,
    });
  });

  it("memuat catatan belanja terlama dulu di query daftar dan detail", async () => {
    const { db, repository } = createRepository([]);

    await repository.findPurchaseRequests({ tenantId: "tenant-1" });
    await repository.findPurchaseRequestDetail("pr-1", "tenant-1");

    const [listQuery] = db.purchaseRequest.findMany.mock.calls[0];
    const [detailQuery] = db.purchaseRequest.findFirst.mock.calls[0];
    for (const query of [
      listQuery.include.purchaseOrder.include,
      detailQuery.include.purchaseOrder.select,
    ]) {
      expect(query.purchaseRecords.orderBy).toEqual([
        { purchasedAt: "asc" },
        { createdAt: "asc" },
      ]);
      expect(query.purchaseRecords.select.items.select.barang).toEqual({
        select: { nama: true, satuan: true },
      });
    }
  });
});
