/**
 * Hasil operasi chat yang bisa gagal karena aturan bisnis. Kegagalan seperti
 * ini bukan galat server: route menjawabnya dengan status 4xx dan pesan yang
 * dimengerti orang awam, bukan 500.
 */
export type ChatFailureCode =
  | "NOT_PARTICIPANT"
  | "EMPLOYEE_ONLY"
  | "INVALID_PARTICIPANTS";

/**
 * Field cabang lain ditandai `never` supaya `result.data`/`result.code` bisa
 * dibaca tanpa narrowing — proyek ini memakai `strictNullChecks: false`, yang
 * membuat `if (!result.success)` tidak mempersempit union.
 */
export type ChatResult<T> =
  | { success: true; data: T; code?: never; error?: never }
  | { success: false; code: ChatFailureCode; error: string; data?: never };

/** Pesan untuk pengguna: apa yang salah dan apa yang harus dilakukan. */
export const CHAT_PESAN: Record<ChatFailureCode, string> = {
  NOT_PARTICIPANT:
    "Anda bukan anggota percakapan ini. Buka percakapan dari daftar chat Anda sendiri.",
  EMPLOYEE_ONLY:
    "Fitur chat hanya untuk akun karyawan. Akun Anda tidak bisa memakai bagian ini.",
  INVALID_PARTICIPANTS:
    "Ada orang yang dipilih yang bukan karyawan aktif di kantor Anda. Tutup jendela ini, lalu pilih lagi dari daftar.",
};

/** Bungkus data sukses. */
export function chatOk<T>(data: T): ChatResult<T> {
  return { success: true, data };
}

/** Bungkus kegagalan aturan bisnis beserta pesannya. */
export function chatGagal<T>(code: ChatFailureCode): ChatResult<T> {
  return { success: false, code, error: CHAT_PESAN[code] };
}
