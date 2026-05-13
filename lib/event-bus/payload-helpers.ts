/**
 * Helper guard untuk validasi payload event sebelum dipakai handler.
 * Throw eksplisit supaya BullMQ tidak meneruskan job dengan data malformed.
 */
export function requirePayloadString(
  value: unknown,
  field: string,
  source = "EventHandler",
): string {
  if (typeof value !== "string" || !value) {
    throw new Error(
      `[${source}] Payload field "${field}" harus string non-kosong, dapat ${typeof value}`,
    );
  }
  return value;
}
