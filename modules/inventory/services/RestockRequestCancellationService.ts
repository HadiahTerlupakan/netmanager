import type { IRestockRequestClosureRepository } from "../domain/ports/IRestockGoodsReceiptRepository";
import type { IRestockRequestLock } from "../domain/ports/IRestockRequestLock";
import {
  canCancelRestockRequest,
  getRestockStatusKey,
  isRestockServiceOnly,
  type RestockStatusInput,
  type RestockStatusKey,
} from "../domain/restock-request-status";
import {
  INVENTORY_ACTIVITY_ACTIONS,
  INVENTORY_ACTIVITY_SUBJECTS,
  recordInventoryActivity,
} from "./inventory-activity-log";
import { RestockRequestClosure } from "./RestockRequestClosure";
import {
  loadRestockRequestSnapshot,
  type RestockRequestSnapshot,
} from "./restock-receipt-context";
import { withRestockRequestLock } from "./restock-request-lock";

/** Perintah membatalkan pengajuan restock yang sudah disetujui. */
export interface RestockCancelCommand {
  id: string;
  tenantId: string;
  actorId: string;
  /** Alasan admin, sudah dirapikan dan diperiksa panjangnya oleh skema. */
  alasan: string;
}

/** `NOT_FOUND` → 404, `CONFLICT` → 409. */
export type RestockCancelErrorCode = "NOT_FOUND" | "CONFLICT";

export type RestockCancelResult =
  | { success: true; data: { id: string; status: "CANCELLED" } }
  | { success: false; code: RestockCancelErrorCode; error: string };

const CANCEL_BLOCKED_MESSAGES: Record<
  Exclude<RestockStatusKey, "APPROVED">,
  string
> = {
  AWAITING_APPROVAL:
    "Pengajuan ini belum disetujui, jadi belum bisa dibatalkan. Pengajuan yang belum disetujui diputuskan lewat Tinjau & Putuskan.",
  RECEIVED:
    "Pengajuan ini sudah selesai, jadi tidak bisa dibatalkan. Muat ulang halaman untuk melihat keadaan terbarunya.",
  CANCELLED: "Pengajuan ini sudah dibatalkan. Muat ulang halaman.",
  REJECTED: "Pengajuan ini sudah ditolak, jadi tidak perlu dibatalkan.",
};

/** Pengajuan berbarang: jalan keluarnya Masukkan Barang, boleh tanpa barang tambahan. */
const CANCEL_AFTER_ENTRY_MESSAGE =
  'Pengajuan ini tidak bisa dibatalkan karena sudah ada barang yang masuk gudang atau jasa yang ditandai selesai. Selesaikan lewat Masukkan Barang. Kalau tidak ada barang lagi yang datang, isi semua jumlah dengan 0, lalu pilih "Selesaikan tanpa barang tambahan".';

/** Pengajuan jasa saja tidak punya Masukkan Barang; jalan keluarnya Konfirmasi Jasa. */
const CANCEL_AFTER_SERVICE_DONE_MESSAGE =
  "Pengajuan ini tidak bisa dibatalkan karena sudah ada jasa yang ditandai selesai. Tandai jasa yang tersisa selesai lewat Konfirmasi Jasa.";

const CANCEL_CONCURRENT_CHANGE_MESSAGE =
  "Pengajuan ini baru saja diubah orang lain, jadi belum dibatalkan. Muat ulang halaman, lalu coba lagi.";

/**
 * Batalkan pengajuan restock yang sudah disetujui tetapi belum ada barang
 * atau jasa yang masuk, dengan alasan admin. Aturannya sama dengan tombol
 * Batalkan Pengajuan di layar (`canCancelRestockRequest`).
 */
export class RestockRequestCancellationService {
  private readonly closure: RestockRequestClosure;

  constructor(
    private readonly repository: IRestockRequestClosureRepository,
    private readonly lock: IRestockRequestLock,
  ) {
    this.closure = new RestockRequestClosure(repository);
  }

  /** Batalkan pengajuan di bawah kunci pengajuan, lalu catat alasannya di Log Aktivitas. */
  async cancelRestockRequest(
    command: RestockCancelCommand,
  ): Promise<RestockCancelResult> {
    return withRestockRequestLock(this.lock, command.id, () =>
      this.cancelUnderLock(command),
    );
  }

  private async cancelUnderLock(
    command: RestockCancelCommand,
  ): Promise<RestockCancelResult> {
    const loaded = await loadRestockRequestSnapshot(
      this.repository,
      command.id,
      command.tenantId,
    );
    if (loaded.success === false) return loaded;
    const snapshot = loaded.data;
    if (!canCancelRestockRequest(snapshot.status)) {
      return conflict(describeCancelBlocker(snapshot.status));
    }

    const isCancelled = await this.closure.cancel({
      snapshot,
      reason: command.alasan,
      actorId: command.actorId,
      tenantId: command.tenantId,
    });
    if (!isCancelled) return conflict(CANCEL_CONCURRENT_CHANGE_MESSAGE);

    this.logCancellation(command, snapshot);
    return {
      success: true,
      data: { id: snapshot.request.id, status: "CANCELLED" },
    };
  }

  private logCancellation(
    command: RestockCancelCommand,
    snapshot: RestockRequestSnapshot,
  ): void {
    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.CANCEL,
      subject: INVENTORY_ACTIVITY_SUBJECTS.RESTOCK_REQUEST,
      reference: snapshot.request.nomorRequest,
      actorId: command.actorId,
      tenantId: command.tenantId,
      details: {
        purchaseRequestId: snapshot.request.id,
        purchaseOrderId: snapshot.order?.id ?? null,
        alasan: command.alasan,
      },
    });
  }
}

function conflict(error: string): RestockCancelResult {
  return { success: false, code: "CONFLICT", error };
}

/**
 * Alasan pengajuan tidak bisa dibatalkan, dalam kata untuk admin, beserta
 * jalan keluar yang memang tersedia untuk pengajuan itu.
 */
function describeCancelBlocker(status: RestockStatusInput): string {
  const key = getRestockStatusKey(status);
  if (key !== "APPROVED") return CANCEL_BLOCKED_MESSAGES[key];
  return isRestockServiceOnly(status)
    ? CANCEL_AFTER_SERVICE_DONE_MESSAGE
    : CANCEL_AFTER_ENTRY_MESSAGE;
}
