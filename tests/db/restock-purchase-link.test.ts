import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prismaAuth } from "@/lib/prisma";
import type { CreatePurchaseRecordInput } from "@/modules/inventory/domain/ports/IRestockPurchaseRecordRepository";
import { RestockPurchaseLinkRepository } from "@/modules/inventory/repositories/RestockPurchaseLinkRepository";
import { InventoryPurchaseRequestRepository } from "@/modules/inventory/repositories/InventoryPurchaseRequestRepository";
import { RestockGoodsReceiptRepository } from "@/modules/inventory/repositories/RestockGoodsReceiptRepository";
import { RestockPurchaseRecordRepository } from "@/modules/inventory/repositories/RestockPurchaseRecordRepository";
import { PurchaseOrderRepository } from "@/modules/procurement/repositories/PurchaseOrderRepository";

/**
 * Link belanja tanpa login: hanya Postgres yang bisa membuktikan kunci baris
 * (`FOR UPDATE`/`FOR SHARE`), unique index `(purchaseLinkId, clientRequestId)`,
 * dan rollback transaksi saat kiriman dobel.
 *
 * Dilewati tanpa `TEST_DATABASE_URL`; lihat ./scripts/setup-test-db.sh.
 */

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const TENANT = "tenant-uji-link-belanja";
const USER = "user-uji-link-belanja";
const GUDANG = "gudang-uji-link-belanja";
const BARANG = "barang-uji-link-belanja";
const BARANG_LAIN = "barang-uji-link-belanja-lain";
const ORDER_ITEM_LAIN = "poi-uji-link-belanja-lain";
const REQUEST = "pr-uji-link-belanja";
const OTHER_REQUEST = "pr-uji-link-belanja-lain";
const ORDER = "po-uji-link-belanja";
const ORDER_ITEM = "poi-uji-link-belanja";
const CLIENT_REQUEST_ID = "6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f";

const links = new RestockPurchaseLinkRepository(prismaAuth as never);
const records = new RestockPurchaseRecordRepository(prismaAuth as never);

async function bersihkan() {
  await prismaAuth.purchaseRecordItem.deleteMany({
    where: { tenantId: TENANT },
  });
  await prismaAuth.purchaseRecord.deleteMany({ where: { tenantId: TENANT } });
  await prismaAuth.restockPurchaseLink.deleteMany({
    where: { tenantId: TENANT },
  });
  await prismaAuth.purchaseRequestItem.deleteMany({
    where: { tenantId: TENANT },
  });
  await prismaAuth.purchaseRequest.deleteMany({ where: { tenantId: TENANT } });
  await prismaAuth.purchaseOrderItem.deleteMany({
    where: { purchaseOrderId: ORDER },
  });
  await prismaAuth.purchaseOrder.deleteMany({ where: { id: ORDER } });
  await prismaAuth.barang.deleteMany({
    where: { id: { in: [BARANG, BARANG_LAIN] } },
  });
  await prismaAuth.gudang.deleteMany({ where: { id: GUDANG } });
  await prismaAuth.user.deleteMany({ where: { id: USER } });
  await prismaAuth.tenant.deleteMany({ where: { id: TENANT } });
}

