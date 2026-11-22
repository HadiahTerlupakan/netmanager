import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/modules/database";

import type {
  ApplyItemSubstitutionInput,
  BarangSubstitutionCandidate,
  CancelRequestWithoutOrderInput,
  CloseRestockRequestInput,
  CloseRestockRequestResult,
  GuardedItemCancellation,
  IncreaseItemQuantitiesInput,
  IRestockGoodsReceiptRepository,
  PurchaseOrderIncreaseUndo,
  RestockPurchaseOrderForReceipt,
  RestockPurchaseRequestForReceipt,
} from "../domain/ports/IRestockGoodsReceiptRepository";
import { APPROVED_OPEN_RESTOCK_STATUSES } from "../domain/restock-request-status";

type PrismaClientLike = PrismaClient;

/** Status pengajuan yang sudah final dan tidak boleh ditimpa. */
const FINAL_REQUEST_STATUSES = ["RECEIVED", "CANCELLED", "REJECTED"] as const;
const OPEN_REQUEST = { status: { notIn: [...FINAL_REQUEST_STATUSES] } };
const CANCELLABLE_ORDER_STATUSES = ["DRAFT", "ORDERED"] as const;
const CLOSED_ORDER_STATUSES = ["RECEIVED", "CANCELLED"] as const;
/** Baris yang ditolak atasan tidak ikut dipesan, dimasukkan, maupun diganti. */
const NOT_REJECTED_LINE = { statusApproval: { not: "REJECTED" } } as const;
const BARANG_NAME_SELECT = { select: { id: true, nama: true } } as const;

/** Dilempar di dalam transaksi supaya semua tulisan dibatalkan. */
class ReceiptConcurrentChange extends Error {}

/**
 * Akses data untuk Lapor Barang Sampai dan Batalkan pada pengajuan restock.
 * Semua query Prisma milik alur ini terpusat di sini agar service tetap bebas ORM.
 */
export class RestockGoodsReceiptRepository implements IRestockGoodsReceiptRepository {
  constructor(private readonly db: PrismaClientLike = prisma) {}

