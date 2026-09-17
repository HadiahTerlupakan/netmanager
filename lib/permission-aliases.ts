/**
 * Permission Aliases Configuration
 *
 * Menyediakan mapping antara permission lama (legacy) ke permission baru (standardized).
 * Ini memungkinkan backward compatibility tanpa harus mengubah database.
 *
 * Format: { 'old_permission': 'new_permission' }
 *
 * Jika user memiliki 'new_permission', maka check untuk 'old_permission' juga akan pass.
 * Jika user memiliki 'old_permission', maka check untuk 'new_permission' juga akan pass.
 */

export const PERMISSION_ALIASES: Record<string, string[]> = {
  // ====== WORKORDERS MODULE ======
  // 'list:*' adalah nama lama, 'workorders:*' adalah nama standar
  "list:read": ["workorders:read"],
  "list:create": ["workorders:create"],
  "list:update": ["workorders:update"],
  "list:delete": ["workorders:delete"],
  "list:cancel": ["workorders:cancel"],
  "list:verify": ["workorders:verify"],
  "list:site_only": ["workorders:site_only"],
  "list:department_only": ["workorders:department_only"],
  "list:approve_request": ["workorders:approve_request"],

  // Reverse mapping untuk workorders
  "workorders:read": ["list:read"],
  "workorders:create": ["list:create"],
  "workorders:update": ["list:update"],
  "workorders:delete": ["list:delete"],
  "workorders:cancel": ["list:cancel"],
  "workorders:verify": ["list:verify"],
  "workorders:site_only": ["list:site_only"],
  "workorders:department_only": ["list:department_only"],
  "workorders:approve_request": ["list:approve_request"],

  // ====== INVENTORY MODULE (Mobile/Admin) ======
  // 'stockmasuk:*' adalah nama lama dari mobile app
  "stockmasuk:create": ["masuk:create"],
  "stockmasuk:read": ["masuk:read"],
  "stockkeluar:create": ["keluar:create"],
  "stockkeluar:read": ["keluar:read"],
  "stockopname:create": ["opname:create"],
  "stockopname:read": ["opname:read"],

  // Reverse mapping
  "masuk:create": ["stockmasuk:create"],
  "masuk:read": ["stockmasuk:read"],
  "keluar:create": ["stockkeluar:create"],
  "keluar:read": ["stockkeluar:read"],
  "opname:create": ["stockopname:create"],
  "opname:read": ["stockopname:read"],

  // 'k_barang:*' adalah nama dari mobile app (karyawan)
  "k_barang:read": ["barang:read", "m_barang:read", "gudang:read"],
  "k_barang:create": ["barang:create", "gudang:create"],
  "k_barang:update": ["barang:update", "gudang:update"],
  "k_barang:delete": ["barang:delete", "gudang:delete"],
  "k_barang:site_only": ["barang:site_only", "gudang:site_only"],

  // Mobile app resources to admin
  "m_barang:read": ["barang:read", "k_barang:read"],

  // Gudang specific aliases
  "gudang:read": ["k_barang:read", "barang:read"],
  "gudang:create": ["k_barang:create", "barang:create"],
  "gudang:update": ["k_barang:update", "barang:update"],
  "gudang:delete": ["k_barang:delete", "barang:delete"],

  // ====== ROLES MODULE ======
  // 'role:*' vs 'roles:*' (singular vs plural)
  "role:read": ["roles:read"],
  "role:create": ["roles:create"],
  "role:update": ["roles:update"],
  "role:delete": ["roles:delete"],

  "roles:read": ["role:read"],
  "roles:create": ["role:create"],
  "roles:update": ["role:update"],
  "roles:delete": ["role:delete"],

  // ====== HOLIDAY MODULE ======
  // UI uses 'holiday:*' (singular), API uses 'holidays:*' (plural)
  "holiday:read": ["holidays:read"],
  "holiday:create": ["holidays:create", "izin:create"],
  "holiday:update": ["holidays:update"],
  "holiday:delete": ["holidays:delete", "izin:delete"],

  "holidays:read": ["holiday:read"],
  "holidays:create": ["holiday:create"],
  "holidays:update": ["holiday:update"],
  "holidays:delete": ["holiday:delete"],

  // ====== LEAVE MODULE ======
  // UI uses 'izin:*', API uses 'leave:*'
  "leave:read": ["izin:read"],
  "leave:create": ["izin:create"],
  "leave:update": ["izin:update"],
  "leave:delete": ["izin:delete"],
  "leave:verify": ["izin:verify"],

  "izin:read": ["leave:read"],
  "izin:create": ["leave:create"],
  "izin:update": ["leave:update"],
  "izin:delete": ["leave:delete"],
  "izin:verify": ["leave:verify"],

  // ====== ASSETS MODULE ======
  // Menu uses 'assets' (plural), API uses 'asset' (singular)
  "asset:read": ["assets:read"],
  "asset:create": ["assets:create"],
  "asset:update": ["assets:update"],
  "asset:delete": ["assets:delete"],
  "asset:site_only": ["assets:site_only"],
  "asset:department_only": ["assets:department_only"],

  "assets:read": ["asset:read"],
  "assets:create": ["asset:create"],
  "assets:update": ["asset:update"],
  "assets:delete": ["asset:delete"],
  "assets:site_only": ["asset:site_only"],
  "assets:department_only": ["asset:department_only"],

  // ====== API SETTINGS EMBEDDED CAPTCHA ======
  "captcha:read": ["api:read"],
  "captcha:update": ["api:update"],

  // ====== ACS MODULE ======
  // By default, if user has pengaturan permissions, they should get acs permissions
  "acs:read": ["pengaturan:read"],
  "acs:create": ["pengaturan:update"],
  "acs:update": ["pengaturan:update"],
  "acs:delete": ["pengaturan:delete"],

  // ====== PPP / PELANGGAN MODULE ======
  // Page uses 'ppp:read' but API uses 'pelanggan:read'
  "ppp:read": ["pelanggan:read"],
  "ppp:create": ["pelanggan:create"],
  "ppp:update": ["pelanggan:update"],
  "ppp:delete": ["pelanggan:delete"],

  "pelanggan:read": ["ppp:read"],
  "pelanggan:create": ["ppp:create"],
  "pelanggan:update": ["ppp:update"],
  "pelanggan:delete": ["ppp:delete"],
};

