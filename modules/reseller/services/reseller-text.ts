/**
 * Trim teks opsional; string kosong menjadi null, `undefined` tetap
 * `undefined` supaya kolom yang tidak dikirim pada update tidak ikut ditimpa.
 */
export function trimOptionalText(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  return value?.trim() || null;
}
