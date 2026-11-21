import { describe, expect, it, vi, type Mock } from "vitest";

import { InventoryPurchaseRequestRepository } from "@/modules/inventory/repositories/InventoryPurchaseRequestRepository";

interface RepositoryFixture {
  db: { purchaseRequest: { findMany: Mock; findFirst: Mock } };
  repository: InventoryPurchaseRequestRepository;
}

function createRepository(requests: unknown[]): RepositoryFixture {
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
    expect(request.items[1]).toEqual({
      id: "item-2",
      barangId: "barang-2",
      jumlah: 4,
      statusApproval: "REJECTED",
      orderedQuantity: 0,
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

  it("memuat pesanan seperlunya: nomor, status, angka barang, dan barang masuk terlama dulu", async () => {
    const { db, repository } = createRepository([]);

    await repository.findPurchaseRequests({ tenantId: "tenant-1" });
    await repository.findPurchaseRequestDetail("pr-1", "tenant-1");

    const [listQuery] = db.purchaseRequest.findMany.mock.calls[0];
    const [detailQuery] = db.purchaseRequest.findFirst.mock.calls[0];
    for (const purchaseOrderSelect of [
      listQuery.include.purchaseOrder.select,
      detailQuery.include.purchaseOrder.select,
    ]) {
      expect(Object.keys(purchaseOrderSelect).sort()).toEqual([
        "_count",
        "goodsReceipts",
        "id",
        "items",
        "poNumber",
        "status",
      ]);
      expect(purchaseOrderSelect._count).toEqual({
        select: { purchaseRequests: true },
      });
      expect(purchaseOrderSelect.items).toEqual({
        select: {
          barangId: true,
          quantity: true,
          receivedQuantity: true,
          cancelledQuantity: true,
          cancelReason: true,
        },
      });
      expect(purchaseOrderSelect.goodsReceipts.orderBy).toEqual({
        receivedAt: "asc",
      });
      expect(purchaseOrderSelect.goodsReceipts.select).toMatchObject({
        receivedBy: { select: { name: true } },
        items: expect.any(Object),
      });
    }
  });

  it("menyajikan barang masuk per GRN dengan penerima dan isinya", async () => {
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
    const receivingOrder = {
      ...purchaseOrder,
      id: "po-1",
      poNumber: "PO-1",
      status: "PARTIAL",
      goodsReceipts: [firstArrival, secondArrival],
    };
    const row = {
      id: "pr-1",
      purchaseOrder: receivingOrder,
      items: [
        {
          id: "item-1",
          barangId: "barang-1",
          jumlah: 6,
          statusApproval: "APPROVED",
        },
      ],
    };
    const { db, repository } = createRepository([row]);
    db.purchaseRequest.findFirst.mockResolvedValue(row);

    const [listed] = await repository.findPurchaseRequests({
      tenantId: "tenant-1",
    });
    const detail = await repository.findPurchaseRequestDetail(
      "pr-1",
      "tenant-1",
    );

    for (const request of [listed, detail]) {
      expect(request?.purchaseOrder).toMatchObject({
        id: "po-1",
        poNumber: "PO-1",
        status: "PARTIAL",
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
      expect(request?.items[0]).toEqual({
        id: "item-1",
        barangId: "barang-1",
        jumlah: 6,
        statusApproval: "APPROVED",
        orderedQuantity: 6,
        receivedQuantity: 2,
        cancelledQuantity: 0,
        cancelReason: null,
      });
    }
  });

  it("menyebut jumlah pengajuan yang memakai pesanannya sebagai linkedRequestCount, tanpa _count mentah", async () => {
    const { repository } = createRepository([
      {
        id: "pr-1",
        purchaseOrder: {
          ...purchaseOrder,
          id: "po-1",
          status: "ORDERED",
          _count: { purchaseRequests: 2 },
        },
        items: [],
      },
      { id: "pr-2", purchaseOrder, items: [] },
    ]);

    const [merged, single] = await repository.findPurchaseRequests({
      tenantId: "tenant-1",
    });

    expect(merged.purchaseOrder).toMatchObject({
      id: "po-1",
      status: "ORDERED",
      linkedRequestCount: 2,
    });
    expect(merged.purchaseOrder).not.toHaveProperty("_count");
    expect(single.purchaseOrder?.linkedRequestCount).toBe(1);
  });

  it("meneruskan alasan pembatalan dan catatan atasan pengajuan apa adanya", async () => {
    const { repository } = createRepository([
      {
        id: "pr-1",
        status: "CANCELLED",
        cancelReason: "Tidak jadi dibutuhkan",
        catatanApproval: "Setuju sebagian",
        purchaseOrder,
        items: [],
      },
    ]);

    const [request] = await repository.findPurchaseRequests({
      tenantId: "tenant-1",
    });

    expect(request).toMatchObject({
      cancelReason: "Tidak jadi dibutuhkan",
      catatanApproval: "Setuju sebagian",
    });
  });

  it("memberi daftar barang masuk kosong untuk pengajuan tanpa pesanan", async () => {
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
});
