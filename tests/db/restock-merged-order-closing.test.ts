import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Repository memakai klien ber-isolasi tenant; di tes ini cukup klien dasar
// yang sama-sama menembak Postgres uji, supaya yang diuji murni SQL-nya.
vi.mock("@/lib/prisma", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prisma")>();
  return { ...actual, prisma: actual.prismaAuth };
});
vi.mock("@/lib/logger", () => ({
  logActivitySafe: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
// Hanya kelas galat yang dibaca service Masukkan Barang; GRN-nya ditulis
// langsung lewat repository procurement di bawah.
vi.mock("@/modules/procurement", () => ({
  GoodsReceiptExceedsRemainingError: class extends Error {},
  GoodsReceiptInvalidError: class extends Error {},
  PurchaseOrderNotFoundError: class extends Error {},
  PurchaseRequestAlreadyOrderedError: class extends Error {},
  PurchaseRequestNotOrderableError: class extends Error {},
  SupplierNotActiveError: class extends Error {},
}));

import { prismaAuth } from "@/lib/prisma";
import type {
  CloseRestockRequestInput,
  CloseRestockRequestResult,
} from "@/modules/inventory/domain/ports/IRestockGoodsReceiptRepository";
import type { IRestockRequestLock } from "@/modules/inventory/domain/ports/IRestockRequestLock";
import { RestockGoodsReceiptRepository } from "@/modules/inventory/repositories/RestockGoodsReceiptRepository";
import {
  RestockGoodsReceiptService,
  type RestockGoodsReceiptInput,
  type RestockReceiptOutcome,
} from "@/modules/inventory/services/RestockGoodsReceiptService";
import { RestockItemSubstitutionService } from "@/modules/inventory/services/RestockItemSubstitutionService";
import {
  RestockRequestCancellationService,
  type RestockCancelResult,
} from "@/modules/inventory/services/RestockRequestCancellationService";
import type { GoodsReceiptEntity } from "@/modules/procurement/domain/entities/GoodsReceipt";
import { GoodsReceiptRepository } from "@/modules/procurement/repositories/GoodsReceiptRepository";

/**
 * Pesanan gabungan: satu pesanan dipakai dua pengajuan, dengan satu item
 * Kabel 10 yang dipakai bersama (5 + 5). Barangnya tidak bisa dipisah per
 * pengajuan, jadi selama pengajuan lain masih terbuka tidak ada sisa yang
 * dicoret; pengajuan terakhir yang ditutup mencoret sisanya dan menutup
 * pesanan. Hanya Postgres yang bisa membuktikan keputusan "pengajuan
 * terakhir" dibaca sesudah kunci pesanan, sehingga dua penutupan bersamaan
 * tidak sama-sama merasa terakhir atau sama-sama merasa bukan.
 *
 * Dilewati tanpa `TEST_DATABASE_URL`; lihat ./scripts/setup-test-db.sh.
 */

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const TENANT = "tenant-uji-po-gabungan";
const USER = "user-uji-po-gabungan";
const GUDANG = "gudang-uji-po-gabungan";
const KABEL = "barang-uji-po-gabungan";
const ORDER = "po-uji-po-gabungan";
const ORDER_ITEM = "poi-uji-po-gabungan";
const FIRST_REQUEST = "pr-uji-po-gabungan-1";
const SECOND_REQUEST = "pr-uji-po-gabungan-2";
const ORDERED = 10;
const SHARE_PER_REQUEST = 5;
const NOT_ENTERED_REASON = "Tidak dimasukkan ke gudang";
/** Cukup lama supaya penutupan sudah sampai di kunci pesanan sebelum kunci dilepas. */
const LOCK_HOLD_MS = 300;

const repository = new RestockGoodsReceiptRepository(prismaAuth);
const grnRepository = new GoodsReceiptRepository();
const freeLock: IRestockRequestLock = {
  acquire: async () => async () => undefined,
};
let grnSequence = 0;

/** GRN lewat transaksi procurement yang sesungguhnya: stok, barang_masuk, dan sisa pesanan. */
function createGoodsReceipt(
  input: RestockGoodsReceiptInput,
): Promise<GoodsReceiptEntity> {
  grnSequence += 1;
  return grnRepository.createAndPost({
    ...input,
    grnNumber: `GRN-UJI-PO-GABUNGAN-${grnSequence}`,
  });
}

const receiptService = new RestockGoodsReceiptService({
  repository,
  substitutionService: new RestockItemSubstitutionService(repository),
  purchaseOrderGenerator: { generatePOFromPRs: vi.fn() },
  goodsReceiptCreator: { create: createGoodsReceipt },
  lock: freeLock,
});
const cancellationService = new RestockRequestCancellationService(
  repository,
  freeLock,
);

async function bersihkan(): Promise<void> {
  await prismaAuth.barangMasuk.deleteMany({ where: { tenantId: TENANT } });
  await prismaAuth.barangGudang.deleteMany({ where: { gudangId: GUDANG } });
  await prismaAuth.goodsReceiptItem.deleteMany({ where: { tenantId: TENANT } });
  await prismaAuth.goodsReceipt.deleteMany({ where: { tenantId: TENANT } });
  await prismaAuth.purchaseRequestItem.deleteMany({
    where: { tenantId: TENANT },
  });
  await prismaAuth.purchaseRequest.deleteMany({ where: { tenantId: TENANT } });
  await prismaAuth.purchaseOrderItem.deleteMany({
    where: { purchaseOrderId: ORDER },
  });
  await prismaAuth.purchaseOrder.deleteMany({ where: { id: ORDER } });
  await prismaAuth.barang.deleteMany({ where: { id: KABEL } });
  await prismaAuth.gudang.deleteMany({ where: { id: GUDANG } });
  await prismaAuth.user.deleteMany({ where: { id: USER } });
  await prismaAuth.tenant.deleteMany({ where: { id: TENANT } });
}

async function seedRequest(
  id: string,
  status: "ORDERED" | "CANCELLED",
): Promise<void> {
  await prismaAuth.purchaseRequest.create({
    data: {
      id,
      nomorRequest: id.toUpperCase(),
      status,
      requesterId: USER,
      gudangId: GUDANG,
      tenantId: TENANT,
      purchaseOrderId: ORDER,
      updatedAt: new Date(),
      items: {
        create: {
          id: `${id}-kabel`,
          barangId: KABEL,
          jumlah: SHARE_PER_REQUEST,
          tenantId: TENANT,
          statusApproval: "APPROVED",
        },
      },
    },
  });
}

/** Pesanan gabungan ORDERED berisi Kabel 10 untuk dua pengajuan. */
async function seed(
  secondRequestStatus: "ORDERED" | "CANCELLED" = "ORDERED",
): Promise<void> {
  const now = new Date();
  await prismaAuth.tenant.create({
    data: { id: TENANT, name: "Tenant Uji PO Gabungan" },
  });
  await prismaAuth.user.create({
    data: {
      id: USER,
      email: "uji-po-gabungan@example.test",
      name: "Admin Uji",
      updatedAt: now,
      tenantId: TENANT,
    },
  });
  await prismaAuth.gudang.create({
    data: {
      id: GUDANG,
      kode: "GDG-UJI-PO-GABUNGAN",
      nama: "Gudang Uji",
      updatedAt: now,
      tenantId: TENANT,
    },
  });
  await prismaAuth.barang.create({
    data: {
      id: KABEL,
      kode: "BRG-UJI-PO-GABUNGAN",
      nama: "Kabel Uji",
      satuan: "roll",
      updatedAt: now,
      tenantId: TENANT,
    },
  });
  await prismaAuth.purchaseOrder.create({
    data: {
      id: ORDER,
      poNumber: "PO-UJI-PO-GABUNGAN",
      status: "ORDERED",
      totalAmount: 0,
      createdBy: USER,
      tenantId: TENANT,
      items: {
        create: {
          id: ORDER_ITEM,
          barangId: KABEL,
          quantity: ORDERED,
          unitPrice: 0,
          totalPrice: 0,
          tenantId: TENANT,
        },
      },
    },
  });
  await seedRequest(FIRST_REQUEST, "ORDERED");
  await seedRequest(SECOND_REQUEST, secondRequestStatus);
}

function enterGoods(
  purchaseRequestId: string,
  quantity: number,
): Promise<RestockReceiptOutcome> {
  return receiptService.receive({
    purchaseRequestId,
    receivedItems: { [KABEL]: quantity },
    substitutions: {},
    overReceipts: {},
    canIncreasePurchaseOrder: false,
    fotoBukti: ["/bukti.webp"],
    actorId: USER,
    tenantId: TENANT,
  });
}

function cancel(purchaseRequestId: string): Promise<RestockCancelResult> {
  return cancellationService.cancelRestockRequest({
    id: purchaseRequestId,
    tenantId: TENANT,
    actorId: USER,
    alasan: `Dibatalkan ${purchaseRequestId}`,
  });
}

async function readState(): Promise<{
  orderStatus: string;
  item: {
    receivedQuantity: number;
    cancelledQuantity: number;
    cancelReason: string | null;
  };
  requests: Record<string, { status: string; cancelReason: string | null }>;
}> {
  const order = await prismaAuth.purchaseOrder.findUniqueOrThrow({
    where: { id: ORDER },
    select: {
      status: true,
      items: {
        select: {
          receivedQuantity: true,
          cancelledQuantity: true,
          cancelReason: true,
        },
      },
    },
  });
  const requests = await prismaAuth.purchaseRequest.findMany({
    where: { tenantId: TENANT },
    select: { id: true, status: true, cancelReason: true },
  });
  return {
    orderStatus: order.status,
    item: order.items[0],
    requests: Object.fromEntries(
      requests.map((request) => [
        request.id,
        { status: request.status, cancelReason: request.cancelReason },
      ]),
    ),
  };
}

/** Penutupan Masukkan Barang tanpa barang baru, dengan snapshot item yang belum tersentuh. */
function entryClosing(purchaseRequestId: string): CloseRestockRequestInput {
  return {
    purchaseOrderId: ORDER,
    purchaseRequestId,
    ifOtherRequestsOpen: "SETTLE_REQUEST",
    ifLastOpenRequest: {
      settlement: "SETTLE_ORDER",
      cancellations: [
        {
          purchaseOrderItemId: ORDER_ITEM,
          cancelledQuantity: ORDERED,
          reason: NOT_ENTERED_REASON,
          expected: {
            quantity: ORDERED,
            receivedQuantity: 0,
            cancelledQuantity: 0,
          },
        },
      ],
    },
    actorId: USER,
    cancelledAt: new Date(),
  };
}

describeDb("Pesanan gabungan dengan barang bersama — Postgres", () => {
  beforeEach(async () => {
    await bersihkan();
    grnSequence = 0;
  });

  afterAll(async () => {
    await bersihkan();
  });

  it("Masukkan Barang pengajuan pertama tidak mencoret apa pun; pengajuan kedua mencoret sisanya dan menutup pesanan", async () => {
    await seed();

    const first = await enterGoods(FIRST_REQUEST, SHARE_PER_REQUEST);

    expect(first).toMatchObject({
      success: true,
      data: { purchaseRequestStatus: "RECEIVED", notEntered: [] },
    });
    expect(await readState()).toEqual({
      orderStatus: "PARTIAL",
      item: { receivedQuantity: 5, cancelledQuantity: 0, cancelReason: null },
      requests: {
        [FIRST_REQUEST]: { status: "RECEIVED", cancelReason: null },
        [SECOND_REQUEST]: { status: "ORDERED", cancelReason: null },
      },
    });

    const second = await enterGoods(SECOND_REQUEST, 3);

    expect(second).toMatchObject({
      success: true,
      data: {
        notEntered: [{ barangId: KABEL, barangName: "Kabel Uji", quantity: 2 }],
      },
    });
    expect(await readState()).toEqual({
      orderStatus: "RECEIVED",
      item: {
        receivedQuantity: 8,
        cancelledQuantity: 2,
        cancelReason: NOT_ENTERED_REASON,
      },
      requests: {
        [FIRST_REQUEST]: { status: "RECEIVED", cancelReason: null },
        [SECOND_REQUEST]: { status: "RECEIVED", cancelReason: null },
      },
    });
    const stock = await prismaAuth.barangGudang.findUniqueOrThrow({
      where: { barangId_gudangId: { barangId: KABEL, gudangId: GUDANG } },
      select: { stok: true, stokBaru: true },
    });
    expect(stock).toEqual({ stok: 8, stokBaru: 8 });
  });

  it("Batalkan pengajuan pertama selama pengajuan kedua terbuka: hanya pengajuan itu yang batal, pesanan tetap terbuka", async () => {
    await seed();

    const result = await cancel(FIRST_REQUEST);

    expect(result).toEqual({
      success: true,
      data: { id: FIRST_REQUEST, status: "CANCELLED" },
    });
    expect(await readState()).toEqual({
      orderStatus: "ORDERED",
      item: { receivedQuantity: 0, cancelledQuantity: 0, cancelReason: null },
      requests: {
        [FIRST_REQUEST]: {
          status: "CANCELLED",
          cancelReason: `Dibatalkan ${FIRST_REQUEST}`,
        },
        [SECOND_REQUEST]: { status: "ORDERED", cancelReason: null },
      },
    });
  });

  it("Batalkan pengajuan terakhir yang terbuka: semua sisa dicoret dengan alasannya dan pesanan ditutup", async () => {
    await seed("CANCELLED");

    const result = await cancel(FIRST_REQUEST);

    expect(result.success).toBe(true);
    expect(await readState()).toEqual({
      orderStatus: "RECEIVED",
      item: {
        receivedQuantity: 0,
        cancelledQuantity: ORDERED,
        cancelReason: `Dibatalkan ${FIRST_REQUEST}`,
      },
      requests: {
        [FIRST_REQUEST]: {
          status: "CANCELLED",
          cancelReason: `Dibatalkan ${FIRST_REQUEST}`,
        },
        [SECOND_REQUEST]: { status: "CANCELLED", cancelReason: null },
      },
    });
  });

  it("dua penutupan bersamaan: tepat satu menjadi pengajuan terakhir, sisa dicoret sekali, pesanan ditutup", async () => {
    await seed();

    const results = await Promise.all([
      repository.closeRequest(entryClosing(FIRST_REQUEST)),
      repository.closeRequest(entryClosing(SECOND_REQUEST)),
    ]);

    expect(results).toEqual(
      expect.arrayContaining([
        { isWritten: true, isLastOpenRequest: true },
        { isWritten: true, isLastOpenRequest: false },
      ]),
    );
    expect(await readState()).toEqual({
      orderStatus: "RECEIVED",
      item: {
        receivedQuantity: 0,
        cancelledQuantity: ORDERED,
        cancelReason: NOT_ENTERED_REASON,
      },
      requests: {
        [FIRST_REQUEST]: { status: "RECEIVED", cancelReason: null },
        [SECOND_REQUEST]: { status: "RECEIVED", cancelReason: null },
      },
    });
  });

  it("pengajuan lain dibaca sesudah menunggu kunci pesanan: penutupan yang selesai lebih dulu terlihat", async () => {
    await seed();
    let closing: Promise<CloseRestockRequestResult> | undefined;

    // Pengajuan kedua ditutup di transaksi yang memegang kunci pesanan;
    // penutupan pengajuan pertama dimulai di tengahnya dan harus menunggu.
    await prismaAuth.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM purchase_orders WHERE id = ${ORDER} FOR UPDATE`;
      closing = repository.closeRequest(entryClosing(FIRST_REQUEST));
      await new Promise((resolve) => setTimeout(resolve, LOCK_HOLD_MS));
      await tx.purchaseRequest.update({
        where: { id: SECOND_REQUEST },
        data: { status: "RECEIVED" },
      });
    });

    await expect(closing).resolves.toEqual({
      isWritten: true,
      isLastOpenRequest: true,
    });
    expect((await readState()).orderStatus).toBe("RECEIVED");
  });
});
