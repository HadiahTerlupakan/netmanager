import {
  getGoodsReceiptService,
  GoodsReceiptInvalidError,
  ProcurementService,
  PurchaseOrderNotFoundError,
} from "@/modules/procurement";

import type {
  IRestockGoodsReceiptRepository,
  PurchaseOrderIncreaseUndo,
  RestockPurchaseOrderItem,
} from "../domain/ports/IRestockGoodsReceiptRepository";
import type { ApplyRestockCancellationInput } from "./RestockItemCancellationService";
import {
  RestockCancellationInvalidError,
  RestockItemCancellationService,
  withClosingCancellations,
  type RestockCancellationMap,
} from "./RestockItemCancellationService";
import {
  RestockItemSubstitutionService,
  RestockSubstitutionInvalidError,
  type RestockSubstitutionMap,
} from "./RestockItemSubstitutionService";
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
  type RestockOverReceiptMap,
} from "./restock-over-receipt";

export interface ReceiveRestockRequestInput {
  purchaseRequestId: string;
  /** Jumlah diterima per barang, dikunci oleh barangId yang tampil di pengajuan. */
  receivedItems: Record<string, number>;
  /** Barang pengganti bila yang datang berbeda dari yang dipesan. */
  substitutions?: RestockSubstitutionMap;
  /** Alasan per barang yang tidak jadi dibelikan — sisa pesanannya dianulir. */
  cancellations?: RestockCancellationMap;
  /** Alasan per barang yang datang melebihi sisa pesanan — jumlah PO dinaikkan. */
  overReceipts?: RestockOverReceiptMap;
  /** Menaikkan jumlah PO setara mengedit PO, jadi butuh izin purchase_orders:update. */
  canIncreasePurchaseOrder: boolean;
  fotoBukti: string[];
  closePO: boolean;
  actorId: string;
  tenantId: string;
}

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

export class RestockReceiptNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestockReceiptNotFoundError";
  }
}

export class RestockReceiptInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestockReceiptInvalidError";
  }
}

export class RestockReceiptForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestockReceiptForbiddenError";
  }
}

/** PO yang sudah ditutup atau dibatalkan tidak boleh dinaikkan jumlahnya. */
const PURCHASE_ORDER_STATUSES_CLOSED_FOR_INCREASE = ["CANCELLED", "RECEIVED"];

