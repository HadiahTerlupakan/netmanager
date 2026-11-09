import { logActivitySafe } from "@/lib/logger";

/** Nama aksi Log Aktivitas untuk tindakan inventory. */
export const INVENTORY_ACTIVITY_ACTIONS = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  /** Satu kali belanja dicatat untuk pengajuan restock. */
  RECORD_PURCHASE: "RECORD_PURCHASE",
  /** Catatan belanja dibatalkan admin; jumlah dibelinya dikembalikan. */
  VOID_PURCHASE: "VOID_PURCHASE",
  /** Link belanja tanpa login dibuat untuk pengajuan restock. */
  CREATE_PURCHASE_LINK: "CREATE_PURCHASE_LINK",
  /** Link belanja tanpa login dimatikan. */
  REVOKE_PURCHASE_LINK: "REVOKE_PURCHASE_LINK",
  RECEIVE: "RECEIVE",
  /** Pesanan diselesaikan tanpa kiriman: sisa barangnya tidak jadi datang. */
  FINISH_WITHOUT_DELIVERY: "FINISH_WITHOUT_DELIVERY",
} as const;

export type InventoryActivityAction =
  (typeof INVENTORY_ACTIVITY_ACTIONS)[keyof typeof INVENTORY_ACTIVITY_ACTIONS];

/** Jenis dokumen inventory yang menjadi awalan subjek log. */
export const INVENTORY_ACTIVITY_SUBJECTS = {
  RESTOCK_REQUEST: "Pengajuan Restock",
  PURCHASE_ORDER: "Purchase Order",
  BARANG_MASUK: "Barang Masuk",
  BARANG_KELUAR: "Barang Keluar",
  TRANSFER: "Transfer Barang",
  STOCK_OPNAME: "Stock Opname",
} as const;

export type InventoryActivitySubject =
  (typeof INVENTORY_ACTIVITY_SUBJECTS)[keyof typeof INVENTORY_ACTIVITY_SUBJECTS];

/** Pelaku di luar akun aplikasi, mis. pemegang link belanja. */
export interface InventoryExternalActor {
  type: "purchase_link";
  id: string;
}

/**
 * Catat tindakan inventory ke Log Aktivitas dengan subjek
 * `<jenis dokumen> <referensi>` agar bisa dicari per dokumen. Bila tenantId
 * tidak diberikan, logger mengisinya dari tenant pelaku. Tindakan lewat link
 * tanpa login memakai `externalActor`, sehingga tidak tercatat atas nama user.
 */
export function recordInventoryActivity(input: {
  action: InventoryActivityAction;
  subject: InventoryActivitySubject;
  reference: string;
  actorId?: string;
  externalActor?: InventoryExternalActor;
  tenantId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}): void {
  logActivitySafe({
    action: input.action,
    subject: `${input.subject} ${input.reference}`,
    ...(input.externalActor
      ? {
          actor: { type: input.externalActor.type, id: input.externalActor.id },
        }
      : { userId: input.actorId }),
    tenantId: input.tenantId ?? undefined,
    details: input.details,
    ipAddress: input.ipAddress ?? undefined,
    userAgent: input.userAgent ?? undefined,
  });
}
