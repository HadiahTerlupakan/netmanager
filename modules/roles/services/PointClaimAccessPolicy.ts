/**
 * Keputusan akses claim poin canvasing dari permission pemanggil.
 *
 * Satu-satunya tempat aturan permission claim poin; route service marketing
 * hanya mengonsumsi hasilnya. Super admin selalu lolos.
 */

import { hasMobilePermission } from "@/lib/mobile-auth";
import { hasCapability } from "@/lib/permission-aliases";
import { CANVASING_CASHOUT_PERMISSION } from "../domain/izin-canvasing";

/** Bagian konteks pemanggil yang dibutuhkan keputusan akses claim poin. */
export interface PointClaimAccessInput {
  permissions: string[];
  isSuperAdmin: boolean;
}

/** Apakah pemanggil boleh membaca seluruh claim poin (bukan hanya miliknya). */
export function canReadAllPointClaims(input: PointClaimAccessInput): boolean {
  return (
    input.isSuperAdmin ||
    hasCapability(input.permissions, "canvasing:read") ||
    hasCapability(input.permissions, "point_claims:read")
  );
}

/** Apakah pemanggil boleh menyetujui/menolak claim poin. */
export function canManagePointClaim(input: PointClaimAccessInput): boolean {
  return (
    input.isSuperAdmin ||
    hasCapability(input.permissions, "point_claims:update") ||
    hasCapability(input.permissions, "canvasing:update") ||
    hasCapability(input.permissions, "marketing:update")
  );
}

/** Apakah pemanggil boleh menghapus claim poin. */
export function canDeletePointClaim(input: PointClaimAccessInput): boolean {
  return (
    input.isSuperAdmin ||
    hasCapability(input.permissions, "point_claims:delete")
  );
}

/** Apakah pemanggil memegang izin opt-in cashout canvasing (non-sales). */
export function hasCashoutPermission(input: PointClaimAccessInput): boolean {
  return (
    input.isSuperAdmin ||
    hasMobilePermission(input.permissions, CANVASING_CASHOUT_PERMISSION)
  );
}
