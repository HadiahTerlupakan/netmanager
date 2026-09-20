/**
 * Sebuah layar sering dijaga permission resource-nya sendiri sekaligus resource
 * data di baliknya — dashboard Work Order dijaga `work_order_dashboard:read`
 * tapi menampilkan data `workorders`; laporan kehadiran menerima `report:read`
 * maupun `attendance:read`.
 *
 * Pembatasan cakupannya harus menerima SEMUA nama yang membuka layar itu.
 * Membaca hanya salah satunya membuat toggle yang dinyalakan di matriks tidak
 * menggigit — persis bug yang ditemukan 2026-09-21 pada dashboard Work Order,
 * yang hanya membaca `workorders:site_only` sehingga role ber-
 * `work_order_dashboard:site_only` melihat seluruh site.
 *
 * Nama permission selalu ditulis sebagai literal utuh di titik panggil, bukan
 * dirakit dari template, supaya tetap bisa ditemukan lewat pencarian teks —
 * termasuk oleh `tests/architecture/site-restriction-capability-catalog.test.ts`.
 */
export function hasAnyScopeRestriction(
  permissions: string[] | undefined,
  acceptedPermissions: readonly string[],
): boolean {
  if (!permissions?.length) return false;
  return permissions.some((permission) =>
    acceptedPermissions.includes(permission),
  );
}
