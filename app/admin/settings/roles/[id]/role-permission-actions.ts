/**
 * Pemisahan aksi permission: kemampuan vs pembatasan.
 *
 * `site_only` dan `department_only` bukan kemampuan — keduanya MENGURANGI
 * jangkauan data role. Karena itu tombol "Semua" pada satu resource tidak boleh
 * ikut menyalakannya: menekan tombol yang terbaca "beri semua akses" seharusnya
 * tidak mengunci role ke satu site.
 *
 * Kejadian nyata (2026-09-20): role `admin` memegang 27 permission `site_only`
 * sehingga daftar site menyusut ke satu site milik penggunanya, padahal
 * pemiliknya merasa tidak pernah membatasi apa pun.
 */
export const SCOPE_ACTIONS = ["site_only", "department_only"] as const;

export function isScopeAction(action: string): boolean {
  return (SCOPE_ACTIONS as readonly string[]).includes(action);
}

/** Aksi yang menambah kemampuan; aman dipilih massal lewat tombol "Semua". */
export function getCapabilityActions(availableActions: string[]): string[] {
  return availableActions.filter((action) => !isScopeAction(action));
}

/** Aksi yang membatasi jangkauan data; selalu dipilih satu per satu. */
export function getScopeActions(availableActions: string[]): string[] {
  return availableActions.filter(isScopeAction);
}
