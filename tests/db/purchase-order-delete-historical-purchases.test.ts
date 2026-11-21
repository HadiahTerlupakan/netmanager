import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prismaAuth } from "@/lib/prisma";
import { PurchaseOrderRepository } from "@/modules/procurement/repositories/PurchaseOrderRepository";

/**
 * Hapus PO dari halaman procurement setelah tahap pembelian restock dihapus.
 * Hanya Postgres yang bisa membuktikan FK RESTRICT dari catatan belanja lama
 * (purchase_records.purchaseOrderId, purchase_record_items.purchaseOrderItemId)
 * dan ON DELETE SET NULL pada purchase_requests.purchaseOrderId.
 *
 * Dilewati tanpa `TEST_DATABASE_URL`; lihat ./scripts/setup-test-db.sh.
 */

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const TENANT = "tenant-uji-hapus-po";
const USER = "user-uji-hapus-po";
const GUDANG = "gudang-uji-hapus-po";
const BARANG = "barang-uji-hapus-po";
const ORDER = "po-uji-hapus-po";
const ORDER_ITEM = "poi-uji-hapus-po";
const OPEN_REQUEST = "pr-uji-hapus-po-terbuka";
const CANCELLED_REQUEST = "pr-uji-hapus-po-batal";
const CANCEL_REASON = "Barang tidak jadi dibutuhkan";

const repository = new PurchaseOrderRepository(prismaAuth as never);

interface RequestSnapshot {
  status: string;
  purchaseOrderId: string | null;
  cancelReason: string | null;
}

async function bersihkan(): Promise<void> {
  await prismaAuth.purchaseRecordItem.deleteMany({
    where: { tenantId: TENANT },
  });
  await prismaAuth.purchaseRecord.deleteMany({ where: { tenantId: TENANT } });
  await prismaAuth.goodsReceipt.deleteMany({ where: { tenantId: TENANT } });
  await prismaAuth.purchaseRequestItem.deleteMany({
    where: { tenantId: TENANT },
  });
  await prismaAuth.purchaseRequest.deleteMany({ where: { tenantId: TENANT } });
  await prismaAuth.purchaseOrderItem.deleteMany({
    where: { purchaseOrderId: ORDER },
  });
  await prismaAuth.purchaseOrder.deleteMany({ where: { id: ORDER } });
  await prismaAuth.barang.deleteMany({ where: { id: BARANG } });
  await prismaAuth.gudang.deleteMany({ where: { id: GUDANG } });
  await prismaAuth.user.deleteMany({ where: { id: USER } });
  await prismaAuth.tenant.deleteMany({ where: { id: TENANT } });
}

/**
 * Satu PO restock gabungan: satu pengajuan masih menunggu barangnya, satu lagi
 * sudah dibatalkan admin tetapi masih tertaut ke PO yang sama.
 */
