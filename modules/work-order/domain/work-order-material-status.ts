import type { WorkOrderStatus } from "../types/work-order.enums";

/**
 * Status work order yang materialnya terkunci untuk jalur admin.
 *
 * Sama dengan mode read-only detail WO di panel admin (tombol "Tambah Material"
 * disembunyikan pada status ini). COMPLETED sengaja TIDAK dikunci: admin masih
 * perlu mengoreksi material sebelum WO diverifikasi, dan jalur mobile pun masih
 * menerima pengembalian barang pada COMPLETED. Setelah VERIFIED/CLOSED/CANCELLED
 * pemakaian material dianggap final, jadi stok tidak boleh lagi dipotong.
 */
export const ADMIN_MATERIAL_LOCKED_STATUSES: readonly WorkOrderStatus[] = [
  "VERIFIED",
  "CLOSED",
  "CANCELLED",
];

/** Apakah material work order berstatus ini sudah terkunci untuk admin. */
export function isAdminMaterialLocked(
  status: string | null | undefined,
): boolean {
  if (!status) return false;
  return (ADMIN_MATERIAL_LOCKED_STATUSES as readonly string[]).includes(status);
}

/** Pesan penolakan admin menambah material pada work order yang terkunci. */
export function buildAdminMaterialLockedMessage(status: string): string {
  return `Material tidak bisa ditambahkan karena work order sudah berstatus ${status}. Material hanya bisa diubah sebelum work order diverifikasi.`;
}
