/**
 * Data FCM wajib berupa `Record<string, string>`: buang nilai kosong, ubah
 * angka/boolean jadi teks, dan objek jadi JSON.
 */
export function toFcmData(
  data: Record<string, unknown> = {},
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [key, toFcmDataValue(value)]),
  );
}

function toFcmDataValue(value: unknown): string {
  if (typeof value === "string") return value;
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
