/**
 * Pesan restock untuk petugas gudang. Setiap pesan menyebut apa yang terjadi
 * dan apa yang harus dilakukan, dengan kata sehari-hari — tanpa istilah teknis
 * dan tanpa kode status mentah seperti DRAFT atau ORDERED.
 */

import { isPrismaForeignKeyError } from "@/lib/prisma-errors";

export {
  RestockSettingReferenceError,
  type RestockSettingReference,
} from "../domain/restock-setting-errors";

/** Keadaan pengajuan/pesanan dalam kata biasa, untuk kalimat "Pengajuan ini …". */
const RESTOCK_STATUS_WORDS: Record<string, string> = {
  DRAFT: "masih menunggu persetujuan",
  SUBMITTED: "sudah diajukan dan menunggu persetujuan",
  APPROVED: "sudah disetujui",
  REJECTED: "sudah ditolak",
  ORDERED: "sedang dibelanjakan",
  PARTIAL: "barangnya baru datang sebagian",
  RECEIVED: "barangnya sudah diterima semua",
  CANCELLED: "sudah dibatalkan",
};

/** Keadaan pengajuan restock dalam kata biasa. */
export function describeRestockStatus(
  status: string | null | undefined,
): string {
  return RESTOCK_STATUS_WORDS[status ?? ""] ?? "sedang dalam proses lain";
}

/** Izin restock dan kegiatan yang dilindunginya, untuk pesan "tidak punya izin". */
const RESTOCK_PERMISSION_ACTIVITIES = {
  "restock:read": "melihat pengajuan restock",
  "restock:create": "membuat pengajuan restock",
  "restock:update": "mengubah pengajuan atau pengaturan restock",
  "restock:delete": "menghapus pengajuan restock",
  "restock:approve": "menyetujui pengajuan restock",
  "restock:verify": "menerima barang dan jasa restock",
} as const;

export type RestockPermission = keyof typeof RESTOCK_PERMISSION_ACTIVITIES;

/** Pesan untuk akun yang tidak punya izin restock tertentu. */
export function restockForbiddenMessage(permission: RestockPermission): string {
  return `Akun Anda tidak punya izin ${RESTOCK_PERMISSION_ACTIVITIES[permission]}. Minta admin menambahkan izin itu ke peran Anda.`;
}

/** Pesan gangguan server; `isNothingSaved` hanya benar bila langkahnya satu transaksi. */
export function restockServerErrorMessage(
  activity: string,
  isNothingSaved: boolean,
): string {
  const effect = isNothingSaved ? " Tidak ada data yang berubah." : "";
  return `${activity} belum berhasil karena ada gangguan di server.${effect} Coba sekali lagi. Kalau tetap gagal, lapor ke admin.`;
}

export const RESTOCK_MESSAGES = {
  sessionExpired:
    "Waktu login Anda sudah habis. Silakan login lagi, lalu ulangi.",
  unreadableBody:
    "Data yang dikirim tidak terbaca. Muat ulang halaman, lalu coba lagi.",
  requestNotFound:
    "Pengajuan restock tidak ditemukan. Mungkin sudah dihapus. Muat ulang halaman, lalu coba lagi.",
  purchaseOrderNotFound:
    "Pesanan pembelian (PO) untuk pengajuan ini tidak ditemukan. Mungkin sudah dihapus. Muat ulang halaman. Kalau masih muncul, lapor ke admin.",
  nothingRequested:
    "Belum ada barang atau jasa yang diminta. Tambahkan paling sedikit satu barang atau jasa.",
  gudangMissing: "Gudang tujuan belum dipilih. Pilih gudangnya dulu.",
  unknownLifecycleAction:
    "Tindakan ini tidak dikenal. Pilih Setujui atau Tolak, lalu coba lagi.",
  noPurchaseOrderYet:
    "Pengajuan ini belum punya pesanan pembelian (PO). Setujui pengajuannya dulu, nanti PO dibuat otomatis.",
  cannotDeleteReceived:
    "Pengajuan ini tidak bisa dihapus karena barangnya sudah diterima dan sudah masuk stok.",
  duplicateRequestNumber:
    "Ada orang lain yang menyimpan pengajuan di waktu yang sama. Pengajuan Anda belum tersimpan. Tekan simpan sekali lagi.",
  missingReference:
    "Ada barang, jasa, atau gudang yang sudah dihapus. Pengajuan belum tersimpan. Muat ulang halaman, pilih lagi, lalu simpan.",
} as const;

/** Pesan saat pengajuan tidak bisa diubah karena sudah lewat tahap persetujuan. */
export function restockCannotEditMessage(status: string): string {
  return `Pengajuan ini ${describeRestockStatus(status)}, jadi tidak bisa diubah lagi. Yang bisa diubah hanya pengajuan yang belum disetujui.`;
}

/** Pesan saat pengajuan tidak bisa disetujui/ditolak karena sudah diproses. */
export function restockAlreadyDecidedMessage(
  status: string,
  decision: "disetujui" | "ditolak",
): string {
  return `Pengajuan ini ${describeRestockStatus(status)}, jadi tidak bisa ${decision} lagi. Muat ulang halaman untuk melihat keadaan terbarunya.`;
}

/**
 * Simpan pengajuan gagal karena barang, jasa, atau gudang yang dipilih sudah
 * dihapus (foreign key). Petugas cukup memilih ulang; ini bukan gangguan server.
 */
export function isRestockMissingReferenceError(error: unknown): boolean {
  return isPrismaForeignKeyError(error);
}
