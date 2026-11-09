import type {
  GuardedItemCancellation,
  IRestockGoodsReceiptRepository,
} from "../domain/ports/IRestockGoodsReceiptRepository";
import { RESTOCK_RECEIPT_ELIGIBILITY_MESSAGES } from "../domain/restock-receipt-eligibility";
import {
  INVENTORY_ACTIVITY_ACTIONS,
  INVENTORY_ACTIVITY_SUBJECTS,
  recordInventoryActivity,
} from "./inventory-activity-log";
import type {
  ResolvedCancellation,
  RestockItemCancellationService,
} from "./RestockItemCancellationService";
import {
  RECEIPT_CONCURRENT_CHANGE_MESSAGE,
  RestockReceiptInvalidError,
  type RestockReceiptResult,
} from "./restock-goods-receipt.contracts";
import {
  buildCancellationRequest,
  runCancellationStep,
  type ReceiptContext,
} from "./restock-receipt-context";
import {
  describeCloseReasonProblem,
  planUnpurchasedCancellations,
  withExpectedPurchasedQuantity,
} from "./restock-receipt-purchase-stage";
import {
  applyCancellationsToItems,
  canCancelUnfulfilledOrder,
  decideRestockReceiptSettlement,
  describeSettlementStatuses,
  hasOutstandingForBarang,
  toGuardedCancellations,
} from "./restock-receipt-settlement";

/**
 * Penutupan pengajuan restock tanpa barang datang: "sisanya tidak akan
 * datang" (selesai tanpa kiriman) dan "tutup sisa yang tidak jadi dibeli".
 * Keduanya mencoret sisa lalu menerapkan status dalam satu transaksi yang
 * bersyarat pada data yang dibaca.
 */
export class RestockReceiptClosure {
  constructor(
    private readonly repository: IRestockGoodsReceiptRepository,
    private readonly cancellationService: RestockItemCancellationService,
  ) {}

