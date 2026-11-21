import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// GRN memakai klien ber-isolasi tenant; di tes ini cukup klien dasar yang
// sama-sama menembak Postgres uji, supaya yang diuji murni SQL-nya.
vi.mock("@/lib/prisma", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prisma")>();
  return { ...actual, prisma: actual.prismaAuth };
});

import { prismaAuth } from "@/lib/prisma";
import { GoodsReceiptExceedsRemainingError } from "@/modules/procurement/domain/goods-receipt-errors";
import type { GoodsReceiptCreateInput } from "@/modules/procurement/domain/ports/IGoodsReceiptRepository";
import { GoodsReceiptRepository } from "@/modules/procurement/repositories/GoodsReceiptRepository";

/**
 * Penjaga sisa pesanan di transaksi GRN: UPDATE bersyarat
 * `"receivedQuantity" + qty <= "quantity" - "cancelledQuantity"` yang selalu
 * aktif. Hanya Postgres yang bisa membuktikan kondisi itu, rollback penuh GRN,
 * dan kunci pesanan yang membuat dua penerimaan bersamaan berjalan bergiliran.
 *
 * Dilewati tanpa `TEST_DATABASE_URL`; lihat ./scripts/setup-test-db.sh.
 */

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const TENANT = "tenant-uji-sisa-grn";
const USER = "user-uji-sisa-grn";
const GUDANG = "gudang-uji-sisa-grn";
const BARANG = "barang-uji-sisa-grn";
const ORDER = "po-uji-sisa-grn";
const ORDER_ITEM = "poi-uji-sisa-grn";
const OTHER_ORDER = "po-uji-sisa-grn-lain";
const OTHER_ORDER_ITEM = "poi-uji-sisa-grn-lain";
const ORDERED = 10;
const NOT_COMING = 4;
const REMAINING = ORDERED - NOT_COMING;

const grnRepo = new GoodsReceiptRepository();

async function bersihkan(): Promise<void> {
  await prismaAuth.barangMasuk.deleteMany({ where: { tenantId: TENANT } });
  await prismaAuth.barangGudang.deleteMany({ where: { gudangId: GUDANG } });
  await prismaAuth.goodsReceiptItem.deleteMany({ where: { tenantId: TENANT } });
  await prismaAuth.goodsReceipt.deleteMany({ where: { tenantId: TENANT } });
  await prismaAuth.purchaseOrderItem.deleteMany({
    where: { purchaseOrderId: { in: [ORDER, OTHER_ORDER] } },
  });
  await prismaAuth.purchaseOrder.deleteMany({
    where: { id: { in: [ORDER, OTHER_ORDER] } },
  });
  await prismaAuth.barang.deleteMany({ where: { id: BARANG } });
  await prismaAuth.gudang.deleteMany({ where: { id: GUDANG } });
  await prismaAuth.user.deleteMany({ where: { id: USER } });
  await prismaAuth.tenant.deleteMany({ where: { id: TENANT } });
}

async function seedOrder(
  id: string,
  itemId: string,
  cancelledQuantity: number,
): Promise<void> {
  await prismaAuth.purchaseOrder.create({
    data: {
      id,
      poNumber: id.toUpperCase(),
      status: "ORDERED",
      totalAmount: 0,
      createdBy: USER,
      tenantId: TENANT,
      items: {
        create: {
          id: itemId,
          barangId: BARANG,
          quantity: ORDERED,
          cancelledQuantity,
          unitPrice: 0,
          totalPrice: 0,
          tenantId: TENANT,
        },
      },
    },
  });
}

async function seed(): Promise<void> {
  const now = new Date();
  await prismaAuth.tenant.create({
    data: { id: TENANT, name: "Tenant Uji Sisa GRN" },
  });
  await prismaAuth.user.create({
    data: {
      id: USER,
      email: "uji-sisa-grn@example.test",
      name: "Admin Uji",
      updatedAt: now,
      tenantId: TENANT,
    },
  });
  await prismaAuth.gudang.create({
    data: {
      id: GUDANG,
      kode: "GDG-UJI-SISA-GRN",
      nama: "Gudang Uji",
      updatedAt: now,
      tenantId: TENANT,
    },
  });
  await prismaAuth.barang.create({
    data: {
      id: BARANG,
      kode: "BRG-UJI-SISA-GRN",
      nama: "Kabel Uji",
      satuan: "roll",
      updatedAt: now,
      tenantId: TENANT,
    },
  });
  await seedOrder(ORDER, ORDER_ITEM, NOT_COMING);
  await seedOrder(OTHER_ORDER, OTHER_ORDER_ITEM, 0);
}

