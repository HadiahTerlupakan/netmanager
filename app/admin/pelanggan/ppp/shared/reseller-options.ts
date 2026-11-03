/** Status reseller yang boleh menerima pelanggan baru. */
const ASSIGNABLE_RESELLER_STATUS = "ACTIVE";

/** Endpoint daftar reseller untuk form PPP (batas eksplisit; default hanya 20). */
export const RESELLER_OPTIONS_URL = "/api/admin/resellers?limit=200";

type ResellerWithStatus = { readonly id: string; readonly status?: string };

/**
 * Reseller yang bisa dipilih di form pelanggan: hanya yang ACTIVE, karena
 * server menolak penugasan ke reseller nonaktif/ditangguhkan/diakhiri.
 * Reseller yang sudah terpasang di pelanggan tetap ditampilkan supaya form
 * edit tidak mengosongkan pilihan lama secara diam-diam.
 */
export function selectAssignableResellers<T extends ResellerWithStatus>(
  resellers: readonly T[],
  currentResellerId: string | null = null,
): T[] {
  return resellers.filter(
    (reseller) =>
      reseller.status === ASSIGNABLE_RESELLER_STATUS ||
      reseller.id === currentResellerId,
  );
}
