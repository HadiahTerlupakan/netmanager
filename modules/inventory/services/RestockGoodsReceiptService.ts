import {
  getGoodsReceiptService,
  GoodsReceiptExceedsPurchasedError,
  GoodsReceiptInvalidError,
  ProcurementService,
  PurchaseOrderNotFoundError,
} from "@/modules/procurement";

import { logger } from "@/lib/logger";

import type {
  IRestockGoodsReceiptRepository,
  PurchaseOrderIncreaseUndo,
  RestockPurchaseOrderForReceipt,
  RestockPurchaseOrderItem,
  RestockPurchaseRequestForReceipt,
} from "../domain/ports/IRestockGoodsReceiptRepository";
import {
  canReceiveWithoutPurchaseReport,
  isLegacyPurchasedOrder,
  RESTOCK_RECEIPT_ELIGIBILITY_MESSAGES,
} from "../domain/restock-receipt-eligibility";
import {
  buildPurchaseEvidence,
  describePurchaseStageProblem,
  readReceivedQuantity,
} from "./restock-receipt-purchase-stage";
import { RestockItemCancellationService } from "./RestockItemCancellationService";
import {
  RestockItemSubstitutionService,
  RestockSubstitutionInvalidError,
  type RestockSubstitutionMap,
} from "./RestockItemSubstitutionService";
import {
  decideRestockReceiptSettlement,
  describeSettlementStatuses,
  findForeignReceiptLine,
  resolveOwnedBarangIds,
  type RestockReceiptSettlement,
} from "./restock-receipt-settlement";
import {
  INVENTORY_ACTIVITY_ACTIONS,
  INVENTORY_ACTIVITY_SUBJECTS,
  recordInventoryActivity,
} from "./inventory-activity-log";
import {
  describeOverReceipts,
  resolveOverReceipts,
  RestockOverReceiptInvalidError,
  type ResolvedOverReceipt,
} from "./restock-over-receipt";
import {
  RESTOCK_MESSAGES,
  describeRestockStatus,
  restockServerErrorMessage,
} from "./restock-messages";
import {
  RECEIPT_PHOTO_MISSING_MESSAGE,
  NOTHING_RECEIVED_MESSAGE,
  PURCHASE_ORDER_NOT_GENERATED_MESSAGE,
  PURCHASE_ORDER_CANCELLED_MESSAGE,
  PURCHASE_ORDER_FINISHED_MESSAGE,
  RECEIPT_MISMATCH_MESSAGE,
  RestockReceiptNotFoundError,
  RestockReceiptInvalidError,
  RestockReceiptForbiddenError,
  RestockReceiptFailedError,
  describeForeignReceiptLine,
  isClosingUnpurchased,
  isFinishingWithoutDelivery,
  isNothingReceived,
  type ReceiveRestockRequestInput,
  type RestockReceiptResult,
} from "./restock-goods-receipt.contracts";
import {
  buildCancellationRequest,
  runCancellationStep,
  type ReceiptContext,
} from "./restock-receipt-context";
import { RestockReceiptClosure } from "./RestockReceiptClosure";

export {
  NOTHING_RECEIVED_MESSAGE,
  RECEIPT_CONCURRENT_CHANGE_MESSAGE,
  RestockReceiptFailedError,
  RestockReceiptForbiddenError,
  RestockReceiptInvalidError,
  RestockReceiptNotFoundError,
  type ReceiveRestockRequestInput,
  type RestockReceiptResult,
} from "./restock-goods-receipt.contracts";

interface ReceivableItem {
  purchaseOrderItemId: string;
  /** Barang yang tampil di pengajuan — jadi kunci input dari UI. */
  originalBarangId: string;
  /** Barang yang benar-benar dicatat ke GRN (bisa hasil substitusi). */
  barangId: string;
  barangName: string;
  quantity: number;
  remaining: number;
}

/** PO yang sudah ditutup atau dibatalkan tidak boleh dinaikkan jumlahnya. */
const PURCHASE_ORDER_STATUSES_CLOSED_FOR_INCREASE = ["CANCELLED", "RECEIVED"];
/**
 * Data lama tanpa tanggal beli: tanggal beli diisi sedikit sebelum kiriman
 * pertama, supaya pesanan tetap terbaca "dibeli sebelum barang datang" dan
 * kiriman berikutnya tidak tertahan.
 */
