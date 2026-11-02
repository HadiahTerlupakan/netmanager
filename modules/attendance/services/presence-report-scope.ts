import type { ReportSiteFilter } from "../domain/report-site-filter";
import {
  filterSiteDalamScope,
  resolveAdminScope,
  scopeTanpaData,
  type AdminScope,
} from "./AdminScopeResolver";

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

/** Filter yang diminta lewat query string laporan. */
export interface PresenceReportRequest {
  siteId?: string | null;
  departmentId?: string | null;
}

export interface PresenceReportScope {
  /**
   * Satu site (permintaan yang termasuk lingkup), seluruh site lingkup admin
   * (`{ in }`), atau `undefined` bila tidak dibatasi dan tidak diminta.
   */
  siteId?: ReportSiteFilter;
  departmentId?: string;
  /**
   * Pengguna dibatasi tetapi tidak punya site/departemen, sehingga tidak ada
   * satu baris pun yang boleh ia lihat. Pemanggil mengembalikan hasil kosong —
   * bukan hasil tanpa filter.
   */
  isEmpty: boolean;
}

const EMPTY_SCOPE: PresenceReportScope = { isEmpty: true };

/**
 * Menentukan filter site/departemen laporan kehadiran dari lingkup admin.
 *
 * Dulu hanya site UTAMA admin yang dipakai, sehingga admin ber-`site_only`
 * dengan beberapa site kehilangan data site lainnya. Sekarang seluruh site
 * lingkup dipakai; `siteId` yang diminta hanya boleh MEMPERSEMPIT (permintaan
 * di luar lingkup diabaikan), dan departemen yang diminta diabaikan saat
 * dibatasi per departemen.
 */
export function resolvePresenceReportScope(
  scope: AdminScope,
  request: PresenceReportRequest,
): PresenceReportScope {
  if (scopeTanpaData(scope)) return EMPTY_SCOPE;

  return {
    siteId: filterSiteDalamScope(scope, request.siteId),
    departmentId: scope.departmentId ?? (request.departmentId || undefined),
    isEmpty: false,
  };
}

/** Resolve lingkup admin lalu filter laporan kehadiran untuk pengguna ini. */
export async function resolvePresenceReportScopeForUser(
  user: Parameters<typeof resolveAdminScope>[0],
  request: PresenceReportRequest,
): Promise<PresenceReportScope> {
  const scope = await resolveAdminScope(user, {
    siteOnly: PRESENCE_SCOPE_PERMISSIONS.site_only,
    departmentOnly: PRESENCE_SCOPE_PERMISSIONS.department_only,
  });
  return resolvePresenceReportScope(scope, request);
}
