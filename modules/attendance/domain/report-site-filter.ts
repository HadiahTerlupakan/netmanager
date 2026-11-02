/**
 * Filter site pegawai pada laporan kehadiran: satu site, atau `{ in }` untuk
 * seluruh site lingkup admin multi-site. Bentuknya sengaja sama dengan klausa
 * Prisma kolom `siteId`, sehingga repository dapat meneruskannya apa adanya.
 *
 * Sebelumnya laporan hanya menerima satu `siteId` — site UTAMA admin — sehingga
 * admin ber-`site_only` dengan dua site kehilangan seluruh data site keduanya.
 *
 * Bentuknya sama dengan `FilterKolomSite` di `modules/roles`; domain tidak
 * boleh mengimpor module lain, jadi kesamaannya dijaga
 * `tests/modules/attendance/report-site-filter-type.test.ts`.
 */
export type ReportSiteFilter = string | { in: string[] };
