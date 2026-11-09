import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// GRN memakai klien ber-isolasi tenant; di tes ini cukup klien dasar yang
// sama-sama menembak Postgres uji, supaya yang diuji murni SQL-nya.
vi.mock("@/lib/prisma", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prisma")>();
  return { ...actual, prisma: actual.prismaAuth };
});

import { prismaAuth } from "@/lib/prisma";
import { RestockGoodsReceiptRepository } from "@/modules/inventory/repositories/RestockGoodsReceiptRepository";
import { RestockPurchaseRecordRepository } from "@/modules/inventory/repositories/RestockPurchaseRecordRepository";
import { GoodsReceiptExceedsPurchasedError } from "@/modules/procurement/domain/goods-receipt-errors";
import { GoodsReceiptRepository } from "@/modules/procurement/repositories/GoodsReceiptRepository";

/**
 * Tahap pembelian sebelum verifikasi barang sampai: hanya Postgres yang bisa
 * membuktikan UPDATE bersyarat, rollback penuh GRN, dan urutan kunci pesanan
 * antara pembatalan belanja dan pencatatan barang datang.
 *
 * Dilewati tanpa `TEST_DATABASE_URL`; lihat ./scripts/setup-test-db.sh.
 */

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const TENANT = "tenant-uji-batas-beli";
const USER = "user-uji-batas-beli";
const GUDANG = "gudang-uji-batas-beli";
const BARANG = "barang-uji-batas-beli";
const REQUEST = "pr-uji-batas-beli";
const ORDER = "po-uji-batas-beli";
const ORDER_ITEM = "poi-uji-batas-beli";
const RECORD = "rec-uji-batas-beli";
const PURCHASED = 3;

const grnRepo = new GoodsReceiptRepository();
const receiptRepo = new RestockGoodsReceiptRepository(prismaAuth as never);
const recordRepo = new RestockPurchaseRecordRepository(prismaAuth as never);

async function bersihkan() {
  await prismaAuth.barangMasuk.deleteMany({ where: { tenantId: TENANT } });
  await prismaAuth.barangGudang.deleteMany({ where: { gudangId: GUDANG } });
  await prismaAuth.goodsReceiptItem.deleteMany({ where: { tenantId: TENANT } });
  await prismaAuth.goodsReceipt.deleteMany({ where: { tenantId: TENANT } });
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
  await prismaAuth.barang.deleteMany({ where: { id: BARANG } });
  await prismaAuth.gudang.deleteMany({ where: { id: GUDANG } });
  await prismaAuth.user.deleteMany({ where: { id: USER } });
  await prismaAuth.tenant.deleteMany({ where: { id: TENANT } });
}

async function seed() {
  const now = new Date();
  await prismaAuth.tenant.create({
    data: { id: TENANT, name: "Tenant Uji Batas Beli" },
  });
  await prismaAuth.user.create({
    data: {
      id: USER,
      email: "uji-batas-beli@example.test",
      name: "Admin Uji",
      updatedAt: now,
      tenantId: TENANT,
    },
  });
  await prismaAuth.gudang.create({
    data: {
      id: GUDANG,
      kode: "GDG-UJI-BELI",
      nama: "Gudang Uji",
      updatedAt: now,
      tenantId: TENANT,
    },
  });
  await prismaAuth.barang.create({
    data: {
      id: BARANG,
      kode: "BRG-UJI-BELI",
      nama: "Kabel Uji",
      satuan: "roll",
      updatedAt: now,
      tenantId: TENANT,
    },
  });
  await prismaAuth.purchaseOrder.create({
    data: {
      id: ORDER,
      poNumber: "PO-UJI-BATAS-BELI",
      status: "ORDERED",
      totalAmount: 0,
      createdBy: USER,
      tenantId: TENANT,
      items: {
        create: {
          id: ORDER_ITEM,
          barangId: BARANG,
          quantity: 10,
          purchasedQuantity: PURCHASED,
          unitPrice: 0,
          totalPrice: 0,
          tenantId: TENANT,
        },
      },
    },
  });
  await prismaAuth.purchaseRequest.create({
    data: {
      id: REQUEST,
      nomorRequest: REQUEST,
      status: "ORDERED",
      requesterId: USER,
      gudangId: GUDANG,
      purchaseOrderId: ORDER,
      tenantId: TENANT,
      updatedAt: now,
      items: {
        create: {
          id: `${REQUEST}-item`,
          barangId: BARANG,
          jumlah: 10,
          tenantId: TENANT,
          statusApproval: "APPROVED",
        },
      },
    },
  });
  await prismaAuth.purchaseRecord.create({
    data: {
      id: RECORD,
      purchaseOrderId: ORDER,
      storeName: "Toko Uji",
      purchasedAt: now,
      recordedById: USER,
      tenantId: TENANT,
      items: {
        create: {
          purchaseOrderItemId: ORDER_ITEM,
          barangId: BARANG,
          quantity: PURCHASED,
          tenantId: TENANT,
        },
      },
    },
  });
}