/**
 * Resolve semua permission yang equivalent dengan permission yang diberikan.
 * Mengembalikan array yang berisi permission asli + semua aliasnya.
 *
 * @param permission - Permission yang akan di-resolve
 * @returns Array of all equivalent permissions including the original
 *
 * @example
 * resolvePermissionAliases('list:read')
 * // Returns: ['list:read', 'workorders:read']
 */
export function resolvePermissionAliases(permission: string): string[] {
  const aliases = PERMISSION_ALIASES[permission] || [];
  return [permission, ...aliases];
}

/**
 * Check apakah user permission set memiliki permission yang diminta,
 * termasuk pengecekan alias.
 *
 * @param userPermissions - Array of permissions yang dimiliki user
 * @param requiredPermission - Permission yang dibutuhkan
 * @returns true jika user memiliki permission (langsung atau via alias)
 */
export function hasPermissionWithAlias(
  userPermissions: string[],
  requiredPermission: string,
): boolean {
  // Check direct match first
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // Check aliases
  const equivalentPermissions = resolvePermissionAliases(requiredPermission);
  return equivalentPermissions.some((p) => userPermissions.includes(p));
}

/**
 * Expand array of required permissions dengan semua alias-nya.
 * Berguna untuk hasAnyPermission checks.
 *
 * @param permissions - Array of permissions to expand
 * @returns Expanded array including all aliases
 */
export function expandPermissionsWithAliases(permissions: string[]): string[] {
  const expanded = new Set<string>();
  for (const p of permissions) {
    for (const eq of resolvePermissionAliases(p)) {
      expanded.add(eq);
    }
  }
  return Array.from(expanded);
}

/**
 * Pengecekan kapabilitas yang benar: wildcard super admin + alias.
 *
 * Banyak service menulis `permissions.includes("users:read")` langsung.
 * Super admin memegang `["*"]`, sehingga `includes()` bernilai false dan super
 * admin justru DITOLAK — penyebab 403 pada `GET /api/admin/users/[id]`.
 * `createHandler` sudah melakukannya dengan benar (`includes(perm) ||
 * includes("*")`); helper ini menyediakan perilaku yang sama untuk lapisan
 * service, lengkap dengan resolusi alias.
 *
 * PENTING — jangan pakai untuk pembatas cakupan (`*:site_only`,
 * `*:department_only`). Di sana `includes()` biasa justru yang benar: super
 * admin tidak boleh cocok, karena kalau cocok ia malah ikut terkurung ke satu
 * site atau departemen.
 */
export function hasCapability(
  userPermissions: string[] | undefined | null,
  requiredPermission: string,
): boolean {
  const permissions = userPermissions ?? [];
  if (permissions.includes("*")) {
    return true;
  }

  return hasPermissionWithAlias(permissions, requiredPermission);
}
