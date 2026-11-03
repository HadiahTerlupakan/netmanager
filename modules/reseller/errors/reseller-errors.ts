import { AppError } from "@/lib/errors";

/**
 * Error domain modul reseller.
 *
 * Sebelumnya service melempar `new Error("... tidak ditemukan")` dan setiap
 * route menebak status HTTP dari potongan pesannya, dengan salinan pemeta yang
 * isinya berbeda-beda. Pesan yang tidak cocok dengan pola mana pun — mis.
 * "Reseller tidak aktif" saat membuat pelanggan — jatuh ke 500. `AppError`
 * sudah diterjemahkan `handleError` di `lib/api/handler.ts`, jadi route cukup
 * membiarkannya naik.
 */

/** Reseller atau outlet tidak ada, sudah dihapus, atau milik tenant lain. */
export class ResellerNotFoundError extends AppError {
  constructor(message = "Reseller tidak ditemukan") {
    super(message, 404, "RESELLER_NOT_FOUND");
  }
}

/** Data bentrok dengan data lain, mis. kode reseller/outlet sudah dipakai. */
export class ResellerConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "RESELLER_CONFLICT");
  }
}

/**
 * Masukan tidak memenuhi aturan bisnis reseller, mis. pelanggan dikaitkan ke
 * reseller nonaktif atau outlet milik reseller lain.
 */
export class ResellerValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "RESELLER_VALIDATION_ERROR");
  }
}

/**
 * Aksi ditolak oleh aturan tata kelola tenant, mis. pemisahan tugas: pengguna
 * yang menyetujui settlement tidak boleh juga membayarnya.
 */
export class ResellerForbiddenError extends AppError {
  constructor(message: string) {
    super(message, 403, "RESELLER_FORBIDDEN");
  }
}