const LEGACY_ISSUED_AT_LEAD_MS = 1000;

/**
 * Orkestrasi verifikasi kedatangan barang restock: pastikan PO ada, terapkan
 * substitusi barang bila yang datang berbeda, lalu buat GRN agar stok, dokumen,
 * dan jurnal AUTO_GRN_CREATED ikut tercatat.
 */
export class RestockGoodsReceiptService {
  private readonly closure: RestockReceiptClosure;

  constructor(
    private readonly repository: IRestockGoodsReceiptRepository,
    private readonly substitutionService: RestockItemSubstitutionService,
    private readonly cancellationService: RestockItemCancellationService,
    private readonly procurementService: ProcurementService,
  ) {
    this.closure = new RestockReceiptClosure(repository, cancellationService);
  }

  /**
   * Catat barang yang datang dari pengajuan restock. Bila tidak ada barang
   * yang datang tetapi sisanya dinyatakan tidak akan datang, pesanan
   * diselesaikan tanpa kiriman (tanpa GRN dan tanpa foto).
   */
  async receive(
    input: ReceiveRestockRequestInput,
  ): Promise<RestockReceiptResult> {
    if (input.closeUnpurchased && !isNothingReceived(input)) {
      throw new RestockReceiptInvalidError(
        RESTOCK_RECEIPT_ELIGIBILITY_MESSAGES.closeWithDelivery,
      );
    }
    const purchaseRequest = await this.repository.findPurchaseRequestForReceipt(
      input.purchaseRequestId,
      input.tenantId,
    );
    if (!purchaseRequest) {
      throw new RestockReceiptNotFoundError(RESTOCK_MESSAGES.requestNotFound);
    }
    // Tanpa daftar belanja belum ada yang bisa dibeli lewat link. Ditolak di
    // sini supaya daftar belanja tidak dibuat lalu langsung ditolak.
    if (
      !purchaseRequest.purchaseOrderId &&
      !isFinishingWithoutDelivery(input) &&
      !isClosingUnpurchased(input)
    ) {
      throw new RestockReceiptInvalidError(
        RESTOCK_RECEIPT_ELIGIBILITY_MESSAGES.notPurchasedYet,
      );
    }

    const context = await this.loadReceiptContext(input, purchaseRequest);
    const foreignLine = findForeignReceiptLine(
      input,
      context.purchaseOrder.items,
      context.ownedBarangIds,
    );
    if (foreignLine) {
      throw new RestockReceiptInvalidError(
        describeForeignReceiptLine(foreignLine),
      );
    }
    if (isClosingUnpurchased(input)) {
      return this.closure.closeUnpurchasedRemainder(context);
    }
    if (isFinishingWithoutDelivery(input)) {
      return this.closure.finishWithoutDelivery(context);
    }
    if (isNothingReceived(input)) {
      throw new RestockReceiptInvalidError(NOTHING_RECEIVED_MESSAGE);
    }
    return this.receiveDelivery(context);
  }

  private async loadReceiptContext(
    input: ReceiveRestockRequestInput,
    purchaseRequest: RestockPurchaseRequestForReceipt,
  ): Promise<ReceiptContext> {
    const purchaseOrderId = await this.ensurePurchaseOrderId(
      purchaseRequest.purchaseOrderId,
      input.purchaseRequestId,
      input.actorId,
    );

    const purchaseOrder =
      await this.repository.findPurchaseOrderWithItems(purchaseOrderId);
    if (!purchaseOrder) {
      throw new RestockReceiptNotFoundError(
        RESTOCK_MESSAGES.purchaseOrderNotFound,
      );
    }
    // Ditolak juga oleh GRN, tapi di sini sebelum substitusi sempat ditulis.
    if (purchaseOrder.status === "CANCELLED") {
      throw new RestockReceiptInvalidError(PURCHASE_ORDER_CANCELLED_MESSAGE);
    }
    if (purchaseOrder.status === "RECEIVED") {
      throw new RestockReceiptInvalidError(PURCHASE_ORDER_FINISHED_MESSAGE);
    }
    const linkedRequestCount =
      await this.repository.countPurchaseRequestsForPurchaseOrder(
        purchaseOrderId,
      );
    const evidence = buildPurchaseEvidence(purchaseOrder, linkedRequestCount);
    return {
      input,
      purchaseRequest,
      purchaseOrder,
      linkedRequestCount,
      ownedBarangIds: resolveOwnedBarangIds(
        purchaseRequest,
        linkedRequestCount,
      ),
      evidence,
      isExemptFromPurchaseReport: canReceiveWithoutPurchaseReport(evidence),
    };
  }