  /**
   * Tidak ada barang yang datang, tetapi sisanya dinyatakan tidak akan datang.
   * Tidak ada GRN, foto, maupun kenaikan pesanan. Pencoretan dan perubahan
   * status ditulis dalam satu transaksi yang bersyarat pada data yang dibaca,
   * sehingga kiriman yang dicatat bersamaan tidak tertimpa.
   */
  /** Selesaikan pesanan tanpa kiriman: sisa dinyatakan tidak akan datang. */
  async finishWithoutDelivery(
    context: ReceiptContext,
  ): Promise<RestockReceiptResult> {
    const { input, purchaseRequest, purchaseOrder } = context;
    const cancellationRequest = buildCancellationRequest({
      context,
      grnItems: [],
    });
    const cancellations = await runCancellationStep(() =>
      this.cancellationService.resolve(cancellationRequest),
    );

    const outcome = await this.writeFinishWithoutDelivery(context, {
      cancellations,
      guarded: toGuardedCancellations(purchaseOrder.items, cancellations),
      revokeRequestLinks: false,
    });
    await this.cancellationService.recordActivity(
      cancellations,
      cancellationRequest,
    );

    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.FINISH_WITHOUT_DELIVERY,
      subject: INVENTORY_ACTIVITY_SUBJECTS.RESTOCK_REQUEST,
      reference: purchaseRequest.nomorRequest,
      actorId: input.actorId,
      tenantId: input.tenantId,
      details: {
        purchaseRequestId: input.purchaseRequestId,
        purchaseOrderId: purchaseOrder.id,
        tidakJadiDatang: cancellations.map((cancellation) => ({
          barangId: cancellation.barangId,
          jumlah: cancellation.cancelledQuantity,
          alasan: cancellation.reason,
        })),
        tutupPesanan: input.closePO,
        statusPesanan: outcome.purchaseOrderStatus,
        statusPengajuan: outcome.purchaseRequestStatus,
      },
    });
    return { goodsReceipt: null, ...outcome };
  }

  /**
   * "Tutup sisa yang tidak jadi dibeli": hanya bagian yang belum dibeli yang
   * dicoret; barang yang sudah dibeli tetap ditunggu datang. Link belanja
   * pengajuan ini dicabut di transaksi yang sama. Laporan belanja yang masuk
   * bersamaan membuat penutupan gagal (syarat jumlah dibeli tidak berubah).
   */
  async closeUnpurchasedRemainder(
    context: ReceiptContext,
  ): Promise<RestockReceiptResult> {
    const { input, purchaseRequest, purchaseOrder } = context;
    const reason = (input.closeReason ?? "").trim();
    const reasonProblem = describeCloseReasonProblem(reason);
    if (reasonProblem) throw new RestockReceiptInvalidError(reasonProblem);

    // Data lama & pesanan gabungan dianggap sudah dibeli semua.
    const cancellations = context.isExemptFromPurchaseReport
      ? []
      : planUnpurchasedCancellations(
          purchaseOrder.items,
          context.ownedBarangIds,
          reason,
        );
    if (cancellations.length === 0) {
      throw new RestockReceiptInvalidError(
        RESTOCK_RECEIPT_ELIGIBILITY_MESSAGES.nothingUnpurchased,
      );
    }
    const guarded = withExpectedPurchasedQuantity(
      toGuardedCancellations(purchaseOrder.items, cancellations),
      purchaseOrder.items,
    );

    const outcome = await this.writeFinishWithoutDelivery(context, {
      cancellations,
      guarded,
      revokeRequestLinks: true,
    });
    await this.cancellationService.recordActivity(
      cancellations,
      buildCancellationRequest({ context, grnItems: [] }),
    );

    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.FINISH_WITHOUT_DELIVERY,
      subject: INVENTORY_ACTIVITY_SUBJECTS.RESTOCK_REQUEST,
      reference: purchaseRequest.nomorRequest,
      actorId: input.actorId,
      tenantId: input.tenantId,
      details: {
        purchaseRequestId: input.purchaseRequestId,
        purchaseOrderId: purchaseOrder.id,
        tidakJadiDibeli: cancellations.map((cancellation) => ({
          barangId: cancellation.barangId,
          jumlah: cancellation.cancelledQuantity,
        })),
        alasan: reason,
        statusPesanan: outcome.purchaseOrderStatus,
        statusPengajuan: outcome.purchaseRequestStatus,
      },
    });
    return { goodsReceipt: null, ...outcome };
  }

  /**
   * Langkah tulis bersama penyelesaian tanpa kiriman: hitung akibatnya pada
   * status, lalu coret sisa dan terapkan status dalam satu transaksi.
   */
  private async writeFinishWithoutDelivery(
    context: ReceiptContext,
    plan: {
      cancellations: ResolvedCancellation[];
      guarded: GuardedItemCancellation[];
      revokeRequestLinks: boolean;
    },
  ): Promise<Omit<RestockReceiptResult, "goodsReceipt">> {
    const { input, purchaseRequest, purchaseOrder } = context;
    const itemsAfter = applyCancellationsToItems(
      purchaseOrder.items,
      plan.cancellations,
    );
    const settlement = decideRestockReceiptSettlement({
      purchaseOrderStatus: purchaseOrder.status ?? null,
      hasOutstandingOnOrder: hasOutstandingForBarang(itemsAfter, null),
      hasOutstandingOnRequest: hasOutstandingForBarang(
        itemsAfter,
        context.ownedBarangIds,
      ),
      canCancelOrder: canCancelUnfulfilledOrder({
        purchaseOrderStatus: purchaseOrder.status ?? null,
        items: purchaseOrder.items,
        linkedRequestCount: context.linkedRequestCount,
        jasaItemCount: purchaseOrder.jasaItemCount ?? 0,
        goodsReceiptCount: purchaseOrder.goodsReceiptCount ?? 0,
        paymentStatus: purchaseOrder.paymentStatus ?? null,
      }),
    });

    const isWritten = await this.repository.finishPurchaseOrderWithoutDelivery({
      purchaseOrderId: purchaseOrder.id,
      purchaseRequestId: purchaseRequest.id,
      settlement,
      actorId: input.actorId,
      cancelledAt: new Date(),
      cancellations: plan.guarded,
      ...(plan.revokeRequestLinks ? { revokeRequestLinks: true } : {}),
    });
    if (!isWritten) {
      throw new RestockReceiptInvalidError(RECEIPT_CONCURRENT_CHANGE_MESSAGE);
    }
    return describeSettlementStatuses(settlement, {
      purchaseOrderStatus: purchaseOrder.status ?? null,
      purchaseRequestStatus: purchaseRequest.status,
    });
  }
}
