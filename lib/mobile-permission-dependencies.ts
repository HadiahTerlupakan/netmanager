/**
 * Mobile Permission Dependencies
 *
 * Mendefinisikan dependency antar permission mobile.
 * Ketika admin mengaktifkan permission tertentu, permission yang dibutuhkan
 * oleh menu tersebut otomatis di-include agar fitur berfungsi penuh.
 *
 * Prinsip: 1 menu = 1 permission yang mengontrol semua fungsi di dalamnya.
 * User tidak boleh mengalami 403 di tengah flow karena butuh permission lain.
 */

/**
 * Map: jika user punya permission KEY, maka permission VALUES otomatis ditambahkan.
 * Format: "resource:action" → ["resource:action", ...]
 */
export const MOBILE_PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  // Work Order butuh akses inventory (ambil barang, kembalikan barang)
  // dan partners (invite partner ke WO)
  "m_work_order:read": ["m_barang:read", "m_partners:read"],
  "m_work_order:update": [
    "m_barang:read",
    "m_barang_keluar:create",
    "m_barang_masuk:create",
  ],
};

/**
 * Expand permission array dengan dependencies.
 * Hanya expand m_* permissions (mobile) — admin permissions tidak terpengaruh.
 */
export function expandMobilePermissionDependencies(
  permissions: string[],
): string[] {
  const expanded = new Set(permissions);
  let changed = true;

  // Iterasi sampai tidak ada perubahan (handle transitive dependencies)
  while (changed) {
    changed = false;
    for (const perm of [...expanded]) {
      const deps = MOBILE_PERMISSION_DEPENDENCIES[perm];
      if (!deps) continue;
      for (const dep of deps) {
        if (!expanded.has(dep)) {
          expanded.add(dep);
          changed = true;
        }
      }
    }
  }

  return Array.from(expanded);
}
