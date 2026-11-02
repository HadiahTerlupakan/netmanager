import { isSuperAdmin } from "@/lib/auth/super-admin";
import { resolveAllowedSiteIds } from "@/lib/authorization/allowed-site-ids";
import { hasAnyScopeRestriction } from "@/lib/authorization/scope-restriction-permissions";

/**
 * Layar Pembayaran Manual dibuka lewat `manual_payments:*`, tetapi datanya
 * pembayaran keuangan. Dulu daftar membaca `manual_payments:site_only`
 * sementara verifikasi & pembatalan membaca `finance:site_only` — role yang
 * hanya diberi salah satu toggle tetap bisa bertindak di luar site-nya pada
 * separuh layar. Ketiga titik kini menerima kedua nama.
 */
export const MANUAL_PAYMENT_SITE_ONLY_PERMISSIONS = [
  "manual_payments:site_only",
  "finance:site_only",
] as const;

interface ManualPaymentScopeUser {
  role?: string | null;
  isSuperAdmin?: boolean;
  siteId?: string | null;
  siteIds?: string[];
}

/** Apakah pengguna dibatasi per site pada layar Pembayaran Manual. */
export function isManualPaymentSiteRestricted(
  user: ManualPaymentScopeUser,
  permissions: string[],
): boolean {
  if (isSuperAdmin(user)) return false;
  return hasAnyScopeRestriction(
    permissions,
    MANUAL_PAYMENT_SITE_ONLY_PERMISSIONS,
  );
}

/**
 * Site yang boleh disentuh saat verifikasi/pembatalan, atau `undefined` bila
 * tidak dibatasi. Daftar kosong berarti dibatasi tanpa site — pemanggil
 * menolak, bukan membuka semua.
 */
export function resolveManualPaymentAllowedSiteIds(
  user: ManualPaymentScopeUser,
  permissions: string[],
): string[] | undefined {
  if (!isManualPaymentSiteRestricted(user, permissions)) return undefined;
  return resolveAllowedSiteIds(user);
}