async function seed() {
  const now = new Date();
  await prismaAuth.tenant.create({
    data: { id: TENANT, name: "Tenant Uji Link" },
  });
  await prismaAuth.user.create({
    data: {
      id: USER,
      email: "uji-link-belanja@example.test",
      name: "Admin Uji",
      updatedAt: now,
      tenantId: TENANT,
    },
  });
  await prismaAuth.gudang.create({
    data: {
      id: GUDANG,
      kode: "GDG-UJI",
      nama: "Gudang Uji",
      updatedAt: now,
      tenantId: TENANT,
    },
  });
  await prismaAuth.barang.create({
    data: {
      id: BARANG,
      kode: "BRG-UJI",
      nama: "Kabel Uji",
      satuan: "roll",
      updatedAt: now,
      tenantId: TENANT,
    },
  });
  await prismaAuth.purchaseOrder.create({
    data: {
      id: ORDER,
      poNumber: "PO-UJI-LINK",
      // Alur baru: pesanan baru menjadi ORDERED oleh belanja pertama lewat
      // link. ORDERED tanpa catatan belanja adalah data lama.
      status: "DRAFT",
      totalAmount: 0,
      createdBy: USER,
      tenantId: TENANT,
      items: {
        create: {
          id: ORDER_ITEM,
          barangId: BARANG,
          quantity: 10,
          unitPrice: 0,
          totalPrice: 0,
          tenantId: TENANT,
        },
      },
    },
  });
  for (const id of [REQUEST, OTHER_REQUEST]) {
    await prismaAuth.purchaseRequest.create({
      data: {
        id,
        nomorRequest: id,
        status: "ORDERED",
        requesterId: USER,
        gudangId: GUDANG,
        purchaseOrderId: id === REQUEST ? ORDER : null,
        tenantId: TENANT,
        updatedAt: now,
        items: {
          create: {
            id: `${id}-item`,
            barangId: BARANG,
            jumlah: 10,
            tenantId: TENANT,
            statusApproval: "APPROVED",
          },
        },
      },
    });
  }
}

function recordInput(
  overrides: Partial<CreatePurchaseRecordInput> = {},
): CreatePurchaseRecordInput {
  const now = new Date();
  return {
    purchaseOrderId: ORDER,
    purchaseRequestId: REQUEST,
    receivableBarangIds: [BARANG],
    tenantId: TENANT,
    recordedById: USER,
    purchasedAt: now,
    issuedAt: now,
    notes: null,
    lines: [
      {
        purchaseOrderItemId: ORDER_ITEM,
        barangId: BARANG,
        quantity: 3,
        unitPrice: null,
        expected: { quantity: 10, cancelledQuantity: 0 },
      },
    ],
    buyerName: "Joko",
    buyerSignatureKey: `restock-belanja/${TENANT}/${REQUEST}/ttd-uji.png`,
    // Selalu diganti pemanggil dengan id link yang dibuat lewat `createLink`.
    purchaseLinkId: "link-tidak-ada",
    clientRequestId: CLIENT_REQUEST_ID,
    ipAddress: "10.0.0.1",
    userAgent: "Uji",
    ...overrides,
  };
}

async function createLink(tokenHash: string) {
  const now = new Date();
  return links.replaceActiveLink({
    purchaseRequestId: REQUEST,
    tenantId: TENANT,
    tokenHash,
    expiresAt: new Date(now.getTime() + 60_000),
    createdById: USER,
    now,
  });
}

async function purchasedQuantity(): Promise<number> {
  const item = await prismaAuth.purchaseOrderItem.findUniqueOrThrow({
    where: { id: ORDER_ITEM },
  });
  return item.purchasedQuantity;
}

