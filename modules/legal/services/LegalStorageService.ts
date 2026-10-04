import { createHash } from "crypto";
import { AppError } from "@/lib/errors";
import {
  deleteFromR2,
  downloadFromR2,
  isR2Enabled,
  uploadToR2,
} from "@/lib/utils/r2-client";
import type { LegalFileFields } from "../domain/ports/ILegalRepository";

/**
 * Penyimpanan berkas dokumen legal di R2.
 *
 * Sengaja tanpa jalur cadangan ke disk lokal: aplikasi berjalan dengan beberapa
 * replika, dan berkas legal bersifat rahasia — URL publik R2 tidak pernah
 * dibagikan; berkas hanya mengalir lewat rute server yang memeriksa izin.
 */

const ROOT_PREFIX = "legal";
export const MAX_LEGAL_FILE_BYTES = 20 * 1024 * 1024;
export const ALLOWED_LEGAL_CONTENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

function assertFileAcceptable(buffer: Buffer, contentType: string): void {
  if (!(ALLOWED_LEGAL_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    throw new AppError("Berkas harus PDF, PNG, atau JPG", 400, "INVALID_FILE");
  }
  if (buffer.byteLength > MAX_LEGAL_FILE_BYTES) {
    throw new AppError("Ukuran berkas melebihi 20 MB", 413, "FILE_TOO_LARGE");
  }
}

export interface LegalUpload {
  buffer: Buffer;
  fileName: string;
  contentType: string;
}

export class LegalStorageService {
  /** Simpan berkas dokumen; mengembalikan kunci objek, nama, sidik jari, dan jenisnya. */
  async save(input: {
    tenantId: string | null;
    documentId: string;
    upload: LegalUpload;
  }): Promise<LegalFileFields> {
    if (!(await isR2Enabled())) {
      throw new AppError(
        "Penyimpanan berkas (R2) belum aktif. Dokumen legal bersifat rahasia sehingga tidak disimpan di disk lokal.",
        503,
        "STORAGE_UNAVAILABLE",
      );
    }
    const { buffer, fileName, contentType } = input.upload;
    assertFileAcceptable(buffer, contentType);

    const key = `${ROOT_PREFIX}/${input.tenantId ?? "global"}/${input.documentId}/${sanitizeFileName(fileName)}`;
    await uploadToR2(buffer, key, contentType);

    return {
      fileKey: key,
      fileName,
      fileHash: createHash("sha256").update(buffer).digest("hex"),
      fileContentType: contentType,
    };
  }

  /** Ambil isi berkas untuk disajikan lewat rute server. */
  async read(key: string): Promise<Buffer> {
    const buffer = await downloadFromR2(key);
    if (!buffer) {
      throw new AppError("Berkas tidak ditemukan", 404, "FILE_NOT_FOUND");
    }

    return buffer;
  }

  /** Hapus berkas yang terlanjur diunggah ketika penyimpanan datanya gagal. */
  async remove(key: string): Promise<void> {
    await deleteFromR2(key);
  }
}
