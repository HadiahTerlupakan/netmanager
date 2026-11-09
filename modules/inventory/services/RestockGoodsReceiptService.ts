import {
  getGoodsReceiptService,
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
import type { ApplyRestockCancellationInput } from "./RestockItemCancellationService";
import {
  RestockCancellationInvalidError,
  RestockItemCancellationService,
  withClosingCancellations,
} from "./RestockItemCancellationService";
import {
  RestockItemSubstitutionService,
  RestockSubstitutionInvalidError,
  type RestockSubstitutionMap,
} from "./RestockItemSubstitutionService";
import {
  applyCancellationsToItems,
  canCancelUnfulfilledOrder,
  decideRestockReceiptSettlement,
  describeSettlementStatuses,
  findForeignReceiptLine,
  hasOutstandingForBarang,
  resolveOwnedBarangIds,
  toGuardedCancellations,
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
  RECEIPT_CONCURRENT_CHANGE_MESSAGE,
  RECEIPT_MISMATCH_MESSAGE,
  RestockReceiptNotFoundError,
  RestockReceiptInvalidError,
  RestockReceiptForbiddenError,
  RestockReceiptFailedError,
  describeForeignReceiptLine,
  isFinishingWithoutDelivery,
  isNothingReceived,
  type ReceiveRestockRequestInput,
  type RestockReceiptResult,
} from "./restock-goods-receipt.contracts";

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

interface ReceiptContext {
  input: ReceiveRestockRequestInput;
  purchaseRequest: RestockPurchaseRequestForReceipt;
  purchaseOrder: RestockPurchaseOrderForReceipt;
  linkedRequestCount: number;
  /**
   * Barang milik pengajuan ini. null = seluruh pesanan milik pengajuan ini
   * (atau data barangnya tidak tersedia).
   */
  ownedBarangIds: ReadonlySet<string> | null;
}

/** PO yang sudah ditutup atau dibatalkan tidak boleh dinaikkan jumlahnya. */
const PURCHASE_ORDER_STATUSES_CLOSED_FOR_INCREASE = ["CANCELLED", "RECEIVED"];

/**
 * Orkestrasi verifikasi kedatangan barang restock: pastikan PO ada, terapkan
 * substitusi barang bila yang datang berbeda, lalu buat GRN agar stok, dokumen,
 * dan jurnal AUTO_GRN_CREATED ikut tercatat.
 */
export class RestockGoodsReceiptService {
  constructor(
    private readonly repository: IRestockGoodsReceiptRepository,
    private readonly substitutionService: RestockItemSubstitutionService,
    private readonly cancellationService: RestockItemCancellationService,
    private readonly procurementService: ProcurementService,
  ) {}

  /**
   * Catat barang yang datang dari pengajuan restock. Bila tidak ada barang
   * yang datang tetapi sisanya dinyatakan tidak akan datang, pesanan
   * diselesaikan tanpa kiriman (tanpa GRN dan tanpa foto).
   */
  async receive(
    input: ReceiveRestockRequestInput,
  ): Promise<RestockReceiptResult> {
    const context = await this.loadReceiptContext(input);
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
    if (isFinishingWithoutDelivery(input)) {
      return this.finishWithoutDelivery(context);
    }
    if (isNothingReceived(input)) {
      throw new RestockReceiptInvalidError(NOTHING_RECEIVED_MESSAGE);
    }
    return this.receiveDelivery(context);
  }

  private async loadReceiptContext(
    input: ReceiveRestockRequestInput,
  ): Promise<ReceiptContext> {
    const purchaseRequest = await this.repository.findPurchaseRequestForReceipt(
      input.purchaseRequestId,
      input.tenantId,
    );
    if (!purchaseRequest) {
      throw new RestockReceiptNotFoundError(RESTOCK_MESSAGES.requestNotFound);
    }

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
    return {
      input,
      purchaseRequest,
      purchaseOrder,
      linkedRequestCount,
      ownedBarangIds: resolveOwnedBarangIds(
        purchaseRequest,
        linkedRequestCount,
      ),
    };
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

    const cancellationRequest = this.buildCancellationRequest({
      context,
      grnItems,
    });
    await this.runCancellationStep(() =>
      this.cancellationService.validate(cancellationRequest),
    );

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
    });

    await this.recordPurchaseOnFirstReceipt(purchaseOrder, input.actorId);

    await this.runCancellationStep(() =>
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
   * Tidak ada barang yang datang, tetapi sisanya dinyatakan tidak akan datang.
   * Tidak ada GRN, foto, maupun kenaikan pesanan. Pencoretan dan perubahan
   * status ditulis dalam satu transaksi yang bersyarat pada data yang dibaca,
   * sehingga kiriman yang dicatat bersamaan tidak tertimpa.
   */
  private async finishWithoutDelivery(
    context: ReceiptContext,
  ): Promise<RestockReceiptResult> {
    const { input, purchaseRequest, purchaseOrder } = context;
    const cancellationRequest = this.buildCancellationRequest({
      context,
      grnItems: [],
    });
    const cancellations = await this.runCancellationStep(() =>
      this.cancellationService.resolve(cancellationRequest),
    );

    const itemsAfter = applyCancellationsToItems(
      purchaseOrder.items,
      cancellations,
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
      cancellations: toGuardedCancellations(purchaseOrder.items, cancellations),
    });
    if (!isWritten) {
      throw new RestockReceiptInvalidError(RECEIPT_CONCURRENT_CHANGE_MESSAGE);
    }
    await this.cancellationService.recordActivity(
      cancellations,
      cancellationRequest,
    );

    const outcome = describeSettlementStatuses(settlement, {
      purchaseOrderStatus: purchaseOrder.status ?? null,
      purchaseRequestStatus: purchaseRequest.status,
    });

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
   * Barang yang sudah datang berarti sudah dibeli. Bila langkah "Tandai Sudah
   * Dibeli" terlewat, penerimaan pertama mencatat pembeli dan tanggalnya.
   * Status pesanan sendiri sudah diubah GRN menjadi PARTIAL/RECEIVED.
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
   * Pencoretan diterapkan setelah GRN karena pembuatan GRN mensyaratkan masih
   * adanya sisa pesanan pada Purchase Order, tapi diperiksa sebelumnya.
   * Menutup pesanan hanya mencoret barang milik pengajuan ini.
   */
  private buildCancellationRequest(params: {
    context: ReceiptContext;
    grnItems: Array<{ purchaseOrderItemId: string; quantity: number }>;
  }): ApplyRestockCancellationInput {
    const { input, purchaseOrder, purchaseRequest, ownedBarangIds } =
      params.context;
    const receivedQuantityByItemId = params.grnItems.reduce<
      Record<string, number>
    >((acc, item) => {
      acc[item.purchaseOrderItemId] =
        (acc[item.purchaseOrderItemId] ?? 0) + item.quantity;
      return acc;
    }, {});

    const requestedCancellations = input.cancellations ?? {};
    return {
      purchaseOrderId: purchaseOrder.id,
      purchaseOrderItems: purchaseOrder.items,
      cancellations: input.closePO
        ? withClosingCancellations(
            requestedCancellations,
            purchaseOrder.items,
            receivedQuantityByItemId,
            ownedBarangIds,
          )
        : requestedCancellations,
      receivedQuantityByItemId,
      tenantId: input.tenantId,
      actorId: input.actorId,
      referenceNumber: purchaseRequest.nomorRequest,
    };
  }

  private async runCancellationStep<T>(step: () => T | Promise<T>): Promise<T> {
    try {
      return await step();
    } catch (error) {
      if (error instanceof RestockCancellationInvalidError) {
        throw new RestockReceiptInvalidError(error.message);
      }
      throw error;
    }
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
      const quantity =
        receivedItems[originalBarangId] ??
        receivedItems[barangId] ??
        receivedItems[purchaseOrderItem.id] ??
        0;

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