export class RestockReceiptFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestockReceiptFailedError";
  }
}

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

  /** Terima barang dari pengajuan restock dan catat GRN-nya. */
  async receive(input: ReceiveRestockRequestInput) {
    const purchaseRequest = await this.repository.findPurchaseRequestForReceipt(
      input.purchaseRequestId,
      input.tenantId,
    );
    if (!purchaseRequest) {
      throw new RestockReceiptNotFoundError("Purchase Request not found");
    }

    const purchaseOrderId = await this.ensurePurchaseOrderId(
      purchaseRequest.purchaseOrderId,
      input.purchaseRequestId,
      input.actorId,
    );

    if (input.fotoBukti.length === 0) {
      throw new RestockReceiptInvalidError(
        "Foto bukti penerimaan barang wajib diunggah",
      );
    }

    const purchaseOrder =
      await this.repository.findPurchaseOrderWithItems(purchaseOrderId);
    if (!purchaseOrder) {
      throw new RestockReceiptNotFoundError("Purchase Order not found");
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
      throw new RestockReceiptInvalidError(
        "Minimal satu barang harus diterima. Batalkan Purchase Order bila tidak ada barang yang datang sama sekali.",
      );
    }

    const cancellationRequest = this.buildCancellationRequest({
      input,
      purchaseOrderId,
      purchaseOrderItems: purchaseOrder.items,
      grnItems,
      referenceNumber: purchaseRequest.nomorRequest,
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

    await this.runCancellationStep(() =>
      this.cancellationService.apply(cancellationRequest),
    );

    await this.syncReceivedStatus(
      purchaseOrderId,
      input.purchaseRequestId,
      input,
    );

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
    return goodsReceipt;
  }

  /** PO dibuat otomatis bila pengajuan belum pernah menghasilkan PO. */
  private async ensurePurchaseOrderId(
    existingPurchaseOrderId: string | null,
    purchaseRequestId: string,
    actorId: string,
  ): Promise<string> {
    if (existingPurchaseOrderId) return existingPurchaseOrderId;

    let generatedId: string | null = null;
    try {
      const purchaseOrders = await this.procurementService.generatePOFromPRs(
        [purchaseRequestId],
        actorId,
      );
      generatedId = purchaseOrders?.[0]?.id ?? null;
    } catch {
      generatedId = null;
    }

    if (!generatedId) {
      throw new RestockReceiptFailedError(
        "Gagal membuat Purchase Order. Coba lagi atau hubungi admin.",
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
      throw new RestockReceiptForbiddenError(
        "Kiriman melebihi pesanan menaikkan jumlah PO dan butuh izin purchase_orders:update. Minta atasan yang berwenang memverifikasi penerimaan ini.",
      );
    }
    if (
      PURCHASE_ORDER_STATUSES_CLOSED_FOR_INCREASE.includes(
        params.purchaseOrderStatus ?? "",
      )
    ) {
      throw new RestockReceiptInvalidError(
        "Purchase Order sudah ditutup atau dibatalkan, jumlahnya tidak bisa dinaikkan",
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
   * Anulir diterapkan setelah GRN karena pembuatan GRN mensyaratkan masih
   * adanya sisa pesanan pada Purchase Order, tapi diperiksa sebelumnya.
   */
  private buildCancellationRequest(params: {
    input: ReceiveRestockRequestInput;
    purchaseOrderId: string;
    purchaseOrderItems: RestockPurchaseOrderItem[];
    grnItems: Array<{ purchaseOrderItemId: string; quantity: number }>;
    referenceNumber: string;
  }): ApplyRestockCancellationInput {
    const receivedQuantityByItemId = params.grnItems.reduce<
      Record<string, number>
    >((acc, item) => {
      acc[item.purchaseOrderItemId] =
        (acc[item.purchaseOrderItemId] ?? 0) + item.quantity;
      return acc;
    }, {});

    const requestedCancellations = params.input.cancellations ?? {};
    return {
      purchaseOrderId: params.purchaseOrderId,
      purchaseOrderItems: params.purchaseOrderItems,
      cancellations: params.input.closePO
        ? withClosingCancellations(
            requestedCancellations,
            params.purchaseOrderItems,
            receivedQuantityByItemId,
          )
        : requestedCancellations,
      receivedQuantityByItemId,
      tenantId: params.input.tenantId,
      actorId: params.input.actorId,
      referenceNumber: params.referenceNumber,
    };
  }

  private async runCancellationStep(step: () => unknown): Promise<void> {
    try {
      await step();
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
          `Jumlah ${barangName} diterima harus bilangan bulat 0 atau lebih`,
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
      if (error instanceof PurchaseOrderNotFoundError) {
        throw new RestockReceiptNotFoundError(error.message);
      }
      if (error instanceof GoodsReceiptInvalidError) {
        throw new RestockReceiptInvalidError(error.message);
      }
      throw new RestockReceiptFailedError(
        error instanceof Error ? error.message : "Gagal memproses penerimaan",
      );
    }
  }

  /**
   * Pesanan dianggap tuntas bila ditutup manual, sudah RECEIVED, atau tidak
   * ada lagi sisa item yang belum diterima maupun dianulir.
   */
  private async syncReceivedStatus(
    purchaseOrderId: string,
    purchaseRequestId: string,
    input: ReceiveRestockRequestInput,
  ): Promise<void> {
    const purchaseOrderStatus =
      await this.repository.findPurchaseOrderStatus(purchaseOrderId);
    const hasOutstanding =
      await this.repository.hasOutstandingItems(purchaseOrderId);
    const isSettled = input.closePO || !hasOutstanding;

    if (isSettled && purchaseOrderStatus !== "RECEIVED") {
      await this.repository.markPurchaseOrderReceived(
        purchaseOrderId,
        input.actorId,
      );
    }

    if (purchaseOrderStatus === "RECEIVED" || isSettled) {
      await this.repository.markPurchaseRequestReceived(purchaseRequestId);
    }
  }
}
