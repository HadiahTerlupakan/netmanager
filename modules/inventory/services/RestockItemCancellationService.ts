import { logger } from "@/lib/logger";

import type {
  IRestockGoodsReceiptRepository,
  RestockPurchaseOrderItem,
} from "../domain/ports/IRestockGoodsReceiptRepository";

/** Map barangId → alasan barang tidak jadi dibeli/dikirim. */
export type RestockCancellationMap = Record<string, string>;

export const MAX_CANCEL_REASON_LENGTH = 255;

/** Alasan anulir otomatis untuk sisa pesanan saat operator menutup pesanan. */
export const CLOSE_ORDER_CANCEL_REASON = "Pesanan ditutup";

export interface ApplyRestockCancellationInput {
  purchaseOrderId: string;
  purchaseOrderItems: RestockPurchaseOrderItem[];
  cancellations: RestockCancellationMap;
  /** Jumlah yang diterima pada submit ini, dikunci oleh id item PO. */
  receivedQuantityByItemId: Record<string, number>;
  tenantId: string;
  actorId: string;
  referenceNumber: string;
}

interface ResolvedCancellation {
  purchaseOrderItemId: string;
  barangId: string;
  cancelledQuantity: number;
  reason: string;
}

/**
 * Menutup pesanan berarti sisa barang tidak akan datang, jadi sisa itu dianulir
 * (bukan dicatat diterima, yang akan menambah stok yang tidak pernah ada).
 * Alasan yang diisi operator tetap dipakai; sisanya memakai alasan baku.
 */
export function withClosingCancellations(
  cancellations: RestockCancellationMap,
  purchaseOrderItems: RestockPurchaseOrderItem[],
  receivedQuantityByItemId: Record<string, number>,
): RestockCancellationMap {
  const result = { ...cancellations };
  for (const item of purchaseOrderItems) {
    const remaining =
      item.quantity -
      item.receivedQuantity -
      item.cancelledQuantity -
      (receivedQuantityByItemId[item.id] ?? 0);
    if (remaining <= 0) continue;
    if ((result[item.barangId] ?? "").trim().length > 0) continue;
    result[item.barangId] = CLOSE_ORDER_CANCEL_REASON;
  }
  return result;
}

export class RestockCancellationInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestockCancellationInvalidError";
  }
}

/**
 * Anulir sisa pesanan saat verifikasi kedatangan: barang yang tidak jadi
 * dibelikan ditutup beserta alasannya (short close), sehingga pesanan tidak
 * menggantung tanpa kehilangan jejak berapa yang semula dipesan.
 *
 * Aturan:
 * - Barang harus ada di Purchase Order terkait
 * - Hanya sisa yang belum diterima & belum dianulir yang bisa dianulir
 * - Alasan wajib diisi (dicatat di item PO dan activity log)
 */
export class RestockItemCancellationService {
  constructor(private readonly repository: IRestockGoodsReceiptRepository) {}

  /**
   * Terapkan anulir sisa pesanan.
   * Mengembalikan daftar anulir yang benar-benar tercatat.
   */
  async apply(
    input: ApplyRestockCancellationInput,
  ): Promise<ResolvedCancellation[]> {
    const requested = this.parseRequestedCancellations(input.cancellations);
    if (requested.length === 0) return [];

    const resolved = this.resolveAgainstPurchaseOrder(
      requested,
      input.purchaseOrderItems,
      input.receivedQuantityByItemId,
    );
    if (resolved.length === 0) return [];

    await this.repository.applyItemCancellations({
      purchaseOrderId: input.purchaseOrderId,
      cancelledAt: new Date(),
      cancellations: resolved.map((cancellation) => ({
        purchaseOrderItemId: cancellation.purchaseOrderItemId,
        cancelledQuantity: cancellation.cancelledQuantity,
        reason: cancellation.reason,
      })),
    });

    await this.logCancellation(resolved, input);

    return resolved;
  }

  private parseRequestedCancellations(
    cancellations: RestockCancellationMap,
  ): Array<{ barangId: string; reason: string }> {
    return Object.entries(cancellations ?? {})
      .map(([barangId, reason]) => ({
        barangId,
        reason: typeof reason === "string" ? reason.trim() : "",
      }))
      .filter((cancellation) => cancellation.reason.length > 0);
  }

  private resolveAgainstPurchaseOrder(
    requested: Array<{ barangId: string; reason: string }>,
    purchaseOrderItems: RestockPurchaseOrderItem[],
    receivedQuantityByItemId: Record<string, number>,
  ): ResolvedCancellation[] {
    const resolved: ResolvedCancellation[] = [];

    for (const cancellation of requested) {
      if (cancellation.reason.length > MAX_CANCEL_REASON_LENGTH) {
        throw new RestockCancellationInvalidError(
          `Alasan anulir maksimal ${MAX_CANCEL_REASON_LENGTH} karakter`,
        );
      }

      const purchaseOrderItem = purchaseOrderItems.find(
        (item) => item.barangId === cancellation.barangId,
      );
      if (!purchaseOrderItem) {
        throw new RestockCancellationInvalidError(
          "Barang yang ingin dianulir tidak ada di Purchase Order",
        );
      }

      const remaining = this.getRemainingQuantity(
        purchaseOrderItem,
        receivedQuantityByItemId[purchaseOrderItem.id] ?? 0,
      );
      if (remaining <= 0) {
        throw new RestockCancellationInvalidError(
          `${purchaseOrderItem.barang?.nama ?? "Barang"} tidak punya sisa pesanan untuk dianulir`,
        );
      }

      resolved.push({
        purchaseOrderItemId: purchaseOrderItem.id,
        barangId: purchaseOrderItem.barangId,
        cancelledQuantity: remaining,
        reason: cancellation.reason,
      });
    }

    return resolved;
  }

  /** Sisa = pesanan − yang sudah diterima − yang baru diterima − yang sudah dianulir. */
  private getRemainingQuantity(
    purchaseOrderItem: RestockPurchaseOrderItem,
    receivedNow: number,
  ): number {
    return (
      purchaseOrderItem.quantity -
      purchaseOrderItem.receivedQuantity -
      purchaseOrderItem.cancelledQuantity -
      receivedNow
    );
  }

  private async logCancellation(
    resolved: ResolvedCancellation[],
    input: ApplyRestockCancellationInput,
  ): Promise<void> {
    await logger.logActivity({
      userId: input.actorId,
      tenantId: input.tenantId,
      action: "CANCEL RestockItem",
      subject: input.referenceNumber,
      details: {
        purchaseOrderId: input.purchaseOrderId,
        cancellations: resolved,
      },
    });
  }
}
