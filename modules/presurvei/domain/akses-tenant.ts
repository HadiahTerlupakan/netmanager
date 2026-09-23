/**
 * Cakupan tenant pemanggil saat membaca baris presurvei acuan.
 *
 * Union bertanda, bukan `string | null`: nilai `undefined` yang lolos karena
 * `strictNullChecks: false` tidak boleh terbaca sebagai "tanpa batas".
 * Diturunkan route dari sesi — super admin lintas tenant, selain itu tenant
 * sesi — lalu ditegakkan repository di `where`.
 */
export type AksesTenantPresurvei =
  | { jenis: "tenant"; tenantId: string }
  | { jenis: "lintas-tenant" };
