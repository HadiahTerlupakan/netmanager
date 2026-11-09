import { describe, expect, it, vi } from "vitest";

import type { CreatePurchaseRecordInput } from "@/modules/inventory/domain/ports/IRestockPurchaseRecordRepository";
import type { PurchaseRecordViewRow } from "@/modules/inventory/repositories/restock-purchase-record.mapper";
import { RestockPurchaseRecordRepository } from "@/modules/inventory/repositories/RestockPurchaseRecordRepository";

const purchasedAt = new Date("2026-11-09T05:00:00Z");

const recordRow: PurchaseRecordViewRow = {
  id: "rec-1",
  storeName: "Toko Sinar",
  supplierId: null,
  purchasedAt,
  createdAt: purchasedAt,
  notes: null,
  fotoNota: [],
  recordedBy: { name: "Sari" },
  buyerName: null,
  source: "ADMIN",
  buyerSignatureKey: null,
  voidedAt: null,
  voidReason: null,
  voidedBy: null,
  items: [
    {
      id: "line-1",
      purchaseOrderItemId: "poi-1",
      barangId: "barang-1",
      quantity: 3,
      unitPrice: 12000,
      barang: { nama: "Kabel Fiber", satuan: "roll" },
    },
  ],
};

function createDb(
  lockedStatus: string | null = "DRAFT",
  purchasedAfterWrite = 3,
) {
  const callOrder: string[] = [];
  const tx = {
    $queryRaw: vi.fn(async (sqlParts: TemplateStringsArray) => {
      if (sqlParts.join("?").includes("restock_purchase_links")) {
        callOrder.push("lock-link");
        return [{ id: "link-1" }];
      }
      callOrder.push("lock");
      return lockedStatus ? [{ status: lockedStatus }] : [];
    }),
    $executeRaw: vi.fn(async () => {
      callOrder.push("increment");
      return 1;
    }),
    purchaseOrderItem: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "poi-1",
          barangId: "barang-1",
          quantity: 10,
          cancelledQuantity: 0,
          receivedQuantity: 0,
          purchasedQuantity: purchasedAfterWrite,
          barang: { nama: "Kabel Fiber", satuan: "roll" },
        },
      ]),
    },
    purchaseOrder: { update: vi.fn().mockResolvedValue({}) },
    purchaseRecord: {
      create: vi.fn().mockResolvedValue(recordRow),
      count: vi.fn().mockResolvedValue(0),
    },
    purchaseRequest: { count: vi.fn().mockResolvedValue(1) },
    restockPurchaseLink: {
      updateMany: vi.fn(async () => {
        callOrder.push("revoke-link");
        return { count: 1 };
      }),
    },
  };
  const db = {
    $transaction: vi.fn(async (work: (client: typeof tx) => unknown) =>
      work(tx),
    ),
    purchaseRequest: { findFirst: vi.fn() },
    purchaseRecord: { findFirst: vi.fn().mockResolvedValue(null) },
    supplier: { count: vi.fn() },
  };
  return { db, tx, callOrder };
}

function input(
  overrides: Partial<CreatePurchaseRecordInput> = {},
): CreatePurchaseRecordInput {
  return {
    purchaseOrderId: "po-1",
    purchaseRequestId: "pr-1",
    receivableBarangIds: ["barang-1"],
    tenantId: "tenant-1",
    recordedById: "user-1",
    storeName: "Toko Sinar",
    supplierId: null,
    purchasedAt,
    issuedAt: purchasedAt,
    notes: null,
    fotoNota: [],
    lines: [
      {
        purchaseOrderItemId: "poi-1",
        barangId: "barang-1",
        quantity: 3,
        unitPrice: 12000,
        expected: { quantity: 10, cancelledQuantity: 2 },
      },
    ],
    buyerName: null,
    buyerSignatureKey: null,
    source: "ADMIN",
    purchaseLinkId: null,
    clientRequestId: null,
    ipAddress: null,
    userAgent: null,
    ...overrides,
  };
}

