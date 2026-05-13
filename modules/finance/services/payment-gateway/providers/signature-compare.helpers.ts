import crypto from "crypto";

/**
 * Membandingkan signature webhook secara timing-safe.
 * Mencegah timing attack yang memungkinkan attacker menebak signature byte-by-byte
 * dengan mengukur perbedaan response time.
 *
 * @param expected signature/hash yang dihitung dari payload + secret
 * @param actual signature/hash yang diterima dari webhook
 * @returns true kalau identik; false kalau beda panjang atau beda isi
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

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
