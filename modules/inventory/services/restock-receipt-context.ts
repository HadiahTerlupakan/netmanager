import type {
  IRestockRequestClosureRepository,
  RestockPurchaseOrderForReceipt,
  RestockPurchaseOrderItem,
  RestockPurchaseRequestForReceipt,
  RestockRequestLineForReceipt,
} from "../domain/ports/IRestockGoodsReceiptRepository";
import type {
  RestockStatusInput,
  RestockStatusLine,
} from "../domain/restock-request-status";
import { RESTOCK_MESSAGES } from "./restock-messages";
import { resolveOwnedBarangIds } from "./restock-receipt-settlement";

/*
 * Keadaan pengajuan yang dibaca untuk Masukkan Barang atau Batalkan. Dibaca
 * di bawah kunci pengajuan, jadi statusnya yang terbaru.
 */

/** Pengajuan tanpa pesanan dihitung sebagai pemilik tunggal pesanan yang akan dibuat. */
const SINGLE_REQUEST_COUNT = 1;

export interface RestockRequestSnapshot {
  request: RestockPurchaseRequestForReceipt;
  /** Pesanan pengajuan; null bila belum dibuat (pembuatan saat persetujuan gagal). */
  order: RestockPurchaseOrderForReceipt | null;
  linkedRequestCount: number;
  /**
   * Item pesanan yang diisi pengajuan ini di Masukkan Barang (pesanan
   * gabungan: hanya barang di barisnya), sebelum penyimpanan mengubah apa pun.
   */
  ownedItems: RestockPurchaseOrderItem[];
  /** Bahan aturan status bersama, sama dengan yang dipakai layar. */
  status: RestockStatusInput;
}

export type RestockRequestSnapshotLoad =
  | { success: true; data: RestockRequestSnapshot }
  | { success: false; code: "NOT_FOUND"; error: string };

/** Baca pengajuan milik tenant beserta pesanannya. */
export async function loadRestockRequestSnapshot(
  repository: IRestockRequestClosureRepository,
  purchaseRequestId: string,
  tenantId: string,
): Promise<RestockRequestSnapshotLoad> {
  const request = await repository.findPurchaseRequestForReceipt(
    purchaseRequestId,
    tenantId,
  );
  if (!request) return notFound(RESTOCK_MESSAGES.requestNotFound);
  if (!request.purchaseOrderId) {
    return toSnapshot(request, null, SINGLE_REQUEST_COUNT);
  }
  const order = await repository.findPurchaseOrderWithItems(
    request.purchaseOrderId,
  );
  if (!order) return notFound(RESTOCK_MESSAGES.purchaseOrderNotFound);
  const linkedRequestCount =
    await repository.countPurchaseRequestsForPurchaseOrder(order.id);
  return toSnapshot(request, order, linkedRequestCount);
}

/**
 * Item yang diisi di Masukkan Barang: item pesanan milik pengajuan ini. Bila
 * pesanan belum dibuat, rencananya disusun dari baris pengajuan, satu item per
 * barang seperti `generatePOFromPRs`, hanya untuk memeriksa isian sebelum
 * pesanan dibuat (id item = barangId, tidak pernah ditulis).
 */
export function getEntryItems(
  snapshot: RestockRequestSnapshot,
): RestockPurchaseOrderItem[] {
  if (snapshot.order) return snapshot.ownedItems;
  const itemsByBarang = new Map<string, RestockPurchaseOrderItem>();
  for (const line of snapshot.request.lines) {
    const planned = itemsByBarang.get(line.barangId);
    itemsByBarang.set(line.barangId, {
      id: line.barangId,
      barangId: line.barangId,
      quantity: (planned?.quantity ?? 0) + line.jumlah,
      receivedQuantity: 0,
      cancelledQuantity: 0,
      barang: line.barang,
    });
  }
  return [...itemsByBarang.values()];
}

function notFound(error: string): RestockRequestSnapshotLoad {
  return { success: false, code: "NOT_FOUND", error };
}

function toSnapshot(
  request: RestockPurchaseRequestForReceipt,
  order: RestockPurchaseOrderForReceipt | null,
  linkedRequestCount: number,
): RestockRequestSnapshotLoad {
  const ownedBarangIds = resolveOwnedBarangIds(request, linkedRequestCount);
  const ownedItems = (order?.items ?? []).filter(
    (item) => ownedBarangIds === null || ownedBarangIds.has(item.barangId),
  );
  return {
    success: true,
    data: {
      request,
      order,
      linkedRequestCount,
      ownedItems,
      status: toRestockStatusInput(request, order, linkedRequestCount),
    },
  };
}

/**
 * Pengajuan dalam bentuk yang dibaca aturan status bersama, termasuk jumlah
 * pengajuan yang memakai pesanannya (pesanan gabungan), sama dengan layar.
 */
function toRestockStatusInput(
  request: RestockPurchaseRequestForReceipt,
  order: RestockPurchaseOrderForReceipt | null,
  linkedRequestCount: number,
): RestockStatusInput {
  return {
    status: request.status,
    purchaseOrderId: request.purchaseOrderId,
    purchaseOrder: order ? { status: order.status, linkedRequestCount } : null,
    items: request.lines.map((line) => toStatusLine(line, order)),
    jasaItems: request.jasaItems,
    goodsReceipts: order?.goodsReceiptIds ?? [],
  };
}

/** Angka baris diambil dari item pesanan barang yang sama, seperti read model layar. */
function toStatusLine(
  line: RestockRequestLineForReceipt,
  order: RestockPurchaseOrderForReceipt | null,
): RestockStatusLine {
  const orderItem = order?.items.find(
    (item) => item.barangId === line.barangId,
  );
  return {
    jumlah: line.jumlah,
    orderedQuantity: orderItem?.quantity,
    receivedQuantity: orderItem?.receivedQuantity,
    cancelledQuantity: orderItem?.cancelledQuantity,
  };
}
