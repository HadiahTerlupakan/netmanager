import type {
  IRestockRequestDeletionRepository,
  RestockRequestForDeletion,
} from "../domain/ports/IRestockRequestDeletionRepository";
import type { IRestockRequestLock } from "../domain/ports/IRestockRequestLock";
import {
  canDeleteRestockRequest,
  hasRestockEnteredAnything,
} from "../domain/restock-request-status";
import {
  INVENTORY_ACTIVITY_ACTIONS,
  INVENTORY_ACTIVITY_SUBJECTS,
  recordInventoryActivity,
} from "./inventory-activity-log";
import { RESTOCK_MESSAGES } from "./restock-messages";
import { withRestockRequestLock } from "./restock-request-lock";

const RECEIVED_STATUS = "RECEIVED";

const DELETE_CONCURRENT_CHANGE_MESSAGE =
  "Pengajuan ini baru saja diubah orang lain, jadi belum dihapus. Muat ulang halaman untuk melihat keadaan terbarunya.";

/**
 * Hasil menghapus pesanan pengajuan di procurement. Procurement memeriksa
 * ulang di bawah kunci baris pesanan, jadi hasilnya bisa berbeda dari
 * pemeriksaan awal bila pesanannya berubah di antaranya.
 */
export type RestockOrderRemovalOutcome =
  | "REMOVED"
  | "HAS_LEGACY_PURCHASES"
  | "LOCKED";

/** Penghapus pesanan pengajuan; dipenuhi procurement lewat factory. */
export interface RestockPurchaseOrderRemover {
  removePurchaseOrder(
    purchaseOrderId: string,
  ): Promise<RestockOrderRemovalOutcome>;
}

/** Perintah menghapus pengajuan restock. */
export interface RestockDeleteCommand {
  id: string;
  tenantId: string;
  actorId: string;
}

/** `NOT_FOUND` → 404, `CONFLICT` → 409. */
export type RestockDeleteErrorCode = "NOT_FOUND" | "CONFLICT";

export type RestockDeleteResult =
  | { success: true; data: { id: string } }
  | { success: false; code: RestockDeleteErrorCode; error: string };

/** Pesan bila procurement menolak menghapus pesanan pengajuan. */
const ORDER_REMOVAL_REFUSAL_MESSAGES: Record<
  Exclude<RestockOrderRemovalOutcome, "REMOVED">,
  string
> = {
  HAS_LEGACY_PURCHASES: RESTOCK_MESSAGES.cannotDeleteWithLegacyPurchases,
  LOCKED: RESTOCK_MESSAGES.cannotDeleteAfterEntry,
};

/**
 * Hapus pengajuan restock dengan aturan yang sama seperti tombol Hapus di
 * layar (`canDeleteRestockRequest`): belum Sudah Sampai, pesanannya (bila
 * ada) belum diproses, dan belum ada barang atau jasa yang masuk. Pesanan yang
 * masih DRAFT dihapus lewat procurement lebih dulu, baru pengajuannya.
 *
 * Berjalan di bawah kunci pengajuan yang sama dengan Lapor Barang Sampai dan
 * Batalkan, dan pengajuan dibaca setelah kunci didapat. Penghapusannya sendiri
 * bersyarat di database, karena persetujuan dan Generate PO di procurement
 * bisa membuat pesanan tanpa kunci ini.
 */
export class RestockRequestDeletionService {
  constructor(
    private readonly repository: IRestockRequestDeletionRepository,
    private readonly purchaseOrderRemover: RestockPurchaseOrderRemover,
    private readonly lock: IRestockRequestLock,
  ) {}

  /** Hapus pengajuan restock milik tenant di bawah kunci pengajuan, lalu catat pelakunya. */
  async deleteRestockRequest(
    command: RestockDeleteCommand,
  ): Promise<RestockDeleteResult> {
    return withRestockRequestLock(this.lock, command.id, () =>
      this.deleteUnderLock(command),
    );
  }

  private async deleteUnderLock(
    command: RestockDeleteCommand,
  ): Promise<RestockDeleteResult> {
    const request = await this.repository.findPurchaseRequestDetail(
      command.id,
      command.tenantId,
    );
    if (!request) {
      return {
        success: false,
        code: "NOT_FOUND",
        error: RESTOCK_MESSAGES.requestNotFound,
      };
    }
    if (!canDeleteRestockRequest(request)) {
      return conflict(describeDeletionBlocker(request));
    }
    if (request.purchaseOrderId) {
      const outcome = await this.purchaseOrderRemover.removePurchaseOrder(
        request.purchaseOrderId,
      );
      if (outcome !== "REMOVED") {
        return conflict(ORDER_REMOVAL_REFUSAL_MESSAGES[outcome]);
      }
    }

    const isDeleted = await this.repository.deletePurchaseRequestIfDeletable(
      request.id,
      command.tenantId,
    );
    if (!isDeleted) return conflict(DELETE_CONCURRENT_CHANGE_MESSAGE);
    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.DELETE,
      subject: INVENTORY_ACTIVITY_SUBJECTS.RESTOCK_REQUEST,
      reference: request.nomorRequest,
      actorId: command.actorId,
      tenantId: command.tenantId,
      details: {
        purchaseRequestId: request.id,
        purchaseOrderId: request.purchaseOrderId ?? null,
      },
    });
    return { success: true, data: { id: request.id } };
  }
}

function conflict(error: string): RestockDeleteResult {
  return { success: false, code: "CONFLICT", error };
}

/** Alasan pengajuan tidak boleh dihapus, dalam kata untuk petugas. */
function describeDeletionBlocker(request: RestockRequestForDeletion): string {
  if (request.status === RECEIVED_STATUS) {
    return RESTOCK_MESSAGES.cannotDeleteReceived;
  }
  if (hasRestockEnteredAnything(request)) {
    return RESTOCK_MESSAGES.cannotDeleteAfterEntry;
  }
  return RESTOCK_MESSAGES.cannotDeleteProcessedOrder;
}
