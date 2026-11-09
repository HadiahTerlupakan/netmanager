import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/modules/database";

import type {
  ApplyItemCancellationInput,
  ApplyItemSubstitutionInput,
  ApplyReceiptSettlementInput,
  BarangSubstitutionCandidate,
  FinishWithoutDeliveryInput,
  IncreaseItemQuantitiesInput,
  IRestockGoodsReceiptRepository,
  PurchaseOrderIncreaseUndo,
  PurchaseOrderPurchaseRecord,
  RestockPurchaseOrderForReceipt,
  RestockPurchaseRequestForReceipt,
} from "../domain/ports/IRestockGoodsReceiptRepository";
import { revokePurchaseLinksWithin } from "./restock-purchase-link-revocation";

type PrismaClientLike = PrismaClient;

/** Status pengajuan yang sudah final dan tidak boleh ditimpa. */
const FINAL_REQUEST_STATUSES = ["RECEIVED", "CANCELLED", "REJECTED"] as const;
const CANCELLABLE_ORDER_STATUSES = ["DRAFT", "ORDERED"] as const;
const CLOSED_ORDER_STATUSES = ["RECEIVED", "CANCELLED"] as const;

/** Dilempar di dalam transaksi supaya semua tulisan dibatalkan. */
class ReceiptConcurrentChange extends Error {}

/**
 * Akses data untuk alur verifikasi kedatangan barang restock.
 * Semua query Prisma milik alur ini terpusat di sini agar service tetap bebas ORM.
 */
export class RestockGoodsReceiptRepository implements IRestockGoodsReceiptRepository {
  constructor(private readonly db: PrismaClientLike = prisma) {}

