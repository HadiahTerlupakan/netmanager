import * as z from "zod";

export const RESELLER_STATUS_VALUES = ["ACTIVE", "INACTIVE"] as const;

/** Status reseller/outlet yang boleh dikirim klien. */
export const resellerStatusSchema = z.enum(RESELLER_STATUS_VALUES);

/**
 * Ubah string kosong atau berisi spasi saja menjadi null.
 *
 * Form admin mengirim `""` untuk kolom opsional yang dikosongkan. Tanpa
 * normalisasi ini `z.email()` menolaknya sehingga reseller tanpa email tidak
 * bisa dibuat maupun diedit, dan kolom teks lain tersimpan sebagai `""`.
 */
export function normalizeBlankToNull(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Ubah string kosong/spasi saja menjadi undefined agar default/opsional berlaku.
 *
 * Dipakai untuk query string (`?status=`, `?limit=`) dan tanggal opsional:
 * URLSearchParams dari input kosong mengirim `""`, yang tanpa ini ditolak
 * (`z.coerce.number()` menjadi 0, `z.coerce.date()` menjadi Invalid Date).
 */
export function normalizeBlankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value.trim() === "" ? undefined : value;
}

/** Kolom teks opsional: kosong menjadi null, selain itu di-trim. */
export const optionalTextSchema = z.preprocess(
  normalizeBlankToNull,
  z.string().nullable().optional(),
);

/** Email opsional: kosong menjadi null, selain itu wajib format email. */
export const optionalEmailSchema = z.preprocess(
  normalizeBlankToNull,
  z.email().nullable().optional(),
);
