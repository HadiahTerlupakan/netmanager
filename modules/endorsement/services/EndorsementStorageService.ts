import { createHash } from "crypto";
import { AppError } from "@/lib/errors";
import {
  deleteFromR2,
  downloadFromR2,
  isR2Enabled,
  uploadToR2,
} from "@/lib/utils/r2-client";

/**
 * Penyimpanan berkas surat pengesahan.
 *
 * Modul ini mewajibkan R2 dan sengaja tidak punya jalur cadangan ke disk lokal:
 * aplikasi berjalan dengan dua replika, sehingga berkas yang ditulis ke disk
 * satu pod tidak terlihat oleh pod lain — surat bisa tampil di satu permintaan
 * dan hilang di permintaan berikutnya. Gagal terang lebih baik daripada berkas
 * yang kadang ada kadang tidak.
 *
 * Kunci objek tidak pernah dibagikan sebagai URL publik. Dokumen rahasia hanya
 * mengalir lewat rute server yang memeriksa token, karena URL publik R2 bocor
 * permanen dan tidak bisa dicabut.
 */

const ROOT_PREFIX = "pengesahan";
const PDF_CONTENT_TYPE = "application/pdf";
const SIGNATURE_CONTENT_TYPE = "image/png";

/** Batas ukuran PDF, mengikuti batas unggah besar yang sudah ada di proxy. */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

function assertR2Configured(enabled: boolean) {
  if (enabled) return;

  throw new AppError(
    "Penyimpanan berkas (R2) belum aktif. Surat pengesahan menyimpan dokumen rahasia sehingga tidak bisa memakai disk lokal.",
    503,
    "STORAGE_UNAVAILABLE",
  );
}

function buildTenantPrefix(tenantId: string | null): string {
  return `${ROOT_PREFIX}/${tenantId ?? "global"}`;
}

export function buildSourceKey(
  tenantId: string | null,
  endorsementId: string,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);

  return `${buildTenantPrefix(tenantId)}/${endorsementId}/sumber-${safeName}`;
}

export function buildSignatureKey(
  tenantId: string | null,
  endorsementId: string,
  signerId: string,
): string {
  return `${buildTenantPrefix(tenantId)}/${endorsementId}/ttd-${signerId}.png`;
}

export function buildSignedKey(
  tenantId: string | null,
  endorsementId: string,
): string {
  return `${buildTenantPrefix(tenantId)}/${endorsementId}/pengesahan.pdf`;
}

/** sha256 berkas, dicetak di halaman pengesahan sebagai bukti dokumen utuh. */
export function hashFile(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export class EndorsementStorageService {
  /** Simpan PDF asal; mengembalikan kunci objek dan sidik jarinya. */
  async saveSourcePdf(input: {
    tenantId: string | null;
    endorsementId: string;
    fileName: string;
    buffer: Buffer;
  }): Promise<{ key: string; hash: string }> {
    assertR2Configured(await isR2Enabled());

    if (input.buffer.byteLength > MAX_PDF_BYTES) {
      throw new AppError("Ukuran PDF melebihi 10 MB", 413, "FILE_TOO_LARGE");
    }

    const key = buildSourceKey(
      input.tenantId,
      input.endorsementId,
      input.fileName,
    );
    await uploadToR2(input.buffer, key, PDF_CONTENT_TYPE);

    return { key, hash: hashFile(input.buffer) };
  }

  /** Simpan gambar tanda tangan seorang penanda tangan. */
  async saveSignature(input: {
    tenantId: string | null;
    endorsementId: string;
    signerId: string;
    buffer: Buffer;
  }): Promise<string> {
    assertR2Configured(await isR2Enabled());

    const key = buildSignatureKey(
      input.tenantId,
      input.endorsementId,
      input.signerId,
    );
    await uploadToR2(input.buffer, key, SIGNATURE_CONTENT_TYPE);

    return key;
  }

  /** Simpan PDF gabungan hasil pengesahan. */
  async saveSignedPdf(input: {
    tenantId: string | null;
    endorsementId: string;
    buffer: Buffer;
  }): Promise<{ key: string; hash: string }> {
    assertR2Configured(await isR2Enabled());

    const key = buildSignedKey(input.tenantId, input.endorsementId);
    await uploadToR2(input.buffer, key, PDF_CONTENT_TYPE);

    return { key, hash: hashFile(input.buffer) };
  }

  /** Ambil isi berkas untuk disajikan lewat rute server. */
  async read(key: string): Promise<Buffer> {
    const buffer = await downloadFromR2(key);
    if (!buffer) {
      throw new AppError("Berkas tidak ditemukan", 404, "FILE_NOT_FOUND");
    }

    return buffer;
  }

  /** Hapus seluruh berkas milik satu surat. */
  async removeAll(keys: Array<string | null | undefined>): Promise<void> {
    for (const key of keys) {
      if (key) await deleteFromR2(key);
    }
  }
}