  /** Ambil purchase request restock milik tenant untuk proses penerimaan. */
  async findPurchaseRequestForReceipt(
    id: string,
    tenantId: string,
  ): Promise<RestockPurchaseRequestForReceipt | null> {
    const request = await this.db.purchaseRequest.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        purchaseOrderId: true,
        gudangId: true,
        status: true,
        nomorRequest: true,
        items: {
          where: { statusApproval: { not: "REJECTED" } },
          select: { barangId: true },
        },
      },
    });
    if (!request) return null;
    const { items, ...rest } = request;
    return {
      ...rest,
      receivableBarangIds: items?.map((item) => item.barangId),
    };
  }

  /** Ambil purchase order beserta item-nya untuk validasi penerimaan. */
  async findPurchaseOrderWithItems(
    purchaseOrderId: string,
  ): Promise<RestockPurchaseOrderForReceipt | null> {
    const purchaseOrder = await this.db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: {
        id: true,
        poNumber: true,
        status: true,
        issuedAt: true,
        processedById: true,
        tenantId: true,
        paymentStatus: true,
        _count: {
          select: {
            jasaItems: true,
            goodsReceipts: true,
            purchaseRecords: true,
          },
        },
        items: {
          select: {
            id: true,
            barangId: true,
            quantity: true,
            receivedQuantity: true,
            cancelledQuantity: true,
            purchasedQuantity: true,
            barang: { select: { id: true, nama: true } },
          },
        },
      },
    });
    if (!purchaseOrder) return null;
    const { _count, ...rest } = purchaseOrder;
    return {
      ...rest,
      jasaItemCount: _count?.jasaItems ?? 0,
      goodsReceiptCount: _count?.goodsReceipts ?? 0,
      purchaseRecordCount: _count?.purchaseRecords ?? 0,
    };
  }

  /** Ambil status terkini purchase order. */
  async findPurchaseOrderStatus(
    purchaseOrderId: string,
  ): Promise<string | null> {
    const purchaseOrder = await this.db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: { status: true },
    });
    return purchaseOrder?.status ?? null;
  }

  /** Ambil barang milik tenant sebagai kandidat pengganti. */
  async findBarangCandidates(
    barangIds: string[],
    tenantId: string,
  ): Promise<BarangSubstitutionCandidate[]> {
    if (barangIds.length === 0) return [];
    return this.db.barang.findMany({
      where: { id: { in: barangIds }, tenantId },
      select: { id: true, nama: true },
    });
  }

  /**
   * Ganti barang pada item PO sekaligus item PR terkait dalam satu transaksi
   * agar dokumen pengajuan dan pesanan tetap konsisten.
   */
  async applyItemSubstitutions(
    input: ApplyItemSubstitutionInput,
  ): Promise<void> {
    if (input.substitutions.length === 0) return;

    await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const substitution of input.substitutions) {
        await tx.purchaseOrderItem.update({
          where: { id: substitution.purchaseOrderItemId },
          data: { barangId: substitution.toBarangId },
        });
        // Baris PR yang ditolak penyetuju tidak ikut PO, jadi tidak ikut
        // diganti. `barangIdDiminta` sengaja tidak disentuh: kolom itu
        // mencatat permintaan awal, bukan barang yang datang.
        await tx.purchaseRequestItem.updateMany({
          where: {
            barangId: substitution.fromBarangId,
            statusApproval: { not: "REJECTED" },
            purchaseRequest: {
              purchaseOrderId: input.purchaseOrderId,
              tenantId: input.tenantId,
            },
          },
          data: { barangId: substitution.toBarangId },
        });
      }
    });
  }

  /**
   * Anulir sisa pesanan per item PO (short close) beserta alasannya.
   * Quantity asli tidak diubah supaya riwayat pesanan tetap utuh.
   */
  async applyItemCancellations(
    input: ApplyItemCancellationInput,
  ): Promise<void> {
    if (input.cancellations.length === 0) return;

    await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const cancellation of input.cancellations) {
        await tx.purchaseOrderItem.update({
          where: { id: cancellation.purchaseOrderItemId },
          data: {
            cancelledQuantity: { increment: cancellation.cancelledQuantity },
            cancelReason: cancellation.reason,
            cancelledAt: input.cancelledAt,
          },
        });
      }
    });
  }

  /**
   * Naikkan jumlah item PO untuk kiriman yang lebih banyak dari pesanan, lalu
   * hitung ulang subtotal, PPN, dan grand total PO dengan rumus yang sama
   * seperti edit PO. PO yang sudah lunas jadi PARTIAL karena tagihannya naik.
   */
  async increaseItemQuantities(
    input: IncreaseItemQuantitiesInput,
  ): Promise<PurchaseOrderIncreaseUndo> {
    return this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const increase of input.increases) {
        await this.changeItemQuantity(
          tx,
          input.purchaseOrderId,
          increase.purchaseOrderItemId,
          increase.extraQuantity,
        );
      }
      const markedUnderpaid = await this.recalculatePurchaseOrderTotals(
        tx,
        input.purchaseOrderId,
      );
      return {
        purchaseOrderId: input.purchaseOrderId,
        increases: input.increases,
        markedUnderpaid,
      };
    });
  }

  /** Kembalikan kenaikan PO yang tidak jadi karena GRN gagal dibuat. */
  async undoItemQuantityIncrease(
    undo: PurchaseOrderIncreaseUndo,
  ): Promise<void> {
    await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const increase of undo.increases) {
        await this.changeItemQuantity(
          tx,
          undo.purchaseOrderId,
          increase.purchaseOrderItemId,
          -increase.extraQuantity,
        );
      }
      await this.recalculatePurchaseOrderTotals(tx, undo.purchaseOrderId);
      if (undo.markedUnderpaid) {
        // Hanya dikembalikan bila belum ada yang mengubah status bayarnya lagi.
        await tx.purchaseOrder.updateMany({
          where: { id: undo.purchaseOrderId, paymentStatus: "PARTIAL" },
          data: { paymentStatus: "PAID" },
        });
      }
    });
  }

  private async changeItemQuantity(
    tx: Prisma.TransactionClient,
    purchaseOrderId: string,
    purchaseOrderItemId: string,
    delta: number,
  ): Promise<void> {
    const item = await tx.purchaseOrderItem.findFirst({
      where: { id: purchaseOrderItemId, purchaseOrderId },
    });
    if (!item) {
      throw new Error(`Item PO ${purchaseOrderItemId} tidak ditemukan`);
    }
    // Selisih ditambahkan oleh database, bukan dari jumlah yang dibaca di
    // atas, supaya perubahan isi PO yang masuk bersamaan tidak tertimpa.
    const updated = await tx.purchaseOrderItem.update({
      where: { id: item.id },
      data: { quantity: { increment: delta } },
    });
    await tx.purchaseOrderItem.update({
      where: { id: item.id },
      data: { totalPrice: updated.quantity * updated.unitPrice },
    });
  }

  /** Mengembalikan true bila PO lunas berubah menjadi PARTIAL karena totalnya naik. */
  private async recalculatePurchaseOrderTotals(
    tx: Prisma.TransactionClient,
    purchaseOrderId: string,
  ): Promise<boolean> {
    const [barangItems, jasaItems, purchaseOrder] = await Promise.all([
      tx.purchaseOrderItem.findMany({ where: { purchaseOrderId } }),
      tx.purchaseOrderJasaItem.findMany({ where: { purchaseOrderId } }),
      tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId } }),
    ]);
    if (!purchaseOrder) {
      throw new Error(`Purchase Order ${purchaseOrderId} tidak ditemukan`);
    }
    const subtotal = [...barangItems, ...jasaItems].reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const ppnAmount = Math.round(
      (subtotal * (purchaseOrder.ppnRate ?? 0)) / 100,
    );
    const grandTotal = subtotal + ppnAmount;
    const becameUnderpaid =
      purchaseOrder.paymentStatus === "PAID" &&
      grandTotal > purchaseOrder.grandTotal;

    await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        totalAmount: subtotal,
        ppnAmount,
        grandTotal,
        ...(becameUnderpaid ? { paymentStatus: "PARTIAL" } : {}),
      },
    });
    return becameUnderpaid;
  }

  /** Cek apakah masih ada item PO yang belum diterima maupun dianulir. */
  async hasOutstandingItems(
    purchaseOrderId: string,
    barangIds?: string[],
  ): Promise<boolean> {
    const items = await this.db.purchaseOrderItem.findMany({
      where: {
        purchaseOrderId,
        ...(barangIds ? { barangId: { in: barangIds } } : {}),
      },
      select: {
        quantity: true,
        receivedQuantity: true,
        cancelledQuantity: true,
      },
    });
    return items.some(
      (item) =>
        item.quantity - item.receivedQuantity - item.cancelledQuantity > 0,
    );
  }

  /** Hitung purchase request yang tergabung di PO ini. */
  async countPurchaseRequestsForPurchaseOrder(
    purchaseOrderId: string,
  ): Promise<number> {
    return this.db.purchaseRequest.count({ where: { purchaseOrderId } });
  }

  /** Terapkan akibat penyimpanan penerimaan ke status PO & PR. */
  async applyReceiptSettlement(
    input: ApplyReceiptSettlementInput,
  ): Promise<boolean> {
    return this.runGuarded(input.purchaseOrderId, (tx) =>
      this.writeSettlement(tx, input),
    );
  }

  /** Coret sisa (bersyarat snapshot) dan terapkan status dalam satu transaksi. */
  async finishPurchaseOrderWithoutDelivery(
    input: FinishWithoutDeliveryInput,
  ): Promise<boolean> {
    return this.runGuarded(input.purchaseOrderId, async (tx) => {
      for (const cancellation of input.cancellations) {
        const result = await tx.purchaseOrderItem.updateMany({
          where: {
            id: cancellation.purchaseOrderItemId,
            purchaseOrderId: input.purchaseOrderId,
            quantity: cancellation.expected.quantity,
            receivedQuantity: cancellation.expected.receivedQuantity,
            cancelledQuantity: cancellation.expected.cancelledQuantity,
            ...(cancellation.expected.purchasedQuantity === undefined
              ? {}
              : { purchasedQuantity: cancellation.expected.purchasedQuantity }),
          },
          data: {
            cancelledQuantity: { increment: cancellation.cancelledQuantity },
            cancelReason: cancellation.reason,
            cancelledAt: input.cancelledAt,
          },
        });
        if (result.count === 0) throw new ReceiptConcurrentChange();
      }
      await this.writeSettlement(tx, input);
      if (input.revokeRequestLinks) {
        await revokePurchaseLinksWithin(tx, {
          scope: { id: input.purchaseRequestId },
          revokedById: null,
          now: new Date(),
        });
      }
    });
  }

  /**
   * Jalankan penutupan dalam satu transaksi yang diawali kunci baris pesanan
   * (`FOR UPDATE`). Urutannya sama dengan pencatatan belanja: pesanan, lalu
   * item, lalu link. Tanpa kunci awal ini, item dikunci lebih dulu lalu link
   * dicabut, sementara pencatatan lewat link memegang kunci link sambil
   * menunggu item, dan keduanya saling menunggu (deadlock).
   */
  private async runGuarded(
    purchaseOrderId: string,
    work: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<boolean> {
    try {
      await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.$queryRaw`
          SELECT id FROM purchase_orders WHERE id = ${purchaseOrderId} FOR UPDATE`;
        await work(tx);
      });
      return true;
    } catch (error) {
      if (error instanceof ReceiptConcurrentChange) return false;
      throw error;
    }
  }

  /**
   * Terapkan status penutupan, lalu cabut link belanja pengajuan yang kini
   * sudah final (selesai/dibatalkan) di transaksi yang sama.
   */
  private async writeSettlement(
    tx: Prisma.TransactionClient,
    input: ApplyReceiptSettlementInput,
  ): Promise<void> {
    await this.writeSettlementStatuses(tx, input);
    if (input.settlement === "KEEP_OPEN") return;
    await revokePurchaseLinksWithin(tx, {
      scope: {
        OR: [
          { id: input.purchaseRequestId },
          { purchaseOrderId: input.purchaseOrderId },
        ],
        status: { in: [...FINAL_REQUEST_STATUSES] },
      },
      revokedById: null,
      now: new Date(),
    });
  }

  private async writeSettlementStatuses(
    tx: Prisma.TransactionClient,
    input: ApplyReceiptSettlementInput,
  ): Promise<void> {
    const openRequest = {
      status: { notIn: [...FINAL_REQUEST_STATUSES] },
    };
    switch (input.settlement) {
      case "KEEP_OPEN":
        return;
      case "SETTLE_REQUEST":
        await tx.purchaseRequest.updateMany({
          where: { id: input.purchaseRequestId, ...openRequest },
          data: { status: "RECEIVED" },
        });
        return;
      case "SETTLE_ORDER":
        await tx.purchaseOrder.updateMany({
          where: {
            id: input.purchaseOrderId,
            status: { notIn: [...CLOSED_ORDER_STATUSES] },
          },
          data: { status: "RECEIVED", receivedById: input.actorId },
        });
        await tx.purchaseRequest.updateMany({
          where: { purchaseOrderId: input.purchaseOrderId, ...openRequest },
          data: { status: "RECEIVED" },
        });
        return;
      case "CANCEL_ORDER": {
        // Bersyarat: GRN, pembayaran, atau catatan belanja yang masuk
        // bersamaan membatalkan pembatalan ini, bukan ditimpa CANCELLED.
        // Barang yang sudah dibeli di toko tidak boleh hilang jejaknya.
        const result = await tx.purchaseOrder.updateMany({
          where: {
            id: input.purchaseOrderId,
            status: { in: [...CANCELLABLE_ORDER_STATUSES] },
            paymentStatus: "UNPAID",
            goodsReceipts: { none: {} },
            jasaItems: { none: {} },
            purchaseRecords: { none: { voidedAt: null } },
            items: {
              none: {
                OR: [
                  { receivedQuantity: { gt: 0 } },
                  { purchasedQuantity: { gt: 0 } },
                ],
              },
            },
          },
          data: { status: "CANCELLED" },
        });
        if (result.count === 0) throw new ReceiptConcurrentChange();
        await tx.purchaseRequest.updateMany({
          where: { id: input.purchaseRequestId, ...openRequest },
          data: { status: "CANCELLED" },
        });
        return;
      }
    }
  }

  /**
   * Catat pembeli dan tanggal beli PO tanpa mengubah statusnya. Hanya bila
   * tanggal beli masih kosong: catatan belanja yang tersimpan lebih dulu
   * (tanggal belanja & pencatatnya) tidak boleh ditimpa.
   */
  async recordPurchaseOrderPurchase(
    record: PurchaseOrderPurchaseRecord,
  ): Promise<void> {
    await this.db.purchaseOrder.updateMany({
      where: { id: record.purchaseOrderId, issuedAt: null },
      data: {
        processedById: record.processedById,
        issuedAt: record.issuedAt,
      },
    });
  }
}
