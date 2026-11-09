import { AppError } from "@/lib/errors";
import {
  decodePngSignatureDataUrl,
  PNG_DATA_URL_PREFIX,
} from "@/lib/signature/png-signature";

/**
 * Konversi tanda tangan dari data URL kanvas menjadi buffer PNG.
 *
 * Isinya datang dari pihak luar tanpa akun, jadi bentuk dan ukurannya diperiksa
 * sebelum menyentuh penyimpanan. Pemeriksaannya dipakai bersama di
 * `lib/signature/png-signature`; di sini hanya pemetaan ke error aplikasi.
 */

const MAX_SIGNATURE_BYTES = 300 * 1024;

export function parseSignatureDataUrl(dataUrl: string): Buffer {
  if (!dataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    throw new AppError(
      "Tanda tangan harus berupa PNG",
      400,
      "INVALID_SIGNATURE",
    );
  }

  const decoded = decodePngSignatureDataUrl(dataUrl, {
    maxBytes: MAX_SIGNATURE_BYTES,
  });
  if (decoded.ok === true) return decoded.buffer;

  switch (decoded.reason) {
    case "EMPTY":
      throw new AppError("Tanda tangan kosong", 400, "INVALID_SIGNATURE");
    case "TOO_LARGE":
      throw new AppError("Tanda tangan terlalu besar", 413, "FILE_TOO_LARGE");
    default:
      throw new AppError(
        "Isi tanda tangan bukan PNG",
        400,
        "INVALID_SIGNATURE",
      );
  }
}
