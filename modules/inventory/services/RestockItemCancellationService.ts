import { logger } from "@/lib/logger";

import type {
  IRestockGoodsReceiptRepository,
  RestockPurchaseOrderItem,
} from "../domain/ports/IRestockGoodsReceiptRepository";

/** Map barangId → alasan barang tidak jadi dibeli/dikirim. */
export type RestockCancellationMap = Record<string, string>;

export const MAX_CANCEL_REASON_LENGTH = 255;

/**
 * Alasan bawaan untuk sisa barang yang tidak jadi datang saat pesanan
 * diselesaikan tanpa alasan per barang.
 */
export const CLOSE_ORDER_CANCEL_REASON = "Toko tidak mengirim sisanya";

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

export interface ResolvedCancellation {
  purchaseOrderItemId: string;
  barangId: string;
  cancelledQuantity: number;
  reason: string;
}

/**
 * Menutup pesanan berarti sisa barang tidak akan datang, jadi sisa itu dicoret
 * (bukan dicatat diterima, yang akan menambah stok yang tidak pernah ada).
 * Alasan yang diisi operator tetap dipakai; sisanya memakai alasan baku.
 * `ownedBarangIds` membatasi pencoretan ke barang milik pengajuan yang
 * sedang dicatat, supaya barang pengajuan lain di pesanan gabungan (yang
 * tidak terlihat oleh petugas) tidak ikut dicoret.
 */
export function withClosingCancellations(
  cancellations: RestockCancellationMap,
  purchaseOrderItems: RestockPurchaseOrderItem[],
  receivedQuantityByItemId: Record<string, number>,
  ownedBarangIds: ReadonlySet<string> | null = null,
): RestockCancellationMap {
  const result = { ...cancellations };
  for (const item of purchaseOrderItems) {
    if (ownedBarangIds && !ownedBarangIds.has(item.barangId)) continue;
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
   * Periksa anulir tanpa menulis apa pun, supaya penolakan terjadi sebelum
   * GRN menambah stok; penolakan sesudahnya membuat operator mengulang dan
   * stok tercatat dua kali.
   */
  validate(input: ApplyRestockCancellationInput): void {
    this.resolve(input);
  }

  /** Hitung pencoretan yang akan dicatat tanpa menulis apa pun. */
  resolve(input: ApplyRestockCancellationInput): ResolvedCancellation[] {
    return this.resolveAgainstPurchaseOrder(
      this.parseRequestedCancellations(input.cancellations),
      input.purchaseOrderItems,
      input.receivedQuantityByItemId,
    );
  }

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

    await this.recordActivity(resolved, input);

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
          `Alasan barang tidak jadi datang terlalu panjang. Paling banyak ${MAX_CANCEL_REASON_LENGTH} huruf.`,
        );
      }

      const purchaseOrderItem = purchaseOrderItems.find(
        (item) => item.barangId === cancellation.barangId,
      );
      if (!purchaseOrderItem) {
        throw new RestockCancellationInvalidError(
          "Barang yang dicatat tidak jadi datang tidak ada di pesanan ini. Muat ulang halaman, lalu coba lagi.",
        );
      }

      const remaining = this.getRemainingQuantity(
        purchaseOrderItem,
        receivedQuantityByItemId[purchaseOrderItem.id] ?? 0,
      );
      if (remaining <= 0) {
        throw new RestockCancellationInvalidError(
          `${purchaseOrderItem.barang?.nama ?? "Barang ini"} sudah tidak punya sisa yang ditunggu, jadi tidak ada yang bisa dicatat tidak jadi datang. Hapus alasannya.`,
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

  /** Catat pencoretan yang sudah tertulis ke activity log. */
  async recordActivity(
    resolved: ResolvedCancellation[],
    input: ApplyRestockCancellationInput,
  ): Promise<void> {
    if (resolved.length === 0) return;
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
