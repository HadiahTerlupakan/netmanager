import { AppError } from "@/lib/errors";

/**
 * Konversi tanda tangan dari data URL kanvas menjadi buffer PNG.
 *
 * Isinya datang dari pihak luar tanpa akun, jadi bentuk dan ukurannya diperiksa
 * sebelum menyentuh penyimpanan.
 */

const PNG_DATA_URL_PREFIX = "data:image/png;base64,";
const MAX_SIGNATURE_BYTES = 300 * 1024;

/** Delapan byte pertama berkas PNG yang sah. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function parseSignatureDataUrl(dataUrl: string): Buffer {
  if (!dataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    throw new AppError(
      "Tanda tangan harus berupa PNG",
      400,
      "INVALID_SIGNATURE",
    );
  }

  const buffer = Buffer.from(
    dataUrl.slice(PNG_DATA_URL_PREFIX.length),
    "base64",
  );

  if (buffer.byteLength === 0) {
    throw new AppError("Tanda tangan kosong", 400, "INVALID_SIGNATURE");
  }

  if (buffer.byteLength > MAX_SIGNATURE_BYTES) {
    throw new AppError("Tanda tangan terlalu besar", 413, "FILE_TOO_LARGE");
  }

  // Awalan data URL bisa dipalsukan; isi berkasnya yang menentukan.
  if (!buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
    throw new AppError("Isi tanda tangan bukan PNG", 400, "INVALID_SIGNATURE");
  }

  return buffer;
}