  /**
   * Tahap pembelian harus dilewati dulu: per barang, jumlah datang tidak boleh
   * melebihi yang sudah dilaporkan dibeli dan belum datang. Diperiksa sebelum
   * substitusi karena substitusi sudah menulis ke database. Penjaga akhirnya
   * ada di transaksi GRN (`isLimitedToPurchased`).
   */
  private assertWithinPurchased(context: ReceiptContext): void {
    if (context.isExemptFromPurchaseReport) return;
    const problem = describePurchaseStageProblem(
      context.purchaseOrder.items,
      context.input.receivedItems,
      context.input.substitutions,
    );
    if (problem) throw new RestockReceiptInvalidError(problem);
  }

  /** Alur biasa: ada barang yang datang, jadi GRN dibuat dan stok bertambah. */
  private async receiveDelivery(
    context: ReceiptContext,
  ): Promise<RestockReceiptResult> {
    const { input, purchaseRequest, purchaseOrder } = context;
    const purchaseOrderId = purchaseOrder.id;

    if (input.fotoBukti.length === 0) {
      throw new RestockReceiptInvalidError(RECEIPT_PHOTO_MISSING_MESSAGE);
    }
    this.assertWithinPurchased(context);

    const appliedSubstitutions = await this.applySubstitutions({
      input,
      purchaseOrderId,
      purchaseOrderItems: purchaseOrder.items,
      referenceNumber: purchaseRequest.nomorRequest,
    });

    const receivableItems = this.buildReceivableItems(
      purchaseOrder.items,
      input.receivedItems,
      appliedSubstitutions,
    );
    const grnItems = this.selectReceivedItems(receivableItems);
    if (grnItems.length === 0) {
      throw new RestockReceiptInvalidError(NOTHING_RECEIVED_MESSAGE);
    }

    const cancellationRequest = buildCancellationRequest({
      context,
      grnItems,
    });
    await runCancellationStep(() =>
      this.cancellationService.validate(cancellationRequest),
    );

    const receivedAt = await this.anchorLegacyPurchaseDate(context);

    const { overReceipts, undo } = await this.applyOverReceipts({
      purchaseOrderId,
      purchaseOrderStatus: purchaseOrder.status,
      receivableItems,
      input,
    });

    const goodsReceipt = await this.createGoodsReceipt({
      purchaseOrderId,
      gudangId: purchaseRequest.gudangId,
      nomorRequest: purchaseRequest.nomorRequest,
      items: grnItems,
      overReceipts,
      undo,
      input,
      receivedAt,
      isLimitedToPurchased: !context.isExemptFromPurchaseReport,
    });

    if (context.isExemptFromPurchaseReport) {
      await this.recordPurchaseOnFirstReceipt(purchaseOrder, input.actorId);
    }

    await runCancellationStep(() =>
      this.cancellationService.apply(cancellationRequest),
    );

    const outcome = await this.syncReceivedStatus(context);

    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.RECEIVE,
      subject: INVENTORY_ACTIVITY_SUBJECTS.RESTOCK_REQUEST,
      reference: purchaseRequest.nomorRequest,
      actorId: input.actorId,
      tenantId: input.tenantId,
      details: {
        purchaseRequestId: input.purchaseRequestId,
        purchaseOrderId,
        goodsReceiptId: goodsReceipt.id,
        grnNumber: goodsReceipt.grnNumber,
        items: grnItems.map((item) => ({
          barangId: item.barangId,
          quantity: item.quantity,
        })),
        kelebihanKiriman: overReceipts.map((item) => ({
          barang: item.barangName,
          tambahan: item.extraQuantity,
          alasan: item.reason,
        })),
        jumlahFoto: input.fotoBukti.length,
        tutupPesanan: input.closePO,
      },
    });
    return { goodsReceipt, ...outcome };
  }

  /**
   * Data lama yang ditandai dibeli tanpa tanggal: tanggal beli diisi sedikit
   * sebelum kiriman ini, dan kiriman memakai waktu yang sama. Tanpa ini,
   * kiriman pertama menghapus tanda "data lama" dan kiriman berikutnya
   * tertahan menunggu laporan belanja yang tidak pernah ada.
   */
  private async anchorLegacyPurchaseDate(
    context: ReceiptContext,
  ): Promise<Date | undefined> {
    const { purchaseOrder, evidence, input } = context;
    if (purchaseOrder.issuedAt || !isLegacyPurchasedOrder(evidence)) {
      return undefined;
    }
    const receivedAt = new Date();
    await this.repository.recordPurchaseOrderPurchase({
      purchaseOrderId: purchaseOrder.id,
      processedById: purchaseOrder.processedById ?? input.actorId,
      issuedAt: new Date(receivedAt.getTime() - LEGACY_ISSUED_AT_LEAD_MS),
    });
    return receivedAt;
  }

  /**
   * Hanya untuk pesanan yang boleh diterima tanpa laporan belanja (pesanan
   * gabungan): barang yang datang berarti sudah dibeli, jadi penerimaan
   * pertama mencatat pembeli dan tanggalnya. Status pesanan sendiri sudah
   * diubah GRN menjadi PARTIAL/RECEIVED.
   */
  private async recordPurchaseOnFirstReceipt(
    purchaseOrder: RestockPurchaseOrderForReceipt,
    actorId: string,
  ): Promise<void> {
    if (purchaseOrder.status !== "DRAFT") return;
    // Stok sudah masuk lewat GRN; kegagalan mencatat tanggal beli tidak boleh
    // memutus pencoretan & status sesudahnya (petugas akan mengulang dan
    // barang tercatat dua kali).
    try {
      await this.repository.recordPurchaseOrderPurchase({
        purchaseOrderId: purchaseOrder.id,
        processedById: purchaseOrder.processedById ?? actorId,
        issuedAt: purchaseOrder.issuedAt ?? new Date(),
      });
    } catch (error) {
      logger.warn("[RESTOCK_RECEIVE] Tanggal beli gagal dicatat", {
        purchaseOrderId: purchaseOrder.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** PO dibuat otomatis bila pengajuan belum pernah menghasilkan PO. */
  private async ensurePurchaseOrderId(
    existingPurchaseOrderId: string | null,
    purchaseRequestId: string,
    actorId: string,
  ): Promise<string> {
    if (existingPurchaseOrderId) return existingPurchaseOrderId;

    let generatedId: string | null = null;
    let cause: unknown;
    try {
      const purchaseOrders = await this.procurementService.generatePOFromPRs(
        [purchaseRequestId],
        actorId,
      );
      generatedId = purchaseOrders?.[0]?.id ?? null;
    } catch (error) {
      cause = error;
    }

    if (!generatedId) {
      throw new RestockReceiptFailedError(
        PURCHASE_ORDER_NOT_GENERATED_MESSAGE,
        { cause },
      );
    }
    return generatedId;
  }

  private async applySubstitutions(params: {
    input: ReceiveRestockRequestInput;
    purchaseOrderId: string;
    purchaseOrderItems: RestockPurchaseOrderItem[];
    referenceNumber: string;
  }): Promise<RestockSubstitutionMap> {
    try {
      return await this.substitutionService.apply({
        purchaseOrderId: params.purchaseOrderId,
        purchaseOrderItems: params.purchaseOrderItems,
        substitutions: params.input.substitutions ?? {},
        tenantId: params.input.tenantId,
        actorId: params.input.actorId,
        referenceNumber: params.referenceNumber,
      });
    } catch (error) {
      if (error instanceof RestockSubstitutionInvalidError) {
        throw new RestockReceiptInvalidError(error.message);
      }
      throw error;
    }
  }

  /**
   * Kelebihan kiriman dinaikkan ke PO sebelum GRN dibuat, karena GRN menolak
   * jumlah yang melebihi sisa pesanan.
   */
  private async applyOverReceipts(params: {
    purchaseOrderId: string;
    purchaseOrderStatus: string | undefined;
    receivableItems: ReceivableItem[];
    input: ReceiveRestockRequestInput;
  }): Promise<{
    overReceipts: ResolvedOverReceipt[];
    undo: PurchaseOrderIncreaseUndo | null;
  }> {
    let overReceipts: ResolvedOverReceipt[];
    try {
      overReceipts = resolveOverReceipts(
        params.receivableItems,
        params.input.overReceipts ?? {},
      );
    } catch (error) {
      if (error instanceof RestockOverReceiptInvalidError) {
        throw new RestockReceiptInvalidError(error.message);
      }
      throw error;
    }
    if (overReceipts.length === 0) return { overReceipts, undo: null };

    if (!params.input.canIncreasePurchaseOrder) {
      const barangNames = overReceipts
        .map((item) => item.barangName)
        .join(", ");
      throw new RestockReceiptForbiddenError(
        `${barangNames} datang lebih banyak dari pesanan. Menerima kelebihannya berarti menambah jumlah pesanan ke toko, dan akun Anda tidak punya izin untuk itu. ` +
          "Catat sesuai sisa pesanan saja, atau minta atasan yang boleh mengubah pesanan untuk mencatat barang ini.",
      );
    }
    if (
      PURCHASE_ORDER_STATUSES_CLOSED_FOR_INCREASE.includes(
        params.purchaseOrderStatus ?? "",
      )
    ) {
      throw new RestockReceiptInvalidError(
        `Pesanan ini ${describeRestockStatus(params.purchaseOrderStatus)}, jadi jumlahnya tidak bisa ditambah. ` +
          "Catat barang sesuai sisa pesanan saja. Untuk kelebihannya, buat pengajuan baru.",
      );
    }

    const undo = await this.repository.increaseItemQuantities({
      purchaseOrderId: params.purchaseOrderId,
      increases: overReceipts.map((item) => ({
        purchaseOrderItemId: item.purchaseOrderItemId,
        extraQuantity: item.extraQuantity,
      })),
    });
    return { overReceipts, undo };
  }

  /**
   * Padankan jumlah diterima dengan item PO. Untuk item yang barangnya diganti,
   * jumlah tetap dibaca dari barang asli yang dikirim UI.
   */
  private buildReceivableItems(
    purchaseOrderItems: RestockPurchaseOrderItem[],
    receivedItems: Record<string, number>,
    appliedSubstitutions: RestockSubstitutionMap,
  ): ReceivableItem[] {
    const replacementByOriginal = new Map(Object.entries(appliedSubstitutions));

    return purchaseOrderItems.map((purchaseOrderItem) => {
      const originalBarangId = purchaseOrderItem.barangId;
      const barangId =
        replacementByOriginal.get(originalBarangId) ?? originalBarangId;
      const quantity = readReceivedQuantity(
        purchaseOrderItem,
        receivedItems,
        barangId,
      );

      const barangName = purchaseOrderItem.barang?.nama ?? barangId;
      const receivedQuantity = Number(quantity) || 0;
      if (!Number.isInteger(receivedQuantity) || receivedQuantity < 0) {
        throw new RestockReceiptInvalidError(
          `Jumlah ${barangName} yang datang harus angka bulat, 0 atau lebih.`,
        );
      }

      return {
        purchaseOrderItemId: purchaseOrderItem.id,
        originalBarangId,
        barangId,
        barangName,
        quantity: receivedQuantity,
        remaining:
          purchaseOrderItem.quantity -
          (purchaseOrderItem.receivedQuantity || 0) -
          (purchaseOrderItem.cancelledQuantity || 0),
      };
    });
  }

  private selectReceivedItems(receivableItems: ReceivableItem[]) {
    return receivableItems
      .filter((item) => item.quantity > 0)
      .map((item) => ({
        purchaseOrderItemId: item.purchaseOrderItemId,
        barangId: item.barangId,
        quantity: item.quantity,
      }));
  }

  private async createGoodsReceipt(params: {
    purchaseOrderId: string;
    gudangId: string;
    nomorRequest: string;
    items: Array<{
      purchaseOrderItemId: string;
      barangId: string;
      quantity: number;
    }>;
    overReceipts: ResolvedOverReceipt[];
    undo: PurchaseOrderIncreaseUndo | null;
    input: ReceiveRestockRequestInput;
    receivedAt: Date | undefined;
    isLimitedToPurchased: boolean;
  }) {
    const notes = [
      `Penerimaan dari Pre Request ${params.nomorRequest}`,
      ...(params.overReceipts.length > 0
        ? [describeOverReceipts(params.overReceipts)]
        : []),
    ].join(". ");
    try {
      return await getGoodsReceiptService().create({
        purchaseOrderId: params.purchaseOrderId,
        gudangId: params.gudangId,
        receivedById: params.input.actorId,
        tenantId: params.input.tenantId,
        fotoBukti: params.input.fotoBukti,
        notes,
        items: params.items,
        isLimitedToPurchased: params.isLimitedToPurchased,
        ...(params.receivedAt ? { receivedAt: params.receivedAt } : {}),
      });
    } catch (error) {
      // Kenaikan jumlah PO hanya sah bila GRN-nya ada; tanpa ini PO dan
      // tagihan supplier tetap membengkak setelah penerimaan ditolak.
      if (params.undo) {
        await this.repository.undoItemQuantityIncrease(params.undo);
      }
      // Pesan modul pembelian ditulis untuk programmer; penyebab aslinya
      // tetap ikut sebagai `cause` untuk log.
      if (error instanceof PurchaseOrderNotFoundError) {
        throw new RestockReceiptNotFoundError(
          RESTOCK_MESSAGES.purchaseOrderNotFound,
          { cause: error },
        );
      }
      if (error instanceof GoodsReceiptExceedsPurchasedError) {
        throw new RestockReceiptInvalidError(
          RESTOCK_RECEIPT_ELIGIBILITY_MESSAGES.purchaseChanged,
          { cause: error },
        );
      }
      if (error instanceof GoodsReceiptInvalidError) {
        throw new RestockReceiptInvalidError(RECEIPT_MISMATCH_MESSAGE, {
          cause: error,
        });
      }
      // Substitusi barang sudah tertulis sebelum langkah ini, jadi jangan
      // menjanjikan bahwa tidak ada yang berubah.
      throw new RestockReceiptFailedError(
        restockServerErrorMessage("Menerima barang", false),
        { cause: error },
      );
    }
  }

  /**
   * Status sesudah kiriman dicatat, dibaca ulang dari database: pesanan
   * selesai bila tidak ada sisa di seluruh pesanan; pengajuan selesai sendiri
   * bila barang miliknya tuntas walau pesanan gabungan masih menunggu barang
   * pengajuan lain. Kiriman yang masuk tidak pernah membatalkan pesanan.
   */
  private async syncReceivedStatus(
    context: ReceiptContext,
  ): Promise<Omit<RestockReceiptResult, "goodsReceipt">> {
    const { input, purchaseRequest, purchaseOrder, ownedBarangIds } = context;
    const purchaseOrderStatus = await this.repository.findPurchaseOrderStatus(
      purchaseOrder.id,
    );
    const hasOutstandingOnOrder = await this.repository.hasOutstandingItems(
      purchaseOrder.id,
    );
    const hasOutstandingOnRequest =
      hasOutstandingOnOrder && ownedBarangIds
        ? await this.repository.hasOutstandingItems(purchaseOrder.id, [
            ...ownedBarangIds,
          ])
        : hasOutstandingOnOrder;
    const settlement: RestockReceiptSettlement = decideRestockReceiptSettlement(
      {
        purchaseOrderStatus,
        hasOutstandingOnOrder,
        hasOutstandingOnRequest,
        canCancelOrder: false,
      },
    );
    await this.repository.applyReceiptSettlement({
      purchaseOrderId: purchaseOrder.id,
      purchaseRequestId: purchaseRequest.id,
      settlement,
      actorId: input.actorId,
    });
    return describeSettlementStatuses(settlement, {
      purchaseOrderStatus,
      purchaseRequestStatus: purchaseRequest.status,
    });
  }
}
