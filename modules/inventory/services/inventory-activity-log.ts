import { logActivitySafe } from "@/lib/logger";

/** Nama aksi Log Aktivitas untuk tindakan inventory. */
export const INVENTORY_ACTIVITY_ACTIONS = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  APPROVE: "APPROVE",
  START_SHOPPING: "START_SHOPPING",
  RECEIVE: "RECEIVE",
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

/**
 * Catat tindakan inventory ke Log Aktivitas dengan subjek
 * `<jenis dokumen> <referensi>` agar bisa dicari per dokumen. Bila tenantId
 * tidak diberikan, logger mengisinya dari tenant pelaku.
 */
export function recordInventoryActivity(input: {
  action: InventoryActivityAction;
  subject: InventoryActivitySubject;
  reference: string;
  actorId: string;
  tenantId?: string | null;
  details?: Record<string, unknown>;
}): void {
  logActivitySafe({
    action: input.action,
    subject: `${input.subject} ${input.reference}`,
    userId: input.actorId,
    tenantId: input.tenantId ?? undefined,
    details: input.details,
  });
}
