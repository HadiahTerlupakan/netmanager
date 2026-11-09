import type { GoodsReceiptEntity } from "@/modules/procurement";

import type { RestockCancellationMap } from "./RestockItemCancellationService";
import type { RestockSubstitutionMap } from "./RestockItemSubstitutionService";
import type { RestockOverReceiptMap } from "./restock-over-receipt";

/*
 * Kontrak publik pencatatan barang datang restock: pesan untuk petugas,
 * bentuk input/hasil, galat bertipe, dan predikat atas input.
 */

export const RECEIPT_PHOTO_MISSING_MESSAGE =
  "Foto bukti barang datang belum diunggah. Foto barangnya dulu, lalu simpan.";
export const NOTHING_RECEIVED_MESSAGE =
  "Belum ada jumlah barang yang diisi. Kalau barangnya belum datang, simpan nanti saat barang tiba.";
export const PURCHASE_ORDER_NOT_GENERATED_MESSAGE =
  "Daftar belanja untuk pengajuan ini belum bisa dibuat, jadi barangnya belum bisa dicatat datang. Tidak ada barang yang masuk gudang. Hubungi admin.";
export const PURCHASE_ORDER_CANCELLED_MESSAGE =
  "Pesanan ini sudah dibatalkan, jadi barangnya tidak bisa dicatat datang. Kalau barangnya tetap datang, buat pengajuan baru.";
export const PURCHASE_ORDER_FINISHED_MESSAGE =
  "Pesanan ini sudah selesai, jadi barangnya tidak bisa dicatat datang lagi. Kalau ada barang yang datang lagi, buat pengajuan baru.";
export const RECEIPT_CONCURRENT_CHANGE_MESSAGE =
  "Pesanan ini baru saja diubah orang lain, jadi belum disimpan. Muat ulang halaman, lalu cek lagi barangnya.";
export const RECEIPT_MISMATCH_MESSAGE =
  "Data barang yang diterima tidak cocok dengan pesanan. Muat ulang halaman, lalu coba lagi. Kalau masih muncul, lapor ke admin.";

export interface ReceiveRestockRequestInput {
  purchaseRequestId: string;
  /** Jumlah diterima per barang, dikunci oleh barangId yang tampil di pengajuan. */
  receivedItems: Record<string, number>;
  /** Barang pengganti bila yang datang berbeda dari yang dipesan. */
  substitutions?: RestockSubstitutionMap;
  /** Alasan per barang yang sisanya tidak jadi datang. */
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

/**
 * Hasil pencatatan barang datang. `goodsReceipt` null bila pesanan
 * diselesaikan tanpa kiriman (tidak ada barang yang masuk gudang).
 */
export interface RestockReceiptResult {
  goodsReceipt: GoodsReceiptEntity | null;
  purchaseOrderStatus: string | null;
  purchaseRequestStatus: string;
}

export class RestockReceiptNotFoundError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RestockReceiptNotFoundError";
  }
}

export class RestockReceiptInvalidError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RestockReceiptInvalidError";
  }
}

export class RestockReceiptForbiddenError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RestockReceiptForbiddenError";
  }
}

export class RestockReceiptFailedError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RestockReceiptFailedError";
  }
}

/**
 * Semua jumlah datang 0 tetapi ada sisa yang dinyatakan tidak akan datang
 * (tutup pesanan atau alasan per barang).
 */
export function isFinishingWithoutDelivery(
  input: ReceiveRestockRequestInput,
): boolean {
  if (!isNothingReceived(input)) return false;
  const hasCancellation = Object.values(input.cancellations ?? {}).some(
    (reason) => typeof reason === "string" && reason.trim().length > 0,
  );
  return input.closePO || hasCancellation;
}

/** Semua jumlah datang yang dikirim bernilai 0 (atau tidak diisi). */
export function isNothingReceived(input: ReceiveRestockRequestInput): boolean {
  return Object.values(input.receivedItems).every(
    (quantity) => Number(quantity) === 0,
  );
}
