import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/modules/database";

import type {
  ApplyItemCancellationInput,
  ApplyItemSubstitutionInput,
  BarangSubstitutionCandidate,
  IncreaseItemQuantitiesInput,
  IRestockGoodsReceiptRepository,
  PurchaseOrderIncreaseUndo,
  RestockPurchaseOrderForReceipt,
  RestockPurchaseRequestForReceipt,
} from "../domain/ports/IRestockGoodsReceiptRepository";

type PrismaClientLike = PrismaClient;

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
    return this.db.purchaseRequest.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        purchaseOrderId: true,
        gudangId: true,
        status: true,
        nomorRequest: true,
      },
    });
  }

  /** Ambil purchase order beserta item-nya untuk validasi penerimaan. */
  async findPurchaseOrderWithItems(
    purchaseOrderId: string,
  ): Promise<RestockPurchaseOrderForReceipt | null> {
    return this.db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: {
        id: true,
        poNumber: true,
        status: true,
        items: {
          select: {
            id: true,
            barangId: true,
            quantity: true,
            receivedQuantity: true,
            cancelledQuantity: true,
            barang: { select: { id: true, nama: true } },
          },
        },
      },
    });
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
        await tx.purchaseRequestItem.updateMany({
          where: {
            barangId: substitution.fromBarangId,
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
  async hasOutstandingItems(purchaseOrderId: string): Promise<boolean> {
    const items = await this.db.purchaseOrderItem.findMany({
      where: { purchaseOrderId },
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

  /** Tandai purchase order sebagai diterima penuh. */
  async markPurchaseOrderReceived(
    purchaseOrderId: string,
    actorId: string,
  ): Promise<void> {
    await this.db.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: "RECEIVED", receivedById: actorId },
    });
  }

  /** Tandai purchase request sebagai diterima. */
  async markPurchaseRequestReceived(purchaseRequestId: string): Promise<void> {
    await this.db.purchaseRequest.update({
      where: { id: purchaseRequestId },
      data: { status: "RECEIVED" },
    });
  }
}
