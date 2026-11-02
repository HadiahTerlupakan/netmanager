import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasAnyScopeRestriction } from "@/lib/authorization/scope-restriction-permissions";
import {
  TANPA_BATAS,
  filterSitePrisma,
  siteBolehDiakses,
  tanpaDataSamaSekali,
  type FilterKolomSite,
  type LingkupSite,
} from "@/modules/roles/client";
import { UserLookupService } from "@/modules/users";

/**
 * Lingkup site/departemen untuk pengguna admin pada modul kehadiran.
 *
 * Sebelumnya lingkupnya ditulis `dbUser?.siteId || ""`. String kosong itu
 * falsy, sehingga setiap pemeriksaan `if (scope.siteId)` di hilir melewatinya —
 * dan pengguna yang DIBATASI tetapi belum punya site justru melihat absensi,
 * izin, lembur, serta posisi real-time seluruh tenant. Satu baris itu menjadi
 * akar tujuh kebocoran sekaligus.
 *
 * `tanpaSite`/`tanpaDepartemen` membuat keadaan itu tidak bisa lagi lewat diam-
 * diam: pemanggil wajib menanganinya, dan jawabannya selalu "tidak ada data",
 * bukan "semua data".
 */
export type AdminScope = {
  isSuperAdmin: boolean;
  /**
   * Lingkup site: bila dibatasi, SELURUH site pengguna (userSites, fallback
   * site legacy) — bukan hanya site utama, supaya admin multi-site tidak
   * kehilangan site keduanya.
   */
  lingkupSite: LingkupSite;
  departmentId?: string;
  /** Dibatasi per site, tetapi pengguna tidak punya site sama sekali. */
  tanpaSite: boolean;
  /** Dibatasi per departemen, tetapi pengguna tidak punya departemen. */
  tanpaDepartemen: boolean;
};

/**
 * Pengguna dibatasi tetapi tidak punya site/departemen — tidak ada data yang
 * boleh ia lihat. Pemanggil WAJIB memeriksanya sebelum membangun query.
 */
export function scopeTanpaData(scope: AdminScope): boolean {
  return !scope.isSuperAdmin && (scope.tanpaSite || scope.tanpaDepartemen);
}

/** Apakah site milik data tertentu termasuk lingkup site admin. */
export function siteDalamScope(
  scope: AdminScope,
  siteId: string | null | undefined,
): boolean {
  return scope.isSuperAdmin || siteBolehDiakses(scope.lingkupSite, siteId);
}

/**
 * Filter kolom site untuk daftar admin. Tidak dibatasi → site yang diminta
 * apa adanya. Dibatasi → site yang diminta bila termasuk lingkup admin,
 * selain itu seluruh site lingkup (permintaan di luar lingkup diabaikan).
 * Pemanggil wajib sudah menangani `scopeTanpaData` lebih dulu.
 */
export function filterSiteDalamScope(
  scope: AdminScope,
  requestedSiteId?: string | null,
): FilterKolomSite | undefined {
  if (!scope.lingkupSite.dibatasi) return requestedSiteId || undefined;
  if (requestedSiteId && siteBolehDiakses(scope.lingkupSite, requestedSiteId)) {
    return requestedSiteId;
  }
  return filterSitePrisma(scope.lingkupSite);
}

/**
 * Nama permission pembatas. Layar yang dibuka beberapa permission menerima
 * daftar — lihat `lib/authorization/scope-restriction-permissions.ts`.
 */
type ScopePermissionKey = string | readonly string[];

/** Resolve site/department restriction scope for an admin user. */
export async function resolveAdminScope(
  user: { id: string; role?: string | null; isSuperAdmin?: boolean | null },
  permissionKeys: {
    siteOnly: ScopePermissionKey;
    departmentOnly: ScopePermissionKey;
  },
  userLookup: UserLookupService = new UserLookupService(),
): Promise<AdminScope> {
  if (isSuperAdmin(user)) {
    return {
      isSuperAdmin: true,
      lingkupSite: TANPA_BATAS,
      tanpaSite: false,
      tanpaDepartemen: false,
    };
  }

  const [permissions, assignment] = await Promise.all([
    getUserPermissions(user.id),
    userLookup.findAccessAssignmentById(user.id),
  ]);

  const scope: AdminScope = {
    isSuperAdmin: false,
    lingkupSite: TANPA_BATAS,
    tanpaSite: false,
    tanpaDepartemen: false,
  };

  if (hasAnyScopeRestriction(permissions, toList(permissionKeys.siteOnly))) {
    scope.lingkupSite = { dibatasi: true, siteIds: assignment?.siteIds ?? [] };
    scope.tanpaSite = tanpaDataSamaSekali(scope.lingkupSite);
  }
  if (
    hasAnyScopeRestriction(permissions, toList(permissionKeys.departmentOnly))
  ) {
    scope.departmentId = assignment?.departmentId ?? undefined;
    scope.tanpaDepartemen = !scope.departmentId;
  }

  return scope;
}

function toList(key: ScopePermissionKey): readonly string[] {
  return typeof key === "string" ? [key] : key;
}
