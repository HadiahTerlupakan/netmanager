/**
 * Model RADIUS yang DIKECUALIKAN dari isolasi tenant otomatis.
 *
 * Perhatikan arah maknanya: `withTenantIsolation()` menerima daftar model yang
 * ia LEWATI. Versi sebelumnya meneruskan seluruh 9 tabel radius lewat variabel
 * bernama `tenantScopedModels` — nama yang menyatakan kebalikan dari maksud
 * parameter — sehingga isolasi otomatis tidak berlaku sama sekali, padahal
 * schema-nya dirancang multi-tenant (kolom `tenantId` lengkap dengan index dan
 * unique constraint).
 *
 * `radpostauth` sengaja tetap dikecualikan, diverifikasi di database produksi:
 * 54.749 baris dan SEMUANYA ber-`tenantId` NULL. FreeRADIUS menulis tabel ini
 * langsung dan — berbeda dari `radacct` yang punya trigger
 * `trg_radacct_set_tenantid` (BEFORE INSERT/UPDATE) — tabel ini tidak punya
 * trigger pengisi tenant. Mengisolasinya akan menyembunyikan seluruh log
 * autentikasi dari aplikasi.
 *
 * Bila kelak `radpostauth` diberi trigger serupa, hapus dari daftar ini.
 */
export const RADIUS_ISOLATION_EXEMPT_MODELS = ["radpostauth"];
