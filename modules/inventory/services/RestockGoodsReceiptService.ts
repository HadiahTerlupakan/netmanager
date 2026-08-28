import {
  getGoodsReceiptService,
  GoodsReceiptInvalidError,
  ProcurementService,
  PurchaseOrderNotFoundError,
} from "@/modules/procurement";

import type {
  IRestockGoodsReceiptRepository,
  RestockPurchaseOrderItem,
} from "../domain/ports/IRestockGoodsReceiptRepository";
import {
  RestockCancellationInvalidError,
  RestockItemCancellationService,
  type RestockCancellationMap,
} from "./RestockItemCancellationService";
import {
  RestockItemSubstitutionService,
  RestockSubstitutionInvalidError,
  type RestockSubstitutionMap,
} from "./RestockItemSubstitutionService";

export interface ReceiveRestockRequestInput {
  purchaseRequestId: string;
  /** Jumlah diterima per barang, dikunci oleh barangId yang tampil di pengajuan. */
  receivedItems: Record<string, number>;
  /** Barang pengganti bila yang datang berbeda dari yang dipesan. */
  substitutions?: RestockSubstitutionMap;
  /** Alasan per barang yang tidak jadi dibelikan — sisa pesanannya dianulir. */
  cancellations?: RestockCancellationMap;
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

    const cancelledBarangIds = this.collectCancelledBarangIds(
      input.cancellations,
    );
    const receivableItems = this.buildReceivableItems(
      purchaseOrder.items,
      input.receivedItems,
      appliedSubstitutions,
    );
    const grnItems = this.selectReceivedItems(
      receivableItems,
      input.closePO,
      cancelledBarangIds,
    );
    if (grnItems.length === 0) {
      throw new RestockReceiptInvalidError(
        "Minimal satu barang harus diterima. Batalkan Purchase Order bila tidak ada barang yang datang sama sekali.",
      );
    }

    const goodsReceipt = await this.createGoodsReceipt({
      purchaseOrderId,
      gudangId: purchaseRequest.gudangId,
      nomorRequest: purchaseRequest.nomorRequest,
      items: grnItems,
      input,
    });

    await this.applyCancellations({
      input,
      purchaseOrderId,
      purchaseOrderItems: purchaseOrder.items,
      grnItems,
      referenceNumber: purchaseRequest.nomorRequest,
    });

    await this.syncReceivedStatus(
      purchaseOrderId,
      input.purchaseRequestId,
      input,
    );

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

  /** Barang yang ditandai anulir — dikenali dari alasan yang terisi. */
  private collectCancelledBarangIds(
    cancellations: RestockCancellationMap | undefined,
  ): Set<string> {
    return new Set(
      Object.entries(cancellations ?? {})
        .filter(([, reason]) => (reason ?? "").trim().length > 0)
        .map(([barangId]) => barangId),
    );
  }

  /**
   * Anulir dijalankan setelah GRN karena pembuatan GRN mensyaratkan
   * masih adanya sisa pesanan pada Purchase Order.
   */
  private async applyCancellations(params: {
    input: ReceiveRestockRequestInput;
    purchaseOrderId: string;
    purchaseOrderItems: RestockPurchaseOrderItem[];
    grnItems: Array<{ purchaseOrderItemId: string; quantity: number }>;
    referenceNumber: string;
  }): Promise<void> {
    const receivedQuantityByItemId = params.grnItems.reduce<
      Record<string, number>
    >((acc, item) => {
      acc[item.purchaseOrderItemId] =
        (acc[item.purchaseOrderItemId] ?? 0) + item.quantity;
      return acc;
    }, {});

    try {
      await this.cancellationService.apply({
        purchaseOrderId: params.purchaseOrderId,
        purchaseOrderItems: params.purchaseOrderItems,
        cancellations: params.input.cancellations ?? {},
        receivedQuantityByItemId,
        tenantId: params.input.tenantId,
        actorId: params.input.actorId,
        referenceNumber: params.referenceNumber,
      });
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

      return {
        purchaseOrderItemId: purchaseOrderItem.id,
        originalBarangId,
        barangId,
        quantity: Number(quantity) || 0,
        remaining:
          purchaseOrderItem.quantity -
          (purchaseOrderItem.receivedQuantity || 0) -
          (purchaseOrderItem.cancelledQuantity || 0),
      };
    });
  }

  /**
   * Saat pesanan ditutup, kekurangan jumlah dianggap tidak akan dikirim lagi
   * sehingga sisa PO digenapkan supaya tidak menggantung.
   */
  private selectReceivedItems(
    receivableItems: ReceivableItem[],
    closePO: boolean,
    cancelledBarangIds: Set<string>,
  ) {
    return receivableItems
      .filter((item) => item.quantity > 0)
      .map((item) => ({
        purchaseOrderItemId: item.purchaseOrderItemId,
        barangId: item.barangId,
        quantity: this.resolveReceivedQuantity(
          item,
          closePO,
          cancelledBarangIds,
        ),
      }));
  }

  /**
   * Sisa yang tidak dianulir digenapkan saat pesanan ditutup supaya PO tidak
   * menggantung; sisa yang dianulir tidak boleh ikut menambah stok.
   */
  private resolveReceivedQuantity(
    item: ReceivableItem,
    closePO: boolean,
    cancelledBarangIds: Set<string>,
  ): number {
    const isCancelled =
      cancelledBarangIds.has(item.originalBarangId) ||
      cancelledBarangIds.has(item.barangId);
    const shouldTopUp =
      closePO &&
      !isCancelled &&
      item.remaining > 0 &&
      item.quantity < item.remaining;
    return shouldTopUp ? item.remaining : item.quantity;
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
    input: ReceiveRestockRequestInput;
  }) {
    try {
      return await getGoodsReceiptService().create({
        purchaseOrderId: params.purchaseOrderId,
        gudangId: params.gudangId,
        receivedById: params.input.actorId,
        tenantId: params.input.tenantId,
        fotoBukti: params.input.fotoBukti,
        notes: `Penerimaan dari Pre Request ${params.nomorRequest}`,
        items: params.items,
      });
    } catch (error) {
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
