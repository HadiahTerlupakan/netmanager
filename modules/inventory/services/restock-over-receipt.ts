/** Map barangId (yang tampil di pengajuan) → alasan barang datang lebih banyak dari pesanan. */
export type RestockOverReceiptMap = Record<string, string>;

export const MAX_OVER_RECEIPT_REASON_LENGTH = 255;

export interface OverReceiptCandidate {
  purchaseOrderItemId: string;
  originalBarangId: string;
  barangName: string;
  quantity: number;
  /** Sisa pesanan yang belum diterima maupun dianulir. */
  remaining: number;
}

export interface ResolvedOverReceipt {
  purchaseOrderItemId: string;
  barangName: string;
  extraQuantity: number;
  reason: string;
}

export class RestockOverReceiptInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestockOverReceiptInvalidError";
  }
}

/**
 * Supplier kadang mengirim lebih dari yang dipesan. Kelebihan hanya diterima
 * bila operator memberi alasan; jumlah PO lalu dinaikkan supaya stok, GRN, dan
 * tagihan supplier tetap cocok dengan barang yang benar-benar datang.
 */
export function resolveOverReceipts(
  items: OverReceiptCandidate[],
  reasons: RestockOverReceiptMap,
): ResolvedOverReceipt[] {
  const resolved: ResolvedOverReceipt[] = [];

  for (const item of items) {
    const extraQuantity = item.quantity - Math.max(item.remaining, 0);
    if (extraQuantity <= 0) continue;

    const reason = (reasons[item.originalBarangId] ?? "").trim();
    if (reason.length === 0) {
      throw new RestockOverReceiptInvalidError(
        `Jumlah ${item.barangName} (${item.quantity}) melebihi sisa pesanan (${Math.max(item.remaining, 0)}). Isi alasan kelebihan kiriman agar jumlah PO dinaikkan.`,
      );
    }
    if (reason.length > MAX_OVER_RECEIPT_REASON_LENGTH) {
      throw new RestockOverReceiptInvalidError(
        `Alasan kelebihan kiriman maksimal ${MAX_OVER_RECEIPT_REASON_LENGTH} karakter`,
      );
    }

    resolved.push({
      purchaseOrderItemId: item.purchaseOrderItemId,
      barangName: item.barangName,
      extraQuantity,
      reason,
    });
  }

  return resolved;
}

/** Catatan GRN agar kelebihan kiriman terbaca di dokumen penerimaan. */
export function describeOverReceipts(
  overReceipts: ResolvedOverReceipt[],
): string {
  return `Kelebihan kiriman: ${overReceipts
    .map((item) => `${item.barangName} +${item.extraQuantity} (${item.reason})`)
    .join(", ")}`;
}
