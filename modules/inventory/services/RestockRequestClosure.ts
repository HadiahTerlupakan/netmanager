import type {
  GuardedItemCancellation,
  IRestockRequestClosureRepository,
  RestockPurchaseOrderForReceipt,
} from "../domain/ports/IRestockGoodsReceiptRepository";
import { NOT_ENTERED_CANCEL_REASON } from "../domain/restock-request-status";
import type { RestockNotEnteredLine } from "./restock-goods-receipt.contracts";
import type { RestockRequestSnapshot } from "./restock-receipt-context";
import {
  canCancelUnfulfilledOrder,
  decideLastRequestCancelSettlement,
  planRemainderCancellations,
  type PlannedRemainderCancellation,
} from "./restock-receipt-settlement";

/** Langkah Masukkan Barang yang sudah tertulis sebelum pengajuan ditutup. */
export interface RestockEntryClosingInput {
  snapshot: RestockRequestSnapshot;
  /** Pesanan pengajuan; Masukkan Barang selalu punya pesanan saat menutup. */
  order: RestockPurchaseOrderForReceipt;
  /** Jumlah yang baru masuk lewat GRN, per id item pesanan. */
  enteredByItemId: ReadonlyMap<string, number>;
  /** Kelebihan yang baru dinaikkan ke pesanan, per id item pesanan. */
  extraByItemId: ReadonlyMap<string, number>;
  actorId: string;
}

/**
 * Hasil menutup pengajuan setelah barang dimasukkan. `notEntered` hanya berisi
 * sisa yang benar-benar dicoret; kosong bila pesanan gabungan masih dipakai
 * pengajuan lain yang terbuka. `isWritten: false` bila pesanan berubah di
 * tengah jalan; tidak ada yang tertulis.
 */
export type RestockEntryClosing =
  | { isWritten: true; notEntered: RestockNotEnteredLine[] }
  | { isWritten: false };

/** Pembatalan pengajuan beserta alasan admin. */
export interface RestockCancelClosingInput {
  snapshot: RestockRequestSnapshot;
  reason: string;
  actorId: string;
  tenantId: string;
}

/**
 * Penutupan pengajuan restock yang sudah disetujui: menyelesaikannya setelah
 * barang dimasukkan, atau membatalkannya sebelum ada yang masuk.
 *
 * Barang di pesanan gabungan tidak bisa dipisah per pengajuan, jadi penentunya
 * adalah pengajuan lain yang masih terbuka di pesanan yang sama, dibaca ulang
 * di dalam transaksi penutupan sesudah pesanan dikunci. Selama masih ada,
 * tidak ada sisa yang dicoret dan hanya pengajuan ini yang ditutup. Pengajuan
 * terakhir yang ditutup mencoret semua sisa pesanan (bersyarat item yang
 * dibaca, sehingga perubahan yang masuk bersamaan tidak tertimpa) dan ikut
 * menutup pesanannya. Pesanan milik satu pengajuan selalu memakai rencana
 * terakhir.
 */
export class RestockRequestClosure {
  constructor(private readonly repository: IRestockRequestClosureRepository) {}

  /**
   * Selesaikan pengajuan setelah barang dimasukkan: pengajuan menjadi Sudah
   * Dimasukkan. Bila pengajuan ini yang terakhir terbuka, sisa pesanan yang
   * tidak dimasukkan dicoret dengan alasan baku dan pesanannya ikut selesai.
   */
  async finishAfterEntry(
    input: RestockEntryClosingInput,
  ): Promise<RestockEntryClosing> {
    const { snapshot, order } = input;
    const planned = planRemainderCancellations({
      items: order.items,
      reason: NOT_ENTERED_CANCEL_REASON,
      enteredByItemId: input.enteredByItemId,
      extraByItemId: input.extraByItemId,
    });
    const closed = await this.repository.closeRequest({
      purchaseOrderId: order.id,
      purchaseRequestId: snapshot.request.id,
      ifOtherRequestsOpen: "SETTLE_REQUEST",
      ifLastOpenRequest: {
        settlement: "SETTLE_ORDER",
        cancellations: toCancellations(planned),
      },
      actorId: input.actorId,
      cancelledAt: new Date(),
    });
    if (!closed.isWritten) return { isWritten: false };
    const struck = closed.isLastOpenRequest ? planned : [];
    return { isWritten: true, notEntered: struck.map(toNotEnteredLine) };
  }

  /**
   * Batalkan pengajuan yang belum menerima apa pun. Tanpa pesanan, hanya
   * pengajuannya yang dibatalkan. Dengan pesanan, pengajuan terakhir yang
   * terbuka mencoret sisa pesanan dengan alasan admin, lalu pesanannya ikut
   * dibatalkan bila belum tersentuh apa pun. False bila ada yang berubah di
   * tengah jalan.
   */
  async cancel(input: RestockCancelClosingInput): Promise<boolean> {
    const { snapshot } = input;
    const { order } = snapshot;
    if (!order) {
      return this.repository.cancelRequestWithoutOrder({
        purchaseRequestId: snapshot.request.id,
        tenantId: input.tenantId,
        cancelReason: input.reason,
      });
    }
    const planned = planRemainderCancellations({
      items: order.items,
      reason: input.reason,
    });
    const closed = await this.repository.closeRequest({
      purchaseOrderId: order.id,
      purchaseRequestId: snapshot.request.id,
      ifOtherRequestsOpen: "CANCEL_REQUEST",
      ifLastOpenRequest: {
        settlement: decideLastRequestCancelSettlement(
          canCancelUnfulfilledOrder(order, snapshot.linkedRequestCount),
        ),
        cancellations: toCancellations(planned),
      },
      actorId: input.actorId,
      cancelledAt: new Date(),
      cancelReason: input.reason,
    });
    return closed.isWritten;
  }
}

function toCancellations(
  planned: PlannedRemainderCancellation[],
): GuardedItemCancellation[] {
  return planned.map((entry) => entry.cancellation);
}

function toNotEnteredLine({
  item,
  cancellation,
}: PlannedRemainderCancellation): RestockNotEnteredLine {
  return {
    barangId: item.barangId,
    barangName: item.barang?.nama ?? item.barangId,
    quantity: cancellation.cancelledQuantity,
  };
}