function receiveInput(quantity: number, grnNumber: string) {
  return {
    grnNumber,
    purchaseOrderId: ORDER,
    gudangId: GUDANG,
    receivedById: USER,
    tenantId: TENANT,
    isLimitedToPurchased: true,
    items: [{ purchaseOrderItemId: ORDER_ITEM, barangId: BARANG, quantity }],
  };
}

async function readItem() {
  return prismaAuth.purchaseOrderItem.findUniqueOrThrow({
    where: { id: ORDER_ITEM },
  });
}

describeDb(
  "Batas sudah dibeli saat verifikasi barang sampai — Postgres",
  () => {
    beforeEach(async () => {
      await bersihkan();
      await seed();
    });

    afterAll(async () => {
      await bersihkan();
    });

    it("menolak kiriman melebihi yang dibeli dan membatalkan seluruh transaksi", async () => {
      await expect(
        grnRepo.createAndPost(receiveInput(PURCHASED + 1, "GRN-UJI-BELI-1")),
      ).rejects.toBeInstanceOf(GoodsReceiptExceedsPurchasedError);

      expect((await readItem()).receivedQuantity).toBe(0);
      expect(
        await prismaAuth.goodsReceipt.count({ where: { tenantId: TENANT } }),
      ).toBe(0);
      expect(
        await prismaAuth.barangGudang.count({ where: { gudangId: GUDANG } }),
      ).toBe(0);
      expect(
        await prismaAuth.barangMasuk.count({ where: { tenantId: TENANT } }),
      ).toBe(0);
    });

    it("menerima kiriman sebatas yang dibeli", async () => {
      await grnRepo.createAndPost(receiveInput(PURCHASED, "GRN-UJI-BELI-2"));

      expect((await readItem()).receivedQuantity).toBe(PURCHASED);
    });

    it("pembatalan belanja dan kiriman bersamaan tidak pernah membuat datang > dibeli", async () => {
      const results = await Promise.allSettled([
        recordRepo.voidPurchaseRecord({
          purchaseRequestId: REQUEST,
          recordId: RECORD,
          tenantId: TENANT,
          actorId: USER,
          reason: "Salah catat",
          now: new Date(),
        }),
        grnRepo.createAndPost(receiveInput(PURCHASED, "GRN-UJI-BELI-3")),
      ]);

      const item = await readItem();
      expect(item.receivedQuantity).toBeLessThanOrEqual(item.purchasedQuantity);
      // Tepat satu yang berhasil menulis: pembatalan atau kiriman.
      const [voidResult, grnResult] = results;
      const isVoided =
        voidResult.status === "fulfilled" && voidResult.value.kind === "VOIDED";
      const isReceived = grnResult.status === "fulfilled";
      expect(isVoided).not.toBe(isReceived);
    });

    it("penutupan sisa gagal bila jumlah dibeli berubah sejak dibaca", async () => {
      const isWritten = await receiptRepo.finishPurchaseOrderWithoutDelivery({
        purchaseOrderId: ORDER,
        purchaseRequestId: REQUEST,
        settlement: "KEEP_OPEN",
        actorId: USER,
        cancelledAt: new Date(),
        revokeRequestLinks: true,
        cancellations: [
          {
            purchaseOrderItemId: ORDER_ITEM,
            cancelledQuantity: 8,
            reason: "Barang habis di toko",
            expected: {
              quantity: 10,
              receivedQuantity: 0,
              cancelledQuantity: 0,
              purchasedQuantity: PURCHASED - 1,
            },
          },
        ],
      });

      expect(isWritten).toBe(false);
      expect((await readItem()).cancelledQuantity).toBe(0);
    });

    it("menutup sisa yang belum dibeli mencabut link walau pesanan tetap terbuka", async () => {
      const now = new Date();
      await prismaAuth.restockPurchaseLink.create({
        data: {
          purchaseRequestId: REQUEST,
          tokenHash: "e".repeat(64),
          expiresAt: new Date(now.getTime() + 60_000),
          createdById: USER,
          tenantId: TENANT,
        },
      });

      const isWritten = await receiptRepo.finishPurchaseOrderWithoutDelivery({
        purchaseOrderId: ORDER,
        purchaseRequestId: REQUEST,
        settlement: "KEEP_OPEN",
        actorId: USER,
        cancelledAt: now,
        revokeRequestLinks: true,
        cancellations: [
          {
            purchaseOrderItemId: ORDER_ITEM,
            cancelledQuantity: 10 - PURCHASED,
            reason: "Barang habis di toko",
            expected: {
              quantity: 10,
              receivedQuantity: 0,
              cancelledQuantity: 0,
              purchasedQuantity: PURCHASED,
            },
          },
        ],
      });

      expect(isWritten).toBe(true);
      expect((await readItem()).cancelledQuantity).toBe(10 - PURCHASED);
      expect(
        await prismaAuth.restockPurchaseLink.count({
          where: { purchaseRequestId: REQUEST, revokedAt: null },
        }),
      ).toBe(0);
      const order = await prismaAuth.purchaseOrder.findUniqueOrThrow({
        where: { id: ORDER },
      });
      expect(order.status).toBe("ORDERED");
    });
  },
);
