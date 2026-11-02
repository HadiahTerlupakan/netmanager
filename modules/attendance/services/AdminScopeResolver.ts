import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasAnyScopeRestriction } from "@/lib/authorization/scope-restriction-permissions";
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
  siteId?: string;
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
    return { isSuperAdmin: true, tanpaSite: false, tanpaDepartemen: false };
  }

  const [permissions, dbUser] = await Promise.all([
    getUserPermissions(user.id),
    userLookup.findById(user.id),
  ]);

  const scope: AdminScope = {
    isSuperAdmin: false,
    tanpaSite: false,
    tanpaDepartemen: false,
  };

  if (hasAnyScopeRestriction(permissions, toList(permissionKeys.siteOnly))) {
    scope.siteId = dbUser?.siteId ?? undefined;
    scope.tanpaSite = !scope.siteId;
  }
  if (
    hasAnyScopeRestriction(permissions, toList(permissionKeys.departmentOnly))
  ) {
    scope.departmentId = dbUser?.departmentId ?? undefined;
    scope.tanpaDepartemen = !scope.departmentId;
  }

  return scope;
}

function toList(key: ScopePermissionKey): readonly string[] {
  return typeof key === "string" ? [key] : key;
}
