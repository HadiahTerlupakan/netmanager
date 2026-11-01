import { logger } from "@/lib/logger";

import {
  INVENTORY_USER_ERROR_STATUS,
  isInventoryUserError,
} from "../domain/inventory-user-error";

/** Kegagalan mutasi stok yang siap dikirim ke pengguna. */
export interface InventoryMutationFailure {
  success: false;
  status: number;
  error: string;
}

const PRISMA_FOREIGN_KEY_ERROR = "P2003";
const PRISMA_RECORD_NOT_FOUND_ERROR = "P2025";
const SERVER_ERROR_STATUS = 500;

const STALE_SELECTION_MESSAGE =
  "Barang atau gudang yang dipilih sudah tidak ada, mungkin baru dihapus. Muat ulang halaman, lalu pilih lagi.";
const RECORD_GONE_MESSAGE =
  "Data ini tidak ditemukan, mungkin sudah dihapus orang lain. Muat ulang halaman.";

function getPrismaErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error))
    return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

/**
 * Ubah error dari pencatatan stok menjadi pesan untuk staf gudang.
 *
 * `actionLabel` menyebut apa yang gagal ("Barang masuk", "Perubahan barang
 * keluar") untuk pesan gangguan server. Semua operasi stok berjalan dalam satu
 * transaksi, jadi pesan itu boleh menjanjikan bahwa tidak ada stok yang berubah.
 * Penyebab aslinya hanya ditulis ke log.
 */
export function toInventoryMutationFailure(
  error: unknown,
  actionLabel: string,
): InventoryMutationFailure {
  if (isInventoryUserError(error)) {
    return { success: false, status: error.status, error: error.message };
  }

  const prismaCode = getPrismaErrorCode(error);
  if (prismaCode === PRISMA_FOREIGN_KEY_ERROR) {
    return {
      success: false,
      status: INVENTORY_USER_ERROR_STATUS.BAD_REQUEST,
      error: STALE_SELECTION_MESSAGE,
    };
  }
  if (prismaCode === PRISMA_RECORD_NOT_FOUND_ERROR) {
    return {
      success: false,
      status: INVENTORY_USER_ERROR_STATUS.NOT_FOUND,
      error: RECORD_GONE_MESSAGE,
    };
  }

  logger.error(
    `${actionLabel} gagal tersimpan`,
    error instanceof Error ? error : new Error(String(error)),
  );
  return {
    success: false,
    status: SERVER_ERROR_STATUS,
    error: `${actionLabel} belum tersimpan karena ada gangguan di server. Stok tidak berubah. Coba simpan sekali lagi; kalau tetap gagal, laporkan ke admin.`,
  };
}
