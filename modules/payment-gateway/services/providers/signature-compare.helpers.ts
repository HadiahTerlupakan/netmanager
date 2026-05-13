import crypto from "crypto";

/**
 * Membandingkan signature webhook secara timing-safe.
 * Mencegah timing attack yang memungkinkan attacker menebak signature
 * byte-by-byte dengan mengukur perbedaan response time.
 *
 * Implementasi: SHA-256 kedua input lalu compare buffer hasil hash. Ini
 * memastikan dua input dengan panjang berbeda tetap dibandingkan dengan
 * waktu konstan (32 byte hash) — length mismatch tidak bocor lewat
 * timing side-channel.
 *
 * @param expected signature/hash yang dihitung dari payload + secret
 * @param actual signature/hash yang diterima dari webhook
 * @returns true kalau identik; false kalau salah satu invalid atau berbeda
 */
export function timingSafeCompare(
  expected: string | null | undefined,
  actual: string | null | undefined,
): boolean {
  if (typeof expected !== "string" || typeof actual !== "string") {
    return false;
  }
  if (expected.length === 0 || actual.length === 0) {
    return false;
  }

  // Normalisasi via SHA-256 supaya kedua buffer selalu 32 byte —
  // timingSafeEqual aman dipanggil dan length tidak bocor.
  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  const actualHash = crypto.createHash("sha256").update(actual).digest();

  return crypto.timingSafeEqual(expectedHash, actualHash);
}
