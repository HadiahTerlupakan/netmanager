import { apiError, ErrorCodes } from "@/lib/api-response";

const ERROR_CODE_BY_STATUS: Record<number, string> = {
  400: ErrorCodes.VALIDATION_ERROR,
  403: ErrorCodes.FORBIDDEN,
  404: ErrorCodes.NOT_FOUND,
  409: ErrorCodes.CONFLICT,
};

/**
 * Kirim kegagalan dari route service inventory apa adanya: status dan pesan
 * sudah disusun service untuk dibaca staf. Sengaja tidak memakai
 * `ApiErrors.notFound`, yang menambahkan " tidak ditemukan" ke pesan.
 */
export function inventoryFailureResponse(result: {
  status: number;
  error: string;
}) {
  return apiError(
    result.error,
    ERROR_CODE_BY_STATUS[result.status] ?? ErrorCodes.INTERNAL_ERROR,
    { status: result.status },
  );
}

/**
 * Pesan untuk gangguan yang terjadi di luar transaksi stok, misalnya setelah
 * catatan tersimpan. Staf diminta memeriksa daftar dulu supaya tidak mencatat
 * barang yang sama dua kali.
 */
export const INVENTORY_UNEXPECTED_ERROR_MESSAGE =
  "Ada gangguan di server. Periksa daftarnya dulu: kalau catatan Anda sudah muncul, jangan disimpan lagi. Kalau belum muncul, coba simpan sekali lagi. Kalau tetap gagal, laporkan ke admin.";

/** Pesan saat isi permintaan tidak bisa dibaca sama sekali. */
export const INVENTORY_UNREADABLE_BODY_MESSAGE =
  "Data yang dikirim tidak terbaca. Muat ulang halaman, lalu isi formnya lagi.";
