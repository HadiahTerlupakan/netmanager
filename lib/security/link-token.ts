import { createHash, randomBytes } from "crypto";

/**
 * Token link tanpa login (tanda tangan pengesahan, daftar belanja restock).
 *
 * Token adalah satu-satunya bukti kepemilikan link: pemegangnya tidak punya
 * akun. Karena itu entropinya 256-bit dan yang disimpan di database hanya
 * sidik jarinya (sha256) — bocornya isi tabel tidak menghasilkan link yang
 * bisa dipakai.
 */

const TOKEN_BYTE_LENGTH = 32;

/** Panjang token base64url dari 32 byte, dipakai untuk validasi bentuk. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Buat token acak 256-bit dalam base64url (43 karakter). */
export function generateLinkToken(): string {
  return randomBytes(TOKEN_BYTE_LENGTH).toString("base64url");
}

/** Sidik jari sha256 (hex) token; hanya ini yang disimpan dan dicari. */
export function hashLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Apakah string ini berbentuk token yang mungkin kita terbitkan? */
export function isValidLinkTokenFormat(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}
