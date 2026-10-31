import { isSuperAdmin } from "@/lib/auth/super-admin";

/** Bagian sesi yang menentukan klaim token Firebase realtime. */
export interface RealtimeClaimsSource {
  role?: string | null;
  tenantId?: string | null;
  departmentId?: string | null;
  siteId?: string | null;
  primarySiteId?: string | null;
  accessAdminPanel?: boolean;
  accessEmployeePanel?: boolean;
  isSuperAdmin?: boolean;
}

/**
 * Klaim token custom Firebase untuk realtime web, yang dibaca aturan
 * Firestore. Satu sumber untuk route pembuat token dan untuk klien yang
 * memeriksa apakah token yang sedang dipakai masih sesuai dengan sesinya.
 */
export function buildRealtimeClaims(user: RealtimeClaimsSource) {
  const isUserSuperAdmin = isSuperAdmin(user);
  const primarySiteId = user.primarySiteId ?? user.siteId ?? null;
  return {
    role: isUserSuperAdmin ? "SUPER_ADMIN" : (user.role ?? "USER"),
    tenantId: user.tenantId ?? null,
    departmentId: user.departmentId ?? null,
    siteId: primarySiteId,
    primarySiteId,
    accessAdminPanel: user.accessAdminPanel ?? false,
    accessEmployeePanel: user.accessEmployeePanel ?? false,
    isSuperAdmin: isUserSuperAdmin,
  };
}

/** Apakah token yang sedang dipakai membawa klaim yang akan dicetak untuk sesi ini. */
export function hasCurrentRealtimeClaims(
  tokenClaims: Record<string, unknown>,
  user: RealtimeClaimsSource,
): boolean {
  return Object.entries(buildRealtimeClaims(user)).every(
    ([name, value]) => (tokenClaims[name] ?? null) === value,
  );
}
