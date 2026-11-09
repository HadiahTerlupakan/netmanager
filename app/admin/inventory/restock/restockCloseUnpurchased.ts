import {
  getPurchasedAwaitingArrival,
  getUnpurchasedRemainder,
} from "@/modules/inventory/client";

import { isLineRejected } from "./approvalUtils";
import { RESTOCK_ORDER_CANCELLED_MESSAGE } from "./restockReceiveForm";
import { hasRestockPurchaseActivity } from "./restockPurchase";
import type { PurchaseRequest } from "./types";

/**
 * Aturan layar "Tutup sisa yang tidak jadi dibeli": barang yang belum dibeli
 * dicoret supaya pengajuan tidak macet di tahap pembelian. Barang yang sudah
 * dibeli tetap ditunggu datang.
 */

export interface RestockUnpurchasedLine {
  barangId: string;
  nama: string;
  satuan: string;
  quantity: number;
}

/** Body PATCH /receive untuk menutup sisa yang tidak jadi dibeli. */
export interface RestockCloseUnpurchasedPayload {
  items: Record<string, number>;
  closeUnpurchased: true;
  closeReason: string;
}

export const CLOSE_UNPURCHASED_TITLE = "Tutup sisa yang tidak jadi dibeli";
export const CLOSE_UNPURCHASED_SAVED_MESSAGE =
  "Tersimpan. Sisa yang tidak jadi dibeli sudah ditutup.";
export const CLOSE_UNPURCHASED_REASON_MISSING =
  "Pilih alasan kenapa sisanya tidak jadi dibeli.";

/** Barang yang belum dibeli dan akan dicoret, per baris pengajuan. */
export function getRestockUnpurchasedLines(
  request: PurchaseRequest,
): RestockUnpurchasedLine[] {
  return request.items
    .filter((item) => !isLineRejected(item))
    .flatMap((item) => {
      const quantity = getUnpurchasedRemainder({
        quantity: item.orderedQuantity ?? item.jumlah,
        receivedQuantity: item.receivedQuantity || 0,
        cancelledQuantity: item.cancelledQuantity ?? 0,
        purchasedQuantity: item.purchasedQuantity ?? 0,
      });
      if (quantity <= 0) return [];
      return [
        {
          barangId: item.barangId,
          nama: item.barang?.nama ?? "Barang",
          satuan: item.barang?.satuan ?? "",
          quantity,
        },
      ];
    });
}

/** "Kabel Fiber: 4 roll belum dibeli". */
export function describeRestockUnpurchasedLine(
  line: RestockUnpurchasedLine,
): string {
  return `${line.nama}: ${line.quantity} ${line.satuan} belum dibeli`;
}

/**
 * Akibat "Tutup sisa yang tidak jadi dibeli" bagi pengajuan, sama dengan
 * keputusan server (`decideRestockReceiptSettlement`):
 * - CANCEL_REQUEST: belum ada yang terjadi pada pesanan; pengajuan dibatalkan.
 * - FINISH_REQUEST: tidak ada lagi barang yang ditunggu; pengajuan selesai.
 * - KEEP_WAITING: barang yang sudah dibeli masih ditunggu datang.
 */
export type CloseUnpurchasedOutcome =
  | "CANCEL_REQUEST"
  | "FINISH_REQUEST"
  | "KEEP_WAITING";

/** Status pesanan yang masih boleh dibatalkan tanpa kiriman (sama dengan server). */
const CANCELLABLE_ORDER_STATUSES = ["DRAFT", "ORDERED"];

/**
 * Pengajuan ini punya jasa. Tanpa pesanan, server membuat pesanan berisi jasa
 * yang tidak ditolak, jadi jasa dihitung dari baris pengajuan.
 */
function hasRestockJasa(request: PurchaseRequest): boolean {
  const order = request.purchaseOrder;
  if (order) return (order._count?.jasaItems ?? 0) > 0;
  return (request.jasaItems ?? []).some((item) => !isLineRejected(item));
}

