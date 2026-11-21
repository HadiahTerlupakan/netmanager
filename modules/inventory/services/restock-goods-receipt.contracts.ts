import type { GoodsReceiptEntity } from "@/modules/procurement";

import type { RestockSubstitutionMap } from "./RestockItemSubstitutionService";
import type { RestockOverReceiptMap } from "./restock-over-receipt";

/*
 * Kontrak publik Masukkan Barang restock: pesan untuk admin gudang, bentuk
 * input dan hasil, serta kode galatnya.
 */

export const ENTRY_LINES_MISMATCH_MESSAGE =
  "Daftar barang yang dikirim tidak cocok dengan pengajuan ini. Muat ulang halaman, lalu coba lagi.";
export const NOTHING_ENTERED_MESSAGE =
  "Isi jumlah barang yang masuk. Bila tidak ada barang yang datang, batalkan pengajuan.";
export const ENTRY_PHOTO_MISSING_MESSAGE =
  "Foto bukti barang yang masuk belum diunggah. Foto barangnya dulu, lalu simpan.";
export const PURCHASE_ORDER_NOT_GENERATED_MESSAGE =
  "Pesanan untuk pengajuan ini belum bisa dibuat, jadi barangnya belum bisa dimasukkan. Tidak ada barang yang masuk gudang. Hubungi admin.";
export const PURCHASE_ORDER_SUPPLIER_INACTIVE_MESSAGE =
  "Pesanan untuk pengajuan ini belum bisa dibuat karena toko untuk barang ini sedang tidak aktif. Tidak ada barang yang masuk gudang. Hubungi admin.";
export const RECEIPT_CONCURRENT_CHANGE_MESSAGE =
  "Pengajuan ini baru saja diubah orang lain, jadi barangnya belum dimasukkan. Muat ulang halaman, lalu cek lagi barangnya.";
/**
 * GRN sudah tersimpan tetapi pengajuan belum tertutup (datanya berubah atau
 * ada gangguan server). Mengirim ulang isian yang sama akan mencatat barang
 * dua kali, jadi admin diarahkan menyelesaikan tanpa barang tambahan.
 */
export const ENTRY_NOT_FINISHED_MESSAGE =
  'Barang sudah masuk gudang, tetapi pengajuan belum tertutup. Jangan masukkan barang yang sama lagi. Muat ulang halaman, buka Masukkan Barang, isi semua jumlah dengan 0, lalu pilih "Selesaikan tanpa barang tambahan".';
export const RECEIPT_MISMATCH_MESSAGE =
  "Data barang yang diterima tidak cocok dengan pesanan. Muat ulang halaman, lalu coba lagi. Kalau masih muncul, lapor ke admin.";

export interface ReceiveRestockRequestInput {
  purchaseRequestId: string;
  /**
   * Jumlah masuk per barang, dikunci barangId baris pengajuan: tepat semua
   * baris yang tidak ditolak dan masih punya sisa, boleh 0.
   */
  receivedItems: Record<string, number>;
  /** Barang pengganti untuk barang yang dimasukkan: barangId asal → pengganti. */
  substitutions: RestockSubstitutionMap;
  /** Alasan per barang yang masuk melebihi sisa pesanan; jumlah pesanan dinaikkan. */
  overReceipts: RestockOverReceiptMap;
  /** Menaikkan jumlah pesanan setara mengubah pesanan, jadi butuh izin purchase_orders:update. */
  canIncreasePurchaseOrder: boolean;
  fotoBukti: string[];
  actorId: string;
  tenantId: string;
}

/** Sisa satu barang yang tidak dimasukkan dan dicoret saat pengajuan selesai. */
export interface RestockNotEnteredLine {
  barangId: string;
  barangName: string;
  quantity: number;
}

/** Hasil Masukkan Barang: pengajuan selalu selesai. */
export interface RestockReceiptResult {
  /** Catatan barang masuk; null bila pengajuan lama diselesaikan tanpa barang tambahan. */
  goodsReceipt: GoodsReceiptEntity | null;
  purchaseRequestStatus: "RECEIVED";
  notEntered: RestockNotEnteredLine[];
}

/** `INVALID` → 400, `FORBIDDEN` → 403, `NOT_FOUND` → 404, `CONFLICT` → 409, `FAILED` → 500. */
export type RestockReceiptErrorCode =
  | "INVALID"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FAILED";

/** Penolakan atau kegagalan Masukkan Barang; `cause` hanya untuk log server. */
export interface RestockReceiptFailure {
  success: false;
  code: RestockReceiptErrorCode;
  error: string;
  cause?: unknown;
}

export type RestockReceiptOutcome =
  | { success: true; data: RestockReceiptResult }
  | RestockReceiptFailure;

/** Bentuk penolakan Masukkan Barang. */
export function receiptFailure(
  code: RestockReceiptErrorCode,
  error: string,
  cause?: unknown,
): RestockReceiptFailure {
  return cause === undefined
    ? { success: false, code, error }
    : { success: false, code, error, cause };
}