describe("RestockPurchaseRecordRepository.createPurchaseRecord", () => {
  it("mengunci pesanan sebelum menaikkan jumlah dibeli, dengan penjaga sisa & snapshot", async () => {
    const { db, tx, callOrder } = createDb("ORDERED");

    await new RestockPurchaseRecordRepository(db as never).createPurchaseRecord(
      input(),
    );

    expect(callOrder).toEqual(["lock", "increment"]);
    const lockSql = (tx.$queryRaw.mock.calls[0] as unknown[])[0] as string[];
    expect(lockSql.join("?")).toContain("FOR UPDATE");
    const [sqlParts, ...values] = tx.$executeRaw.mock.calls[0] as unknown as [
      string[],
      ...unknown[],
    ];
    const sql = sqlParts.join("?");
    // Barang datang tanpa catatan dihitung dibeli: naik dari GREATEST.
    expect(sql).toContain(
      'SET "purchasedQuantity" = GREATEST("purchasedQuantity", "receivedQuantity") + ?',
    );
    expect(sql).toContain(
      'GREATEST("purchasedQuantity", "receivedQuantity") <= ?',
    );
    // jumlah, id item, id pesanan, snapshot jumlah & coret, lalu 10 − 2 − 3.
    expect(values).toEqual([3, "poi-1", "po-1", 10, 2, 5]);
    expect(tx.purchaseOrder.update).not.toHaveBeenCalled();
  });

  it("belanja pertama pada DRAFT mengisi tanggal beli dan pencatat", async () => {
    const { db, tx } = createDb("DRAFT");

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).createPurchaseRecord(input());

    expect(tx.purchaseOrder.update).toHaveBeenCalledWith({
      where: { id: "po-1" },
      data: {
        status: "ORDERED",
        issuedAt: purchasedAt,
        processedById: "user-1",
      },
    });
    expect(outcome).toMatchObject({
      kind: "CREATED",
      previousStatus: "DRAFT",
      purchaseOrderStatus: "ORDERED",
      record: {
        id: "rec-1",
        items: [{ nama: "Kabel Fiber", satuan: "roll", barangId: "barang-1" }],
      },
    });
  });

  it("menyimpan snapshot barang di tiap baris catatan", async () => {
    const { db, tx } = createDb("ORDERED");

    await new RestockPurchaseRecordRepository(db as never).createPurchaseRecord(
      input({ fotoNota: ["https://app.test/uploads/a.webp"] }),
    );

    expect(tx.purchaseRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          purchaseOrderId: "po-1",
          storeName: "Toko Sinar",
          fotoNota: ["https://app.test/uploads/a.webp"],
          tenantId: "tenant-1",
          items: {
            create: [
              {
                purchaseOrderItemId: "poi-1",
                barangId: "barang-1",
                quantity: 3,
                unitPrice: 12000,
                tenantId: "tenant-1",
              },
            ],
          },
        }),
      }),
    );
  });

  it("CONFLICT tanpa membuat catatan bila item sudah berubah", async () => {
    const { db, tx } = createDb("ORDERED");
    tx.$executeRaw.mockResolvedValue(0);

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).createPurchaseRecord(input());

    expect(outcome).toEqual({ kind: "CONFLICT" });
    expect(tx.purchaseRecord.create).not.toHaveBeenCalled();
  });

  it("kiriman dobel bersamaan yang kalah di penjaga sisa → DUPLICATE, bukan CONFLICT", async () => {
    const { db, tx } = createDb("ORDERED");
    tx.$executeRaw.mockResolvedValue(0);
    const findFirst = vi.fn().mockResolvedValue(recordRow);
    Object.assign(db, { purchaseRecord: { findFirst } });

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).createPurchaseRecord(
      input({
        source: "PUBLIC_LINK",
        purchaseLinkId: "link-1",
        clientRequestId: "11111111-1111-4111-8111-111111111111",
      }),
    );

    expect(outcome).toMatchObject({
      kind: "DUPLICATE",
      record: { id: "rec-1" },
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          purchaseLinkId: "link-1",
          clientRequestId: "11111111-1111-4111-8111-111111111111",
          tenantId: "tenant-1",
          voidedAt: null,
        },
      }),
    );
  });

  it("penjaga sisa gagal tanpa catatan kembar lewat link → tetap CONFLICT", async () => {
    const { db, tx } = createDb("ORDERED");
    tx.$executeRaw.mockResolvedValue(0);
    Object.assign(db, {
      purchaseRecord: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).createPurchaseRecord(
      input({
        source: "PUBLIC_LINK",
        purchaseLinkId: "link-1",
        clientRequestId: "11111111-1111-4111-8111-111111111111",
      }),
    );

    expect(outcome).toEqual({ kind: "CONFLICT" });
  });

  const LINK_INPUT = {
    source: "PUBLIC_LINK" as const,
    purchaseLinkId: "link-1",
    clientRequestId: "11111111-1111-4111-8111-111111111111",
  };

  it("lewat link: pesanan dikunci dulu, baru link (urutan kunci tetap)", async () => {
    const { db, callOrder } = createDb("ORDERED");

    await new RestockPurchaseRecordRepository(db as never).createPurchaseRecord(
      input(LINK_INPUT),
    );

    expect(callOrder.slice(0, 3)).toEqual(["lock", "lock-link", "increment"]);
  });

  it("lewat link: pesanan yang kini dipakai pengajuan lain → LINK_INACTIVE tanpa menulis", async () => {
    const { db, tx } = createDb("ORDERED");
    tx.purchaseRequest.count.mockResolvedValue(2);

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).createPurchaseRecord(input(LINK_INPUT));

    expect(outcome).toEqual({ kind: "LINK_INACTIVE" });
    expect(tx.purchaseRequest.count).toHaveBeenCalledWith({
      where: { purchaseOrderId: "po-1" },
    });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.purchaseRecord.create).not.toHaveBeenCalled();
  });

  it("lewat link: batas 30 catatan per link (termasuk yang dibatalkan) → LINK_LIMIT", async () => {
    const { db, tx } = createDb("ORDERED");
    tx.purchaseRecord.count.mockResolvedValue(30);

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).createPurchaseRecord(input(LINK_INPUT));

    expect(outcome).toEqual({ kind: "LINK_LIMIT" });
    expect(tx.purchaseRecord.count).toHaveBeenCalledWith({
      where: { purchaseLinkId: "link-1", tenantId: "tenant-1" },
    });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it("lewat link: catatan ke-30 masih boleh", async () => {
    const { db, tx } = createDb("ORDERED");
    tx.purchaseRecord.count.mockResolvedValue(29);

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).createPurchaseRecord(input(LINK_INPUT));

    expect(outcome).toMatchObject({ kind: "CREATED" });
  });

  it("lewat link: link yang sudah tidak berlaku saat dikunci → LINK_INACTIVE", async () => {
    const { db, tx } = createDb("ORDERED");
    tx.$queryRaw.mockImplementation(async (sqlParts: TemplateStringsArray) =>
      sqlParts.join("?").includes("restock_purchase_links")
        ? []
        : [{ status: "ORDERED" }],
    );

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).createPurchaseRecord(input(LINK_INPUT));

    expect(outcome).toEqual({ kind: "LINK_INACTIVE" });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it("lewat link: link sudah dicabut oleh kiriman kembar yang melengkapi daftar → DUPLICATE", async () => {
    const { db, tx } = createDb("ORDERED");
    tx.$queryRaw.mockImplementation(async (sqlParts: TemplateStringsArray) =>
      sqlParts.join("?").includes("restock_purchase_links")
        ? []
        : [{ status: "ORDERED" }],
    );
    db.purchaseRecord.findFirst.mockResolvedValue(recordRow);

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).createPurchaseRecord(input(LINK_INPUT));

    expect(outcome).toMatchObject({
      kind: "DUPLICATE",
      record: { id: "rec-1" },
    });
  });

  it("tanggal beli pesanan DRAFT memakai issuedAt, bukan tanggal belanja", async () => {
    const { db, tx } = createDb("DRAFT");
    const serverTime = new Date("2026-11-09T08:15:00Z");

    await new RestockPurchaseRecordRepository(db as never).createPurchaseRecord(
      input({ ...LINK_INPUT, issuedAt: serverTime }),
    );

    expect(tx.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ issuedAt: serverTime }),
      }),
    );
  });

  it("semua barang pengajuan sudah dibeli → link aktif pengajuan dicabut di transaksi yang sama", async () => {
    const { db, tx, callOrder } = createDb("ORDERED", 10);

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).createPurchaseRecord(input());

    expect(tx.restockPurchaseLink.updateMany).toHaveBeenCalledWith({
      where: {
        revokedAt: null,
        tenantId: "tenant-1",
        purchaseRequest: { id: "pr-1" },
      },
      data: { revokedAt: expect.any(Date), revokedById: null },
    });
    expect(callOrder.at(-1)).toBe("revoke-link");
    expect(outcome).toMatchObject({ kind: "CREATED", revokedLinkCount: 1 });
  });

  it("masih ada yang belum dibeli → link tidak dicabut", async () => {
    const { db, tx } = createDb("ORDERED", 3);

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).createPurchaseRecord(input());

    expect(tx.restockPurchaseLink.updateMany).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ kind: "CREATED", revokedLinkCount: 0 });
  });

  it("lewat link: indeks unik bentrok dengan catatan yang sudah dibatalkan → CONFLICT", async () => {
    const { db } = createDb("ORDERED");
    db.$transaction.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );
    Object.assign(db, {
      purchaseRecord: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).createPurchaseRecord(input(LINK_INPUT));

    expect(outcome).toEqual({ kind: "CONFLICT" });
  });

  it.each(["RECEIVED", "CANCELLED"])(
    "CLOSED bila pesanan sudah %s saat dikunci",
    async (status) => {
      const { db, tx } = createDb(status);

      const outcome = await new RestockPurchaseRecordRepository(
        db as never,
      ).createPurchaseRecord(input());

      expect(outcome).toEqual({ kind: "CLOSED" });
      expect(tx.$executeRaw).not.toHaveBeenCalled();
    },
  );

  it("CONFLICT bila transaksi gagal karena konflik tulis (P2034)", async () => {
    const { db } = createDb();
    db.$transaction.mockRejectedValue(
      Object.assign(new Error("write conflict"), { code: "P2034" }),
    );

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).createPurchaseRecord(input());

    expect(outcome).toEqual({ kind: "CONFLICT" });
  });

  it("CONFLICT bila Postgres mendeteksi deadlock (40P01)", async () => {
    const { db } = createDb();
    db.$transaction.mockRejectedValue(
      new Error('code: "40P01", message: "deadlock detected"'),
    );

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).createPurchaseRecord(input());

    expect(outcome).toEqual({ kind: "CONFLICT" });
  });

  it("meneruskan galat lain apa adanya", async () => {
    const { db } = createDb();
    db.$transaction.mockRejectedValue(new Error("koneksi putus"));

    await expect(
      new RestockPurchaseRecordRepository(db as never).createPurchaseRecord(
        input(),
      ),
    ).rejects.toThrow("koneksi putus");
  });
});