/** Pesanan belum tersentuh sama sekali, jadi aman dibatalkan (cermin server). */
function isOrderUntouched(request: PurchaseRequest): boolean {
  if (hasRestockPurchaseActivity(request) || hasRestockJasa(request)) {
    return false;
  }
  if (request.items.some((item) => (item.receivedQuantity || 0) > 0)) {
    return false;
  }
  const order = request.purchaseOrder;
  if (!order) return true;
  if (!CANCELLABLE_ORDER_STATUSES.includes(order.status ?? "")) return false;
  if ((order.goodsReceipts?.length ?? 0) > 0) return false;
  if ((order.paymentStatus ?? "UNPAID") !== "UNPAID") return false;
  return (order._count?.purchaseRequests ?? 1) <= 1;
}

/** Masih ada barang yang sudah dibeli tetapi belum datang. */
function hasPurchasedAwaitingArrival(request: PurchaseRequest): boolean {
  return request.items
    .filter((item) => !isLineRejected(item))
    .some(
      (item) =>
        getPurchasedAwaitingArrival({
          quantity: item.orderedQuantity ?? item.jumlah,
          receivedQuantity: item.receivedQuantity || 0,
          cancelledQuantity: item.cancelledQuantity ?? 0,
          purchasedQuantity: item.purchasedQuantity ?? 0,
        }) > 0,
    );
}

/** Akibat penyimpanan bagi pengajuan, untuk catatan dan tombol modal. */
export function predictCloseUnpurchasedOutcome(
  request: PurchaseRequest,
): CloseUnpurchasedOutcome {
  if (isOrderUntouched(request)) return "CANCEL_REQUEST";
  return hasPurchasedAwaitingArrival(request)
    ? "KEEP_WAITING"
    : "FINISH_REQUEST";
}

const JASA_NOT_CLOSED_NOTE = " Jasa di pengajuan ini tidak ikut ditutup.";

/** Catatan di modal: akibat penyimpanan bagi pengajuan dan link belanjanya. */
export function getCloseUnpurchasedNote(
  outcome: CloseUnpurchasedOutcome,
  request: PurchaseRequest,
): string {
  if (outcome === "CANCEL_REQUEST") {
    return "Belum ada barang yang dibeli. Kalau disimpan, pengajuan ini dibatalkan.";
  }
  if (outcome === "KEEP_WAITING") {
    return "Barang yang sudah dibeli tetap ditunggu datang. Link belanja pengajuan ini akan dimatikan.";
  }
  const jasaNote = hasRestockJasa(request) ? JASA_NOT_CLOSED_NOTE : "";
  return `Tidak ada lagi barang yang ditunggu. Kalau disimpan, pengajuan ini ditandai selesai dan link belanjanya dimatikan.${jasaNote}`;
}

/** Label tombol simpan modal. */
export function getCloseUnpurchasedSubmitLabel(
  outcome: CloseUnpurchasedOutcome,
): string {
  if (outcome === "CANCEL_REQUEST") return "Batalkan pengajuan";
  if (outcome === "FINISH_REQUEST") return "Tutup dan tandai selesai";
  return CLOSE_UNPURCHASED_TITLE;
}

/** Susun body permintaan; alasan dirapikan. */
export function buildCloseUnpurchasedPayload(
  reason: string,
): RestockCloseUnpurchasedPayload {
  return { items: {}, closeUnpurchased: true, closeReason: reason.trim() };
}

/** Toast sukses menurut status pengajuan sesudah disimpan. */
export function getCloseUnpurchasedSuccessMessage(
  purchaseRequestStatus: string | null,
): string {
  return purchaseRequestStatus === "CANCELLED"
    ? RESTOCK_ORDER_CANCELLED_MESSAGE
    : CLOSE_UNPURCHASED_SAVED_MESSAGE;
}
