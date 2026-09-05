import { AppError } from "@/lib/errors";

/**
 * Error domain modul planning.
 *
 * Sebelumnya seluruh service melempar `new Error("Planning with ID x not
 * found")` dan setiap route menebak maksudnya dengan `err.message.includes(...)`.
 * Konsekuensinya nyata, bukan teoretis:
 *
 * - Pelanggaran segregation of duties tidak cocok dengan pola mana pun di
 *   route approve, sehingga kontrol paling penting di modul ini melapor ke
 *   penyetuju sebagai "Terjadi kesalahan pada server" (500).
 * - Guard ruang lingkup melempar "Planning scope cannot be changed ..." yang
 *   tidak mengandung "cannot be edited", jadi ikut jatuh ke 500.
 * - Pesan internal berbahasa Inggris dibalikkan apa adanya ke pengguna.
 *
 * `AppError` sudah dikenali `handleError` di `lib/api/handler.ts` dan membawa
 * status code sendiri, sehingga route tidak perlu lagi menerjemahkan apa pun.
 */

/** Rencana tidak ada, sudah dihapus, atau milik tenant lain. */
export class PlanningNotFoundError extends AppError {
  constructor(message = "Rencana tidak ditemukan") {
    super(message, 404, "PLANNING_NOT_FOUND");
  }
}

/** Template rencana tidak ada atau milik tenant lain. */
export class PlanningTemplateNotFoundError extends AppError {
  constructor(message = "Template rencana tidak ditemukan") {
    super(message, 404, "PLANNING_TEMPLATE_NOT_FOUND");
  }
}

/**
 * Aksi tidak sah untuk status rencana saat ini.
 *
 * 409 dan bukan 400: permintaannya sendiri valid, yang bentrok adalah keadaan
 * rencana di server — dan keadaan itu bisa saja berubah karena orang lain.
 */
export class PlanningInvalidStateError extends AppError {
  constructor(message: string) {
    super(message, 409, "PLANNING_INVALID_STATE");
  }
}

/** Masukan tidak memenuhi aturan bisnis (mis. catatan penolakan kosong). */
export class PlanningValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "PLANNING_VALIDATION_ERROR");
  }
}

/**
 * Satu orang mencoba menyetujui lebih dari satu tingkat.
 *
 * Alur `approvalLevel: 2` memisahkan `approvedLevel1ById` dan `approvedById`,
 * yang maksudnya jelas: dua orang berbeda. Tanpa pemeriksaan ini satu orang
 * dapat menyetujui kedua tingkat sendirian, sehingga persetujuan berlapis
 * hanya menambah klik tanpa memberi kendali apa pun — padahal dokumen ini
 * memutuskan belanja infrastruktur.
 */
export class PlanningSegregationOfDutiesError extends AppError {
  constructor(
    message = "Persetujuan tingkat kedua harus dilakukan oleh orang yang berbeda dari penyetuju tingkat pertama",
  ) {
    super(message, 409, "PLANNING_SEGREGATION_OF_DUTIES");
  }
}

/**
 * Rencana berubah oleh orang lain di antara pembacaan dan penulisan.
 *
 * Dilempar saat `expectedStatus` tidak lagi cocok — dua penyetuju menekan
 * tombol bersamaan, atau rencana sudah diajukan ulang di tab lain. 409 supaya
 * klien tahu ini bentrok keadaan, bukan permintaan yang salah bentuk.
 */
export class PlanningConcurrentUpdateError extends AppError {
  constructor(
    message = "Rencana baru saja diubah oleh orang lain. Muat ulang halaman lalu coba lagi.",
  ) {
    super(message, 409, "PLANNING_CONCURRENT_UPDATE");
  }
}
