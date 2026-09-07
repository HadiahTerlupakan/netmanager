import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * Token short link untuk penanda tangan.
 *
 * Token adalah satu-satunya bukti kepemilikan link: pihak luar tidak punya
 * akun. Karena itu entropinya dibuat 256-bit dan yang disimpan di database
 * hanya sidik jarinya — bocornya isi tabel tidak menghasilkan link yang bisa
 * dipakai menandatangani.
 */

const TOKEN_BYTE_LENGTH = 32;

/** Panjang token base64url dari 32 byte, dipakai untuk validasi bentuk. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateSignerToken(): string {
  return randomBytes(TOKEN_BYTE_LENGTH).toString("base64url");
}

export function hashSignerToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Apakah string ini berbentuk token yang mungkin kita terbitkan? */
export function isValidTokenFormat(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

/**
 * Bandingkan dua hash tanpa membocorkan posisi perbedaan lewat waktu eksekusi.
 *
 * Pencarian di database memakai indeks unik pada hash, tetapi perbandingan
 * tambahan tetap dilakukan konstan-waktu agar tidak menjadi oracle.
 */
export function isSameTokenHash(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) return false;

  return timingSafeEqual(leftBuffer, rightBuffer);
}
