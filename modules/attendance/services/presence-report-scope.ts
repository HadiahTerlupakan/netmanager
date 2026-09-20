import { hasAnyScopeRestriction } from "@/lib/authorization/scope-restriction-permissions";

/**
 * Laporan kehadiran terbuka bagi pemegang `attendance:read` MAUPUN `report:read`
 * (lihat `app/api/admin/reports/presence/route.ts`). Karena itu pembatasan
 * cakupannya wajib menerima kedua nama: role yang hanya diberi
 * `report:site_only` dulu lolos tanpa pembatasan apa pun.
 */
export const PRESENCE_SCOPE_PERMISSIONS = {
  site_only: ["report:site_only", "attendance:site_only"],
  department_only: ["report:department_only", "attendance:department_only"],
} as const;

export interface PresenceReportScopeInput {
  permissions: string[];
  /** Site dan departemen milik pengguna, diambil dari database. */
  userSiteId?: string | null;
  userDepartmentId?: string | null;
  /** Filter yang diminta lewat query string; diabaikan saat dibatasi. */
  requestedSiteId?: string | null;
  requestedDepartmentId?: string | null;
}

export interface PresenceReportScope {
  siteId: string | null;
  departmentId: string | null;
  /**
   * Pengguna dibatasi tetapi tidak punya site/departemen, sehingga tidak ada
   * satu baris pun yang boleh ia lihat. Pemanggil mengembalikan hasil kosong —
   * bukan hasil tanpa filter.
   */
  isEmpty: boolean;
}

/** Menentukan filter site/departemen untuk laporan kehadiran non-super-admin. */
export function resolvePresenceReportScope(
  input: PresenceReportScopeInput,
): PresenceReportScope {
  const dibatasiSite = hasAnyScopeRestriction(
    input.permissions,
    PRESENCE_SCOPE_PERMISSIONS.site_only,
  );
  const dibatasiDepartemen = hasAnyScopeRestriction(
    input.permissions,
    PRESENCE_SCOPE_PERMISSIONS.department_only,
  );

  if (dibatasiSite && !input.userSiteId) {
    return { siteId: null, departmentId: null, isEmpty: true };
  }
  if (dibatasiDepartemen && !input.userDepartmentId) {
    return { siteId: null, departmentId: null, isEmpty: true };
  }

  return {
    siteId: dibatasiSite ? input.userSiteId! : (input.requestedSiteId ?? null),
    departmentId: dibatasiDepartemen
      ? input.userDepartmentId!
      : (input.requestedDepartmentId ?? null),
    isEmpty: false,
  };
}