describe("RestockPurchaseRecordRepository — baca konteks", () => {
  it("hanya membaca barang dari baris yang tidak ditolak dan membuang pesanan tenant lain", async () => {
    const { db } = createDb();
    db.purchaseRequest.findFirst.mockResolvedValue({
      id: "pr-1",
      nomorRequest: "PR-1",
      status: "APPROVED",
      purchaseOrderId: "po-1",
      items: [{ barangId: "barang-1" }],
      purchaseOrder: {
        id: "po-1",
        poNumber: "PO-1",
        status: "DRAFT",
        tenantId: "tenant-lain",
        items: [],
        _count: { purchaseRequests: 1 },
      },
    });

    const context = await new RestockPurchaseRecordRepository(
      db as never,
    ).findPurchaseContext("pr-1", "tenant-1");

    const [query] = db.purchaseRequest.findFirst.mock.calls[0];
    expect(query.where).toEqual({ id: "pr-1", tenantId: "tenant-1" });
    expect(query.select.items.where).toEqual({
      statusApproval: { not: "REJECTED" },
    });
    expect(context).toEqual({
      request: {
        id: "pr-1",
        nomorRequest: "PR-1",
        status: "APPROVED",
        purchaseOrderId: "po-1",
        receivableBarangIds: ["barang-1"],
      },
      purchaseOrder: null,
    });
  });

  it("menganggap toko blacklist sebagai tidak aktif", async () => {
    const { db } = createDb();
    db.supplier.count.mockResolvedValue(0);

    const isActive = await new RestockPurchaseRecordRepository(
      db as never,
    ).isActiveSupplier("supplier-1", "tenant-1");

    expect(isActive).toBe(false);
    expect(db.supplier.count).toHaveBeenCalledWith({
      where: {
        id: "supplier-1",
        tenantId: "tenant-1",
        status: { not: "BLACKLISTED" },
      },
    });
  });
});