describeDb("Link belanja restock — Postgres", () => {
  beforeEach(async () => {
    await bersihkan();
    await seed();
  });

  afterAll(async () => {
    await bersihkan();
  });

  it("dua pembuatan link bersamaan menyisakan tepat satu link aktif", async () => {
    await Promise.all([createLink("a".repeat(64)), createLink("b".repeat(64))]);

    const active = await prismaAuth.restockPurchaseLink.count({
      where: { purchaseRequestId: REQUEST, revokedAt: null },
    });
    expect(active).toBe(1);
  });

  it("catatan setelah link dicabut ditolak dan jumlah dibeli tidak berubah", async () => {
    const link = await createLink("c".repeat(64));
    await links.revokeActiveLinks(REQUEST, TENANT, USER, new Date());

    const outcome = await records.createPurchaseRecord(
      recordInput({ purchaseLinkId: link.id }),
    );

    expect(outcome.kind).toBe("LINK_INACTIVE");
    expect(await purchasedQuantity()).toBe(0);
  });

  it("clientRequestId sama dikirim bersamaan → satu catatan, satu kenaikan", async () => {
    const link = await createLink("d".repeat(64));
    const input = recordInput({ purchaseLinkId: link.id });

    const outcomes = await Promise.all([
      records.createPurchaseRecord(input),
      records.createPurchaseRecord(input),
    ]);

    expect(outcomes.map((outcome) => outcome.kind).sort()).toEqual([
      "CREATED",
      "DUPLICATE",
    ]);
    expect(await purchasedQuantity()).toBe(3);
    expect(
      await prismaAuth.purchaseRecord.count({
        where: { purchaseLinkId: link.id },
      }),
    ).toBe(1);
  });

  it("kiriman dobel bersamaan yang membeli semua sisa → CREATED + DUPLICATE, bukan CONFLICT", async () => {
    const link = await createLink("7".repeat(64));
    const base = recordInput({ purchaseLinkId: link.id });
    const input = {
      ...base,
      lines: base.lines.map((line) => ({ ...line, quantity: 10 })),
    };

    const outcomes = await Promise.all([
      records.createPurchaseRecord(input),
      records.createPurchaseRecord(input),
    ]);

    expect(outcomes.map((outcome) => outcome.kind).sort()).toEqual([
      "CREATED",
      "DUPLICATE",
    ]);
    expect(await purchasedQuantity()).toBe(10);
  });

  it("tampilan catatan tidak memuat kunci tanda tangan", async () => {
    const link = await createLink("e".repeat(64));
    const outcome = await records.createPurchaseRecord(
      recordInput({ purchaseLinkId: link.id }),
    );

    expect(outcome.kind).toBe("CREATED");
    if (outcome.kind !== "CREATED") return;
    expect(outcome.record).toMatchObject({
      buyerName: "Joko",
      source: "PUBLIC_LINK",
      hasSignature: true,
    });
    expect(JSON.stringify(outcome.record)).not.toContain("ttd-uji");
  });

  it("kunci tanda tangan hanya untuk pengajuan pemilik pesanan", async () => {
    const link = await createLink("f".repeat(64));
    const outcome = await records.createPurchaseRecord(
      recordInput({ purchaseLinkId: link.id }),
    );
    if (outcome.kind !== "CREATED") throw new Error(outcome.kind);

    const own = await records.findSignatureKey({
      purchaseRequestId: REQUEST,
      recordId: outcome.record.id,
      tenantId: TENANT,
    });
    const other = await records.findSignatureKey({
      purchaseRequestId: OTHER_REQUEST,
      recordId: outcome.record.id,
      tenantId: TENANT,
    });
    const otherTenant = await records.findSignatureKey({
      purchaseRequestId: REQUEST,
      recordId: outcome.record.id,
      tenantId: "tenant-lain",
    });

    expect(own).toBe(`restock-belanja/${TENANT}/${REQUEST}/ttd-uji.png`);
    expect(other).toBeNull();
    expect(otherTenant).toBeNull();
  });

  it("pembuat link dinonaktifkan → link tidak berlaku saat dicari maupun dikunci", async () => {
    const link = await createLink("8".repeat(64));
    await prismaAuth.user.update({
      where: { id: USER },
      data: { isActive: false },
    });

    const found = await links.findByTokenHash("8".repeat(64));
    const outcome = await records.createPurchaseRecord(
      recordInput({ purchaseLinkId: link.id }),
    );

    expect(found?.isCreatorActive).toBe(false);
    expect(outcome.kind).toBe("LINK_INACTIVE");
    expect(await purchasedQuantity()).toBe(0);
  });

  it("findByTokenHash dan touchLastUsed dengan throttle", async () => {
    const link = await createLink("9".repeat(64));
    const found = await links.findByTokenHash("9".repeat(64));
    expect(found?.id).toBe(link.id);
    expect(found?.isCreatorActive).toBe(true);

    const first = new Date();
    await links.touchLastUsed(link.id, TENANT, first);
    await links.touchLastUsed(
      link.id,
      TENANT,
      new Date(first.getTime() + 1000),
    );
    const row = await prismaAuth.restockPurchaseLink.findUniqueOrThrow({
      where: { id: link.id },
    });
    expect(row.lastUsedAt?.getTime()).toBe(first.getTime());
  });

  async function activeLinkCount(): Promise<number> {
    return prismaAuth.restockPurchaseLink.count({
      where: { purchaseRequestId: REQUEST, revokedAt: null },
    });
  }

  it("belanja yang melengkapi daftar mencabut link di transaksi yang sama", async () => {
    const link = await createLink("1".repeat(64));

    const partial = await records.createPurchaseRecord(
      recordInput({ purchaseLinkId: link.id }),
    );
    expect(partial).toMatchObject({ kind: "CREATED", revokedLinkCount: 0 });
    expect(await activeLinkCount()).toBe(1);

    const base = recordInput({
      purchaseLinkId: link.id,
      clientRequestId: "7a1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f",
    });
    const rest = await records.createPurchaseRecord({
      ...base,
      lines: base.lines.map((line) => ({ ...line, quantity: 7 })),
    });

    expect(rest).toMatchObject({ kind: "CREATED", revokedLinkCount: 1 });
    expect(await activeLinkCount()).toBe(0);
    const row = await prismaAuth.restockPurchaseLink.findUniqueOrThrow({
      where: { id: link.id },
    });
    expect(row.revokedById).toBeNull();
  });

  it("pesanan yang digabung setelah link dibuat → LINK_INACTIVE, tidak ada yang tertulis", async () => {
    const link = await createLink("3".repeat(64));
    await prismaAuth.purchaseRequest.update({
      where: { id: OTHER_REQUEST },
      data: { purchaseOrderId: ORDER },
    });

    const outcome = await records.createPurchaseRecord(
      recordInput({ purchaseLinkId: link.id }),
    );
    const context = await records.findPurchaseContext(REQUEST, TENANT);

    expect(outcome.kind).toBe("LINK_INACTIVE");
    expect(await purchasedQuantity()).toBe(0);
    expect(context?.purchaseOrder?.linkedRequestCount).toBe(2);
  });

  it("pesanan data lama (ditandai dibeli sekaligus, tanpa catatan) → LINK_INACTIVE, tidak ada yang tertulis", async () => {
    const link = await createLink("8".repeat(64));
    await prismaAuth.purchaseOrder.update({
      where: { id: ORDER },
      data: { status: "ORDERED", issuedAt: new Date() },
    });

    const context = await records.findPurchaseContext(REQUEST, TENANT);
    const outcome = await records.createPurchaseRecord(
      recordInput({ purchaseLinkId: link.id }),
    );

    expect(context?.purchaseOrder?.isLegacyPurchased).toBe(true);
    expect(outcome.kind).toBe("LINK_INACTIVE");
    expect(await purchasedQuantity()).toBe(0);
    expect(
      await prismaAuth.purchaseRecord.count({
        where: { purchaseOrderId: ORDER },
      }),
    ).toBe(0);
  });

  it("batas 30 catatan per link dihitung di transaksi (termasuk yang dibatalkan)", async () => {
    const link = await createLink("4".repeat(64));
    await prismaAuth.purchaseRecord.createMany({
      data: Array.from({ length: 30 }, (_, index) => ({
        purchaseOrderId: ORDER,
        storeName: `Toko ${index}`,
        purchasedAt: new Date(),
        recordedById: USER,
        tenantId: TENANT,
        source: "PUBLIC_LINK" as const,
        purchaseLinkId: link.id,
        clientRequestId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        voidedAt: index === 0 ? new Date() : null,
      })),
    });

    const outcome = await records.createPurchaseRecord(
      recordInput({ purchaseLinkId: link.id }),
    );

    expect(outcome.kind).toBe("LINK_LIMIT");
    expect(await purchasedQuantity()).toBe(0);
  });

  it("pembatalan catatan: jumlah dibeli turun, catatan diabaikan semua pembacaan", async () => {
    const link = await createLink("5".repeat(64));
    const created = await records.createPurchaseRecord(
      recordInput({ purchaseLinkId: link.id }),
    );
    if (created.kind !== "CREATED") throw new Error(created.kind);
    expect(await purchasedQuantity()).toBe(3);

    const voided = await records.voidPurchaseRecord({
      purchaseRequestId: REQUEST,
      recordId: created.record.id,
      tenantId: TENANT,
      actorId: USER,
      reason: "Bukan belanja kita",
      now: new Date(),
    });

    expect(voided).toMatchObject({
      kind: "VOIDED",
      record: {
        voidReason: "Bukan belanja kita",
        voidedBy: { name: "Admin Uji" },
      },
    });
    expect(await purchasedQuantity()).toBe(0);

    // Kiriman ulang dengan penanda yang sama tidak dijawab "tersimpan".
    expect(
      await records.findByClientRequestId(link.id, CLIENT_REQUEST_ID, TENANT),
    ).toBeNull();
    // Daftar publik tidak menampilkan toko dari catatan yang dibatalkan.
    const source = await links.findPublicListSource(REQUEST, TENANT);
    expect(source?.records).toEqual([]);
    // Penjaga hapus pengajuan/pesanan mengabaikan catatan yang dibatalkan.
    const requestRepository = new InventoryPurchaseRequestRepository(
      prismaAuth as never,
    );
    expect(await requestRepository.hasPurchaseRecords(ORDER)).toBe(false);

    const again = await records.voidPurchaseRecord({
      purchaseRequestId: REQUEST,
      recordId: created.record.id,
      tenantId: TENANT,
      actorId: USER,
      reason: "Dua kali",
      now: new Date(),
    });
    expect(again.kind).toBe("ALREADY_VOIDED");
    expect(await purchasedQuantity()).toBe(0);
  });

  it("pembatalan tidak menurunkan jumlah di bawah nol", async () => {
    const link = await createLink("b2".repeat(32));
    const created = await records.createPurchaseRecord(
      recordInput({ purchaseLinkId: link.id }),
    );
    if (created.kind !== "CREATED") throw new Error(created.kind);
    await prismaAuth.purchaseOrderItem.update({
      where: { id: ORDER_ITEM },
      data: { purchasedQuantity: 1 },
    });

    await records.voidPurchaseRecord({
      purchaseRequestId: REQUEST,
      recordId: created.record.id,
      tenantId: TENANT,
      actorId: USER,
      reason: "Salah catat",
      now: new Date(),
    });

    expect(await purchasedQuantity()).toBe(0);
  });

  it("pembatalan ditolak untuk pengajuan lain maupun tenant lain", async () => {
    const link = await createLink("c3".repeat(32));
    const created = await records.createPurchaseRecord(
      recordInput({ purchaseLinkId: link.id }),
    );
    if (created.kind !== "CREATED") throw new Error(created.kind);

    const base = {
      recordId: created.record.id,
      actorId: USER,
      reason: "Coba coba",
      now: new Date(),
    };
    expect(
      await records.voidPurchaseRecord({
        ...base,
        purchaseRequestId: OTHER_REQUEST,
        tenantId: TENANT,
      }),
    ).toEqual({ kind: "NOT_FOUND" });
    expect(
      await records.voidPurchaseRecord({
        ...base,
        purchaseRequestId: REQUEST,
        tenantId: "tenant-lain",
      }),
    ).toEqual({ kind: "NOT_FOUND" });
    expect(await purchasedQuantity()).toBe(3);
  });

  it("pesanan selesai mencabut link pengajuannya di transaksi penutupan", async () => {
    await createLink("6".repeat(64));
    await prismaAuth.purchaseOrderItem.update({
      where: { id: ORDER_ITEM },
      data: { receivedQuantity: 10 },
    });

    const isWritten = await new RestockGoodsReceiptRepository(
      prismaAuth as never,
    ).applyReceiptSettlement({
      purchaseOrderId: ORDER,
      purchaseRequestId: REQUEST,
      settlement: "SETTLE_ORDER",
      actorId: USER,
    });

    expect(isWritten).toBe(true);
    expect(await activeLinkCount()).toBe(0);
  });

  it("pesanan dengan catatan yang sudah dibatalkan saja tetap bisa dihapus", async () => {
    const link = await createLink("0".repeat(64));
    const created = await records.createPurchaseRecord(
      recordInput({ purchaseLinkId: link.id }),
    );
    if (created.kind !== "CREATED") throw new Error(created.kind);
    await records.voidPurchaseRecord({
      purchaseRequestId: REQUEST,
      recordId: created.record.id,
      tenantId: TENANT,
      actorId: USER,
      reason: "Salah pesanan",
      now: new Date(),
    });

    const outcome = await new PurchaseOrderRepository(
      prismaAuth as never,
    ).delete(ORDER);

    expect(outcome).toBe("DELETED");
    expect(await activeLinkCount()).toBe(0);
    expect(
      await prismaAuth.purchaseRequest.findUniqueOrThrow({
        where: { id: REQUEST },
        select: { status: true, purchaseOrderId: true },
      }),
    ).toEqual({ status: "APPROVED", purchaseOrderId: null });
  });

  /**
   * Pesanan gabungan: OTHER_REQUEST ikut pesanan yang sama dan punya barang
   * tambahan (BARANG_LAIN) yang bukan milik REQUEST. Catatan belanja
   * OTHER_REQUEST memuat barang bersama dan barang tambahannya.
   */
  async function seedMergedOrderRecord() {
    const now = new Date();
    await prismaAuth.barang.create({
      data: {
        id: BARANG_LAIN,
        kode: "BRG-UJI-2",
        nama: "ONT Uji",
        satuan: "pcs",
        updatedAt: now,
        tenantId: TENANT,
      },
    });
    await prismaAuth.purchaseOrderItem.create({
      data: {
        id: ORDER_ITEM_LAIN,
        purchaseOrderId: ORDER,
        barangId: BARANG_LAIN,
        quantity: 5,
        unitPrice: 0,
        totalPrice: 0,
        tenantId: TENANT,
      },
    });
    await prismaAuth.purchaseRequest.update({
      where: { id: OTHER_REQUEST },
      data: {
        purchaseOrderId: ORDER,
        items: {
          create: {
            id: `${OTHER_REQUEST}-item-2`,
            barangId: BARANG_LAIN,
            jumlah: 5,
            tenantId: TENANT,
            statusApproval: "APPROVED",
          },
        },
      },
    });
    // Catatan lama dari sebelum belanja hanya dicatat lewat link: pesanan
    // gabungan tidak bisa dicatat lewat link, jadi data ini ditulis langsung.
    const created = await prismaAuth.purchaseRecord.create({
      data: {
        purchaseOrderId: ORDER,
        storeName: "Toko Uji",
        purchasedAt: now,
        recordedById: USER,
        tenantId: TENANT,
        source: "ADMIN",
        items: {
          create: [
            {
              purchaseOrderItemId: ORDER_ITEM,
              barangId: BARANG,
              quantity: 3,
              tenantId: TENANT,
            },
            {
              purchaseOrderItemId: ORDER_ITEM_LAIN,
              barangId: BARANG_LAIN,
              quantity: 2,
              tenantId: TENANT,
            },
          ],
        },
      },
      select: { id: true },
    });
    await prismaAuth.purchaseOrderItem.update({
      where: { id: ORDER_ITEM },
      data: { purchasedQuantity: 3 },
    });
    await prismaAuth.purchaseOrderItem.update({
      where: { id: ORDER_ITEM_LAIN },
      data: { purchasedQuantity: 2 },
    });
    return created.id;
  }

  async function otherPurchasedQuantity(): Promise<number> {
    const item = await prismaAuth.purchaseOrderItem.findUniqueOrThrow({
      where: { id: ORDER_ITEM_LAIN },
    });
    return item.purchasedQuantity;
  }

  it("pesanan gabungan: catatan yang memuat barang pengajuan lain tidak bisa dibatalkan dari pengajuan ini", async () => {
    const recordId = await seedMergedOrderRecord();
    const base = {
      recordId,
      tenantId: TENANT,
      actorId: USER,
      reason: "Coba batalkan dari gudang lain",
      now: new Date(),
    };

    const fromOther = await records.voidPurchaseRecord({
      ...base,
      purchaseRequestId: REQUEST,
    });

    expect(fromOther).toEqual({ kind: "SHARED_WITH_OTHER_REQUEST" });
    expect(await purchasedQuantity()).toBe(3);
    expect(await otherPurchasedQuantity()).toBe(2);
    const untouched = await prismaAuth.purchaseRecord.findUniqueOrThrow({
      where: { id: recordId },
    });
    expect(untouched.voidedAt).toBeNull();

    // Pengajuan pemilik semua barangnya tetap bisa membatalkan.
    const fromOwner = await records.voidPurchaseRecord({
      ...base,
      purchaseRequestId: OTHER_REQUEST,
    });
    expect(fromOwner.kind).toBe("VOIDED");
    expect(await purchasedQuantity()).toBe(0);
    expect(await otherPurchasedQuantity()).toBe(0);
  });

  it("pembatalan menyerahkan jejak audit (tanda tangan, IP, perangkat) untuk log", async () => {
    const link = await createLink("a1".repeat(32));
    const created = await records.createPurchaseRecord(
      recordInput({ purchaseLinkId: link.id }),
    );
    if (created.kind !== "CREATED") throw new Error(created.kind);

    const voided = await records.voidPurchaseRecord({
      purchaseRequestId: REQUEST,
      recordId: created.record.id,
      tenantId: TENANT,
      actorId: USER,
      reason: "Bukan belanja kita",
      now: new Date(),
    });

    expect(voided).toMatchObject({
      kind: "VOIDED",
      audit: {
        buyerSignatureKey: `restock-belanja/${TENANT}/${REQUEST}/ttd-uji.png`,
        purchaseLinkId: link.id,
        clientRequestId: CLIENT_REQUEST_ID,
        ipAddress: "10.0.0.1",
        userAgent: "Uji",
      },
    });
    if (voided.kind !== "VOIDED") return;
    expect(JSON.stringify(voided.record)).not.toContain("ttd-uji");
  });

  it("selesaikan tanpa kiriman mengunci pesanan lebih dulu, sebelum item (urutan kunci sama dengan pencatatan)", async () => {
    let releaseOrderLock: () => void = () => undefined;
    const orderLockReleased = new Promise<void>((resolve) => {
      releaseOrderLock = resolve;
    });
    let signalOrderLocked: () => void = () => undefined;
    const orderLocked = new Promise<void>((resolve) => {
      signalOrderLocked = resolve;
    });
    const holder = prismaAuth.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM purchase_orders WHERE id = ${ORDER} FOR UPDATE`;
        signalOrderLocked();
        await orderLockReleased;
      },
      { timeout: 15_000 },
    );
    await orderLocked;

    const finishing = new RestockGoodsReceiptRepository(
      prismaAuth as never,
    ).finishPurchaseOrderWithoutDelivery({
      purchaseOrderId: ORDER,
      purchaseRequestId: REQUEST,
      settlement: "SETTLE_REQUEST",
      actorId: USER,
      cancelledAt: new Date(),
      cancellations: [
        {
          purchaseOrderItemId: ORDER_ITEM,
          cancelledQuantity: 10,
          reason: "Tidak jadi dikirim",
          expected: { quantity: 10, receivedQuantity: 0, cancelledQuantity: 0 },
        },
      ],
    });
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Selama pesanan masih dikunci pihak lain, item belum disentuh: kunci
    // item masih bebas (NOWAIT tidak gagal) dan coretannya belum tertulis.
    const itemLock = await prismaAuth.$transaction(
      (tx) =>
        tx.$queryRaw<Array<{ id: string; cancelledQuantity: number }>>`
        SELECT id, "cancelledQuantity" FROM purchase_order_items
        WHERE id = ${ORDER_ITEM} FOR UPDATE NOWAIT`,
    );
    expect(itemLock).toEqual([{ id: ORDER_ITEM, cancelledQuantity: 0 }]);

    releaseOrderLock();
    await holder;
    expect(await finishing).toBe(true);
    const item = await prismaAuth.purchaseOrderItem.findUniqueOrThrow({
      where: { id: ORDER_ITEM },
    });
    expect(item.cancelledQuantity).toBe(10);
  });
});