async function seed(): Promise<void> {
  const now = new Date();
  await prismaAuth.tenant.create({
    data: { id: TENANT, name: "Tenant Uji Hapus PO" },
  });
  await prismaAuth.user.create({
    data: {
      id: USER,
      email: "uji-hapus-po@example.test",
      name: "Admin Uji",
      updatedAt: now,
      tenantId: TENANT,
    },
  });
  await prismaAuth.gudang.create({
    data: {
      id: GUDANG,
      kode: "GDG-UJI-HAPUS-PO",
      nama: "Gudang Uji",
      updatedAt: now,
      tenantId: TENANT,
    },
  });
  await prismaAuth.barang.create({
    data: {
      id: BARANG,
      kode: "BRG-UJI-HAPUS-PO",
      nama: "Kabel Uji",
      satuan: "roll",
      updatedAt: now,
      tenantId: TENANT,
    },
  });
  await prismaAuth.purchaseOrder.create({
    data: {
      id: ORDER,
      poNumber: "PO-UJI-HAPUS-PO",
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
  for (const [id, status] of [
    [OPEN_REQUEST, "ORDERED"],
    [CANCELLED_REQUEST, "CANCELLED"],
  ] as const) {
    await prismaAuth.purchaseRequest.create({
      data: {
        id,
        nomorRequest: id,
        status,
        cancelReason: status === "CANCELLED" ? CANCEL_REASON : null,
        requesterId: USER,
        gudangId: GUDANG,
        purchaseOrderId: ORDER,
        tenantId: TENANT,
        updatedAt: now,
        items: {
          create: {
            id: `${id}-item`,
            barangId: BARANG,
            jumlah: 5,
            tenantId: TENANT,
            statusApproval: "APPROVED",
          },
        },
      },
    });
  }
}

/** Catatan belanja lama untuk PO ini; `voidedAt` terisi = sudah dibatalkan. */
async function seedHistoricalPurchaseRecord(
  voidedAt: Date | null,
): Promise<void> {
  await prismaAuth.purchaseRecord.create({
    data: {
      purchaseOrderId: ORDER,
      purchasedAt: new Date(),
      recordedById: USER,
      tenantId: TENANT,
      voidedAt,
      voidedById: voidedAt ? USER : null,
      voidReason: voidedAt ? "Salah catat" : null,
      items: {
        create: {
          purchaseOrderItemId: ORDER_ITEM,
          barangId: BARANG,
          quantity: 3,
          tenantId: TENANT,
        },
      },
    },
  });
}

async function readRequest(id: string): Promise<RequestSnapshot> {
  return prismaAuth.purchaseRequest.findUniqueOrThrow({
    where: { id },
    select: { status: true, purchaseOrderId: true, cancelReason: true },
  });
}

async function expectNothingDeleted(): Promise<void> {
  expect(await prismaAuth.purchaseOrder.count({ where: { id: ORDER } })).toBe(
    1,
  );
  expect(
    await prismaAuth.purchaseOrderItem.count({ where: { id: ORDER_ITEM } }),
  ).toBe(1);
  expect(await readRequest(OPEN_REQUEST)).toEqual({
    status: "ORDERED",
    purchaseOrderId: ORDER,
    cancelReason: null,
  });
  expect(await readRequest(CANCELLED_REQUEST)).toEqual({
    status: "CANCELLED",
    purchaseOrderId: ORDER,
    cancelReason: CANCEL_REASON,
  });
}

describeDb("Hapus PO dengan catatan belanja lama — Postgres", () => {
  beforeEach(async () => {
    await bersihkan();
    await seed();
  });

  afterAll(async () => {
    await bersihkan();
  });

  it.each<[string, Date | null]>([
    ["yang sudah dibatalkan", new Date()],
    ["yang masih berlaku", null],
  ])(
    "catatan belanja %s menahan PO: HAS_PURCHASES dan tidak ada yang terhapus",
    async (_label, voidedAt) => {
      await seedHistoricalPurchaseRecord(voidedAt);

      const outcome = await repository.delete(ORDER);

      expect(outcome).toBe("HAS_PURCHASES");
      await expectNothingDeleted();
      expect(
        await prismaAuth.purchaseRecord.count({
          where: { purchaseOrderId: ORDER },
        }),
      ).toBe(1);
      expect(
        await prismaAuth.purchaseRecordItem.count({
          where: { purchaseOrderItemId: ORDER_ITEM },
        }),
      ).toBe(1);
    },
  );

  it("PO yang sudah punya GRN: HAS_GOODS_RECEIPTS dan tidak ada yang terhapus", async () => {
    await prismaAuth.goodsReceipt.create({
      data: {
        grnNumber: "GRN-UJI-HAPUS-PO",
        purchaseOrderId: ORDER,
        gudangId: GUDANG,
        receivedById: USER,
        tenantId: TENANT,
      },
    });

    const outcome = await repository.delete(ORDER);

    expect(outcome).toBe("HAS_GOODS_RECEIPTS");
    await expectNothingDeleted();
  });

  it("tanpa catatan belanja: PO terhapus, pengajuan terbuka kembali APPROVED, yang dibatalkan tetap dibatalkan", async () => {
    const outcome = await repository.delete(ORDER);

    expect(outcome).toBe("DELETED");
    expect(await prismaAuth.purchaseOrder.count({ where: { id: ORDER } })).toBe(
      0,
    );
    expect(
      await prismaAuth.purchaseOrderItem.count({
        where: { purchaseOrderId: ORDER },
      }),
    ).toBe(0);
    expect(await readRequest(OPEN_REQUEST)).toEqual({
      status: "APPROVED",
      purchaseOrderId: null,
      cancelReason: null,
    });
    // ON DELETE SET NULL melepas pengajuan yang sudah ditutup tanpa
    // menghidupkannya lagi.
    expect(await readRequest(CANCELLED_REQUEST)).toEqual({
      status: "CANCELLED",
      purchaseOrderId: null,
      cancelReason: CANCEL_REASON,
    });
  });
});