describe("RestockPurchaseRecordRepository — jumlah pengajuan di pesanan", () => {
  it("konteks membawa jumlah pengajuan yang memakai pesanan", async () => {
    const { db } = createDb();
    db.purchaseRequest.findFirst.mockResolvedValue({
      id: "pr-1",
      nomorRequest: "PR-1",
      status: "ORDERED",
      purchaseOrderId: "po-1",
      items: [{ barangId: "barang-1" }],
      purchaseOrder: {
        id: "po-1",
        poNumber: "PO-1",
        status: "ORDERED",
        tenantId: "tenant-1",
        items: [],
        _count: { purchaseRequests: 2 },
      },
    });

    const context = await new RestockPurchaseRecordRepository(
      db as never,
    ).findPurchaseContext("pr-1", "tenant-1");

    expect(context?.purchaseOrder).toEqual({
      id: "po-1",
      poNumber: "PO-1",
      status: "ORDERED",
      tenantId: "tenant-1",
      items: [],
      linkedRequestCount: 2,
    });
  });
});

describe("RestockPurchaseRecordRepository.voidPurchaseRecord", () => {
  const voidInput = {
    purchaseRequestId: "pr-1",
    recordId: "rec-1",
    tenantId: "tenant-1",
    actorId: "admin-1",
    reason: "Bukan belanja kita",
    now: new Date("2026-11-09T09:00:00Z"),
  };

  function createVoidDb(
    options: {
      orderStatus?: string;
      ownedRecord?: boolean;
      markedCount?: number;
      linkedRequestCount?: number;
      foreignLineCount?: number;
    } = {},
  ) {
    const callOrder: string[] = [];
    const tx = {
      purchaseRequest: {
        findFirst: vi.fn().mockResolvedValue({
          purchaseOrderId: "po-1",
          items: [{ barangId: "barang-1" }],
        }),
        count: vi.fn().mockResolvedValue(options.linkedRequestCount ?? 1),
      },
      purchaseRecord: {
        findFirst: vi
          .fn()
          .mockResolvedValue(
            options.ownedRecord === false ? null : { purchaseOrderId: "po-1" },
          ),
        updateMany: vi.fn(async () => {
          callOrder.push("mark");
          return { count: options.markedCount ?? 1 };
        }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...recordRow,
          voidedAt: voidInput.now,
          voidReason: voidInput.reason,
          voidedBy: { name: "Admin" },
          purchaseLinkId: "link-1",
          clientRequestId: "req-1",
          ipAddress: "10.0.0.1",
          userAgent: "Uji",
        }),
      },
      purchaseRecordItem: {
        count: vi.fn().mockResolvedValue(options.foreignLineCount ?? 0),
        findMany: vi.fn().mockResolvedValue([
          { purchaseOrderItemId: "poi-1", quantity: 3 },
          { purchaseOrderItemId: "poi-2", quantity: 2 },
        ]),
      },
      $queryRaw: vi.fn(async () => {
        callOrder.push("lock");
        return [{ status: options.orderStatus ?? "ORDERED", poNumber: "PO-1" }];
      }),
      $executeRaw: vi.fn(async () => {
        callOrder.push("decrement");
        return 1;
      }),
    };
    const db = {
      $transaction: vi.fn(async (work: (client: typeof tx) => unknown) =>
        work(tx),
      ),
    };
    return { db, tx, callOrder };
  }

  it("mengunci pesanan, menandai batal, lalu menurunkan jumlah dibeli (tidak di bawah 0)", async () => {
    const { db, tx, callOrder } = createVoidDb();

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).voidPurchaseRecord(voidInput);

    expect(callOrder).toEqual(["lock", "mark", "decrement", "decrement"]);
    const lockSql = (tx.$queryRaw.mock.calls[0] as unknown[])[0] as string[];
    expect(lockSql.join("?")).toContain("FOR UPDATE");
    expect(tx.purchaseRecord.updateMany).toHaveBeenCalledWith({
      where: { id: "rec-1", tenantId: "tenant-1", voidedAt: null },
      data: {
        voidedAt: voidInput.now,
        voidedById: "admin-1",
        voidReason: "Bukan belanja kita",
      },
    });
    const [sqlParts, ...values] = tx.$executeRaw.mock.calls[0] as unknown as [
      string[],
      ...unknown[],
    ];
    expect(sqlParts.join("?")).toContain(
      'SET "purchasedQuantity" = GREATEST("purchasedQuantity" - ?, 0)',
    );
    expect(values).toEqual([3, "poi-1", "po-1"]);
    expect(outcome).toMatchObject({
      kind: "VOIDED",
      poNumber: "PO-1",
      record: { id: "rec-1", voidReason: "Bukan belanja kita" },
    });
  });

  it("NOT_FOUND bila catatan bukan milik pesanan pengajuan ini", async () => {
    const { db, tx } = createVoidDb({ ownedRecord: false });

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).voidPurchaseRecord(voidInput);

    expect(outcome).toEqual({ kind: "NOT_FOUND" });
    expect(tx.purchaseRecord.updateMany).not.toHaveBeenCalled();
    expect(tx.purchaseRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pr-1", tenantId: "tenant-1" },
      }),
    );
  });

  it("ALREADY_VOIDED tanpa menurunkan jumlah lagi", async () => {
    const { db, tx } = createVoidDb({ markedCount: 0 });

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).voidPurchaseRecord(voidInput);

    expect(outcome).toEqual({ kind: "ALREADY_VOIDED" });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it.each(["RECEIVED", "CANCELLED"])(
    "CLOSED bila pesanan sudah %s",
    async (orderStatus) => {
      const { db, tx } = createVoidDb({ orderStatus });

      const outcome = await new RestockPurchaseRecordRepository(
        db as never,
      ).voidPurchaseRecord(voidInput);

      expect(outcome).toEqual({ kind: "CLOSED" });
      expect(tx.purchaseRecord.updateMany).not.toHaveBeenCalled();
    },
  );

  it("pesanan gabungan: catatan berisi barang pengajuan lain ditolak tanpa menulis apa pun", async () => {
    const { db, tx } = createVoidDb({
      linkedRequestCount: 2,
      foreignLineCount: 1,
    });

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).voidPurchaseRecord(voidInput);

    expect(outcome).toEqual({ kind: "SHARED_WITH_OTHER_REQUEST" });
    expect(tx.purchaseRecord.updateMany).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.purchaseRecordItem.count).toHaveBeenCalledWith({
      where: {
        purchaseRecordId: "rec-1",
        tenantId: "tenant-1",
        purchaseOrderItem: { barangId: { notIn: ["barang-1"] } },
      },
    });
  });

  it("pesanan gabungan: catatan yang semua barangnya milik pengajuan ini tetap bisa dibatalkan", async () => {
    const { db } = createVoidDb({ linkedRequestCount: 2, foreignLineCount: 0 });

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).voidPurchaseRecord(voidInput);

    expect(outcome.kind).toBe("VOIDED");
  });

  it("menyerahkan jejak audit catatan untuk log, terpisah dari tampilan", async () => {
    const { db } = createVoidDb();

    const outcome = await new RestockPurchaseRecordRepository(
      db as never,
    ).voidPurchaseRecord(voidInput);

    expect(outcome).toMatchObject({
      kind: "VOIDED",
      audit: {
        purchaseLinkId: "link-1",
        clientRequestId: "req-1",
        ipAddress: "10.0.0.1",
        userAgent: "Uji",
      },
    });
    if (outcome.kind !== "VOIDED") return;
    expect(outcome.record).not.toHaveProperty("ipAddress");
  });
});
