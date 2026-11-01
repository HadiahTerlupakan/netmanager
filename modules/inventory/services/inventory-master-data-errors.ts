import type { ZodError } from "zod";

import { logger } from "@/lib/logger";

/**
 * Pesan error master data inventory (barang, gudang, jasa, aset).
 *
 * Pesan di sini dibaca staf gudang, bukan programmer: kalimat pendek, kata
 * sehari-hari, menyebut apa yang salah dan apa yang harus dilakukan. Jangan
 * memasukkan istilah teknis (ID, kode HTTP, nama kolom database) ke pesan.
 */

/** Hasil gagal yang dikembalikan service ke route. */
export interface MasterDataFailure {
  success: false;
  status: number;
  error: string;
  details?: Record<string, string[]>;
}

/** Satu baris tabel terjemahan error teknis → pesan staf. */
export interface MasterDataErrorTranslation {
  matches: (error: Error & { code?: string }) => boolean;
  status: number;
  /** Teks tetap, atau fungsi bila pesan perlu mengutip isi error (mis. kode barang). */
  message: string | ((error: Error) => string);
}

const HTTP_BAD_REQUEST = 400;
const HTTP_SERVER_ERROR = 500;

/** Kode error Prisma (P2002, P2003, P2025, ...) bila error berasal dari Prisma. */
export function getPrismaErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && /^P\d{4}$/.test(code)) return code;
  const message = (error as { message?: unknown }).message;
  if (typeof message !== "string") return undefined;
  return /\b(P\d{4})\b/.exec(message)?.[1];
}

/** Cocokkan error dengan kode Prisma tertentu. */
export function isPrismaError(code: string) {
  return (error: unknown) => getPrismaErrorCode(error) === code;
}

/** Pesan saat simpan/ubah gagal karena gangguan server. */
export function pesanGagalSimpan(benda: string): string {
  return `${benda} belum tersimpan karena ada gangguan di server. Coba sekali lagi. Kalau tetap gagal, laporkan ke admin.`;
}

/** Pesan saat hapus gagal karena gangguan server. */
export function pesanGagalHapus(benda: string): string {
  return `${benda} belum terhapus karena ada gangguan di server. Coba sekali lagi. Kalau tetap gagal, laporkan ke admin.`;
}

/** Pesan saat data gagal dimuat karena gangguan server. */
export function pesanGagalMuat(benda: string): string {
  return `Data ${benda} belum bisa dimuat karena ada gangguan di server. Muat ulang halaman. Kalau tetap gagal, laporkan ke admin.`;
}

/** Pesan saat akun tidak punya izin untuk sebuah aksi. */
export function pesanTanpaIzin(aksi: string): string {
  return `Akun Anda tidak punya izin ${aksi}. Minta admin menambahkan izin itu ke akun Anda.`;
}

/** Pesan 404; selalu memuat "tidak ditemukan" agar `ApiErrors.notFound` tidak menggandakannya. */
export function pesanTidakDitemukan(benda: string): string {
  return `${benda} tidak ditemukan. Mungkin sudah dihapus. Muat ulang halaman, lalu coba lagi.`;
}

/** Pesan saat sesi login tidak ada atau sudah habis. */
export const PESAN_BELUM_MASUK =
  "Anda belum masuk atau waktu masuk sudah habis. Masuk (login) lagi, lalu coba lagi.";

/** Pesan saat isi permintaan rusak/tidak terbaca. */
export const PESAN_DATA_TIDAK_TERBACA =
  "Data yang dikirim tidak terbaca. Muat ulang halaman, lalu isi dan simpan lagi.";

/**
 * Rangkum semua masalah isian dari Zod: satu baris per masalah, dan
 * `details` per kolom agar form bisa menandai kolomnya.
 */
export function describeZodIssues(error: ZodError): MasterDataFailure {
  const details: Record<string, string[]> = {};
  const lines: string[] = [];

  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    const existing = details[key] ?? [];
    if (existing.includes(issue.message)) continue;
    details[key] = [...existing, issue.message];
    if (!lines.includes(issue.message)) lines.push(issue.message);
  }

  return {
    success: false,
    status: HTTP_BAD_REQUEST,
    error: lines.join("\n") || PESAN_DATA_TIDAK_TERBACA,
    details,
  };
}

/**
 * Terjemahkan error tak terduga lewat tabel. Yang tidak dikenali dicatat ke
 * log beserta penyebab aslinya, dan staf menerima `fallbackMessage`.
 */
export function translateMasterDataError(
  error: unknown,
  translations: readonly MasterDataErrorTranslation[],
  fallback: { message: string; logContext: string },
): MasterDataFailure {
  const err = (
    error instanceof Error ? error : new Error(String(error))
  ) as Error & {
    code?: string;
  };
  const translation = translations.find((item) => item.matches(err));
  if (translation) {
    const message =
      typeof translation.message === "function"
        ? translation.message(err)
        : translation.message;
    return { success: false, status: translation.status, error: message };
  }

  logger.error(fallback.logContext, err);
  return { success: false, status: HTTP_SERVER_ERROR, error: fallback.message };
}