  /** Ambil pengajuan restock milik tenant beserta baris dan jasa yang tidak ditolak. */
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
          where: NOT_REJECTED_LINE,
          select: { barangId: true, jumlah: true, barang: BARANG_NAME_SELECT },
        },
        jasaItems: {
          where: NOT_REJECTED_LINE,
          select: { statusKonfirmasi: true },
        },
      },
    });
    if (!request) return null;
    const { items, ...rest } = request;
    return { ...rest, lines: items };
  }

  /** Ambil pesanan beserta item-nya untuk memeriksa dan menutup pengajuan. */
  async findPurchaseOrderWithItems(
    purchaseOrderId: string,
  ): Promise<RestockPurchaseOrderForReceipt | null> {
    const purchaseOrder = await this.db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        _count: {
          select: {
            jasaItems: true,
            // Bacaan data historis tahap pembelian: catatan belanja yang tidak
            // dibatalkan menahan pembatalan pesanan (lihat `cancelOrder`).
            purchaseRecords: { where: { voidedAt: null } },
          },
        },
        goodsReceipts: { select: { id: true } },
        items: {
          select: {
            id: true,
            barangId: true,
            quantity: true,
            receivedQuantity: true,
            cancelledQuantity: true,
            barang: BARANG_NAME_SELECT,
          },
        },
      },
    });
    if (!purchaseOrder) return null;
    const { _count, goodsReceipts, ...rest } = purchaseOrder;
    return {
      ...rest,
      jasaItemCount: _count.jasaItems,
      hasLegacyPurchases: _count.purchaseRecords > 0,
      goodsReceiptIds: goodsReceipts.map((receipt) => receipt.id),
    };
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
   * Ganti barang pada item PO sekaligus baris pengajuan terkait dalam satu
   * transaksi agar dokumen pengajuan dan pesanan tetap konsisten.
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
        await this.substituteRequestLines(tx, input, substitution);
      }
    });
  }

  /**
   * `barangIdDiminta` mencatat barang yang semula diajukan pemohon: diisi
   * barang asal hanya bila masih kosong. Bila atasan sudah mengganti barangnya
   * saat menyetujui, isian dari persetujuan itu yang dipertahankan.
   */
  private async substituteRequestLines(
    tx: Prisma.TransactionClient,
    input: ApplyItemSubstitutionInput,
    substitution: ApplyItemSubstitutionInput["substitutions"][number],
  ): Promise<void> {
    const orderedLines = {
      barangId: substitution.fromBarangId,
      ...NOT_REJECTED_LINE,
      purchaseRequest: {
        purchaseOrderId: input.purchaseOrderId,
        tenantId: input.tenantId,
      },
    };
    await tx.purchaseRequestItem.updateMany({
      where: { ...orderedLines, barangIdDiminta: null },
      data: {
        barangId: substitution.toBarangId,
        barangIdDiminta: substitution.fromBarangId,
      },
    });
    await tx.purchaseRequestItem.updateMany({
      where: { ...orderedLines, barangIdDiminta: { not: null } },
      data: { barangId: substitution.toBarangId },
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

  /** Hitung purchase request yang tergabung di PO ini. */
  async countPurchaseRequestsForPurchaseOrder(
    purchaseOrderId: string,
  ): Promise<number> {
    return this.db.purchaseRequest.count({ where: { purchaseOrderId } });
  }

  /**
   * Tutup pengajuan dalam satu transaksi yang diawali kunci baris pesanan
   * (`FOR UPDATE`), supaya penulisan lain atas pesanan yang sama menunggu
   * giliran: pesanan dikunci dulu, baru item dan status. Pengajuan lain yang
   * masih terbuka dibaca sesudah kunci, jadi dua pengajuan yang ditutup
   * bersamaan tidak bisa sama-sama merasa terakhir atau sama-sama merasa
   * bukan.
   */
  async closeRequest(
    input: CloseRestockRequestInput,
  ): Promise<CloseRestockRequestResult> {
    try {
      const isLastOpenRequest = await this.db.$transaction(
        async (tx: Prisma.TransactionClient) => {
          await tx.$queryRaw`
            SELECT id FROM purchase_orders WHERE id = ${input.purchaseOrderId} FOR UPDATE`;
          return this.applyClosingPlan(tx, input);
        },
      );
      return { isWritten: true, isLastOpenRequest };
    } catch (error) {
      if (error instanceof ReceiptConcurrentChange) return { isWritten: false };
      throw error;
    }
  }

  /** Batalkan pengajuan yang sudah disetujui tanpa pesanan, bersyarat status dan tanpa pesanan. */
  async cancelRequestWithoutOrder(
    input: CancelRequestWithoutOrderInput,
  ): Promise<boolean> {
    const result = await this.db.purchaseRequest.updateMany({
      where: {
        id: input.purchaseRequestId,
        tenantId: input.tenantId,
        status: { in: [...APPROVED_OPEN_RESTOCK_STATUSES] },
        purchaseOrderId: null,
      },
      data: { status: "CANCELLED", cancelReason: input.cancelReason },
    });
    return result.count === 1;
  }

  /**
   * Terapkan rencana yang sesuai dengan pengajuan lain di pesanan ini; true
   * bila pengajuan ini yang terakhir terbuka. Rencana terakhir mencoret sisa
   * item lalu ikut menutup pesanan; rencana lainnya hanya menutup pengajuan
   * ini.
   */
  private async applyClosingPlan(
    tx: Prisma.TransactionClient,
    input: CloseRestockRequestInput,
  ): Promise<boolean> {
    if (await this.hasOtherOpenRequests(tx, input)) {
      await this.writeRequestOnlyStatus(tx, input);
      return false;
    }
    for (const cancellation of input.ifLastOpenRequest.cancellations) {
      await this.strikeRemainder(tx, input, cancellation);
    }
    await this.writeOrderClosingStatuses(tx, input);
    return true;
  }

  /** Pesanan masih dipakai pengajuan lain yang belum ditutup. */
  private async hasOtherOpenRequests(
    tx: Prisma.TransactionClient,
    input: CloseRestockRequestInput,
  ): Promise<boolean> {
    const otherOpenRequests = await tx.purchaseRequest.count({
      where: {
        purchaseOrderId: input.purchaseOrderId,
        id: { not: input.purchaseRequestId },
        ...OPEN_REQUEST,
      },
    });
    return otherOpenRequests > 0;
  }

  /** Coret sisa satu item, hanya bila angkanya masih sama dengan snapshot. */
  private async strikeRemainder(
    tx: Prisma.TransactionClient,
    input: CloseRestockRequestInput,
    cancellation: GuardedItemCancellation,
  ): Promise<void> {
    const result = await tx.purchaseOrderItem.updateMany({
      where: {
        id: cancellation.purchaseOrderItemId,
        purchaseOrderId: input.purchaseOrderId,
        quantity: cancellation.expected.quantity,
        receivedQuantity: cancellation.expected.receivedQuantity,
        cancelledQuantity: cancellation.expected.cancelledQuantity,
      },
      data: {
        cancelledQuantity: { increment: cancellation.cancelledQuantity },
        cancelReason: cancellation.reason,
        cancelledAt: input.cancelledAt,
      },
    });
    if (result.count === 0) throw new ReceiptConcurrentChange();
  }

  /** Pesanan masih dipakai pengajuan lain: hanya pengajuan ini yang ditutup. */
  private async writeRequestOnlyStatus(
    tx: Prisma.TransactionClient,
    input: CloseRestockRequestInput,
  ): Promise<void> {
    switch (input.ifOtherRequestsOpen) {
      case "SETTLE_REQUEST":
        return this.settleRequest(tx, input);
      case "CANCEL_REQUEST":
        return this.cancelRequest(tx, input);
    }
  }

  /**
   * Pengajuan terakhir yang terbuka: pesanan ikut ditutup. Pengajuan lain di
   * pesanan ini tidak pernah disentuh; rencana ini hanya dipakai bila tidak
   * ada lagi yang terbuka.
   */
  private async writeOrderClosingStatuses(
    tx: Prisma.TransactionClient,
    input: CloseRestockRequestInput,
  ): Promise<void> {
    switch (input.ifLastOpenRequest.settlement) {
      case "SETTLE_ORDER":
        await this.markOrderReceived(tx, input);
        return this.settleRequest(tx, input);
      case "CANCEL_ORDER":
        await this.cancelOrder(tx, input.purchaseOrderId);
        return this.cancelRequest(tx, input);
      case "CANCEL_REQUEST_AND_SETTLE_ORDER":
        await this.cancelRequest(tx, input);
        return this.markOrderReceived(tx, input);
    }
  }

  private async markOrderReceived(
    tx: Prisma.TransactionClient,
    input: CloseRestockRequestInput,
  ): Promise<void> {
    await tx.purchaseOrder.updateMany({
      where: {
        id: input.purchaseOrderId,
        status: { notIn: [...CLOSED_ORDER_STATUSES] },
      },
      data: { status: "RECEIVED", receivedById: input.actorId },
    });
  }

  /**
   * Bersyarat: barang masuk, pembayaran, atau jasa yang masuk bersamaan
   * membatalkan pembatalan ini, bukan ditimpa CANCELLED. Syarat catatan
   * belanja adalah bacaan data historis tahap pembelian: catatan lama yang
   * tidak dibatalkan tetap menahan pembatalan pesanan.
   */
  private async cancelOrder(
    tx: Prisma.TransactionClient,
    purchaseOrderId: string,
  ): Promise<void> {
    const result = await tx.purchaseOrder.updateMany({
      where: {
        id: purchaseOrderId,
        status: { in: [...CANCELLABLE_ORDER_STATUSES] },
        paymentStatus: "UNPAID",
        goodsReceipts: { none: {} },
        jasaItems: { none: {} },
        purchaseRecords: { none: { voidedAt: null } },
        items: { none: { receivedQuantity: { gt: 0 } } },
      },
      data: { status: "CANCELLED" },
    });
    if (result.count === 0) throw new ReceiptConcurrentChange();
  }

  private async settleRequest(
    tx: Prisma.TransactionClient,
    input: CloseRestockRequestInput,
  ): Promise<void> {
    await this.writeOpenRequestStatus(tx, input, { status: "RECEIVED" });
  }

  private async cancelRequest(
    tx: Prisma.TransactionClient,
    input: CloseRestockRequestInput,
  ): Promise<void> {
    await this.writeOpenRequestStatus(tx, input, {
      status: "CANCELLED",
      cancelReason: input.cancelReason ?? null,
    });
  }

  /**
   * Status penutupan pengajuan ini, bersyarat masih terbuka dan masih memakai
   * pesanan ini; selain itu seluruh penutupan dibatalkan.
   */
  private async writeOpenRequestStatus(
    tx: Prisma.TransactionClient,
    input: CloseRestockRequestInput,
    data: { status: "RECEIVED" | "CANCELLED"; cancelReason?: string | null },
  ): Promise<void> {
    const result = await tx.purchaseRequest.updateMany({
      where: {
        id: input.purchaseRequestId,
        purchaseOrderId: input.purchaseOrderId,
        ...OPEN_REQUEST,
      },
      data,
    });
    if (result.count === 0) throw new ReceiptConcurrentChange();
  }
}