function receiveInput(
  quantity: number,
  grnNumber: string,
  purchaseOrderItemId: string = ORDER_ITEM,
): GoodsReceiptCreateInput {
  return {
    grnNumber,
    purchaseOrderId: ORDER,
    gudangId: GUDANG,
    receivedById: USER,
    tenantId: TENANT,
    items: [{ purchaseOrderItemId, barangId: BARANG, quantity }],
  };
}

async function readReceivedQuantity(itemId: string): Promise<number> {
  const item = await prismaAuth.purchaseOrderItem.findUniqueOrThrow({
    where: { id: itemId },
    select: { receivedQuantity: true },
  });
  return item.receivedQuantity;
}

async function countReceiptRows(): Promise<{
  goodsReceipts: number;
  stockRows: number;
  stockIns: number;
}> {
  const [goodsReceipts, stockRows, stockIns] = await Promise.all([
    prismaAuth.goodsReceipt.count({ where: { tenantId: TENANT } }),
    prismaAuth.barangGudang.count({ where: { gudangId: GUDANG } }),
    prismaAuth.barangMasuk.count({ where: { tenantId: TENANT } }),
  ]);
  return { goodsReceipts, stockRows, stockIns };
}

describeDb("Penjaga sisa pesanan saat GRN — Postgres", () => {
  beforeEach(async () => {
    await bersihkan();
    await seed();
  });

  afterAll(async () => {
    await bersihkan();
  });

  it("menolak jumlah melebihi dipesan dikurangi yang tidak jadi datang, dan membatalkan seluruh transaksi", async () => {
    await expect(
      grnRepo.createAndPost(receiveInput(REMAINING + 1, "GRN-UJI-SISA-1")),
    ).rejects.toBeInstanceOf(GoodsReceiptExceedsRemainingError);

    expect(await readReceivedQuantity(ORDER_ITEM)).toBe(0);
    expect(await countReceiptRows()).toEqual({
      goodsReceipts: 0,
      stockRows: 0,
      stockIns: 0,
    });
    const order = await prismaAuth.purchaseOrder.findUniqueOrThrow({
      where: { id: ORDER },
    });
    expect(order.status).toBe("ORDERED");
  });

  it("menerima tepat sebesar sisa lalu menutup pesanan", async () => {
    await grnRepo.createAndPost(receiveInput(REMAINING, "GRN-UJI-SISA-2"));

    expect(await readReceivedQuantity(ORDER_ITEM)).toBe(REMAINING);
    const stock = await prismaAuth.barangGudang.findUniqueOrThrow({
      where: { barangId_gudangId: { barangId: BARANG, gudangId: GUDANG } },
    });
    expect(stock.stok).toBe(REMAINING);
    const order = await prismaAuth.purchaseOrder.findUniqueOrThrow({
      where: { id: ORDER },
    });
    expect(order.status).toBe("RECEIVED");
  });

  it("dua penerimaan bersamaan atas sisa yang sama: tepat satu yang tersimpan", async () => {
    const results = await Promise.allSettled([
      grnRepo.createAndPost(receiveInput(REMAINING, "GRN-UJI-SISA-3A")),
      grnRepo.createAndPost(receiveInput(REMAINING, "GRN-UJI-SISA-3B")),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(
      GoodsReceiptExceedsRemainingError,
    );
    expect(await readReceivedQuantity(ORDER_ITEM)).toBe(REMAINING);
    expect(await countReceiptRows()).toEqual({
      goodsReceipts: 1,
      stockRows: 1,
      stockIns: 1,
    });
  });

  it("item milik pesanan lain tidak bisa diterima lewat pesanan ini", async () => {
    await expect(
      grnRepo.createAndPost(
        receiveInput(1, "GRN-UJI-SISA-4", OTHER_ORDER_ITEM),
      ),
    ).rejects.toBeInstanceOf(GoodsReceiptExceedsRemainingError);

    expect(await readReceivedQuantity(OTHER_ORDER_ITEM)).toBe(0);
    expect((await countReceiptRows()).goodsReceipts).toBe(0);
  });
});
