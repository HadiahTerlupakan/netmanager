/**
 * Setup tes integrasi DB nyata.
 *
 * Tidak ada mock di sini — itu intinya. Satu-satunya tugasnya adalah
 * mengarahkan `DATABASE_URL` (dan `DATABASE_URL_BILLING`) ke database UJI
 * sebelum klien Prisma pertama kali dipakai, supaya tidak ada tes yang bisa
 * menyentuh database dev.
 *
 * Klien di `lib/prisma.ts` dibangun lazy (`createLazyPrismaClient`), jadi
 * penugasan di berkas setup ini terjadi jauh sebelum koneksi pertama dibuat.
 */

/** Arahkan `variabelDev` ke database uji, menolak bila keduanya sama. */
function arahkanKeDbUji(variabelUji: string, variabelDev: string) {
  const urlUji = process.env[variabelUji];
  if (!urlUji) return;

  const urlDev = process.env[variabelDev];
  if (urlDev && urlDev === urlUji) {
    throw new Error(
      `${variabelUji} sama dengan ${variabelDev}. Tes DB nyata menghapus baris; ` +
        "arahkan ke database uji terpisah (lihat ./scripts/setup-test-db.sh).",
    );
  }
  process.env[variabelDev] = urlUji;
}

arahkanKeDbUji("TEST_DATABASE_URL", "DATABASE_URL");
arahkanKeDbUji("TEST_DATABASE_URL_BILLING", "DATABASE_URL_BILLING");

// Tanpa database billing uji, `dotenv` akan mengisi DATABASE_URL_BILLING dari
// .env, yaitu database billing dev. Alamat yang tidak bisa dihubungi membuat
// akses billing yang tak sengaja gagal keras alih-alih menyentuh data dev.
if (!process.env.TEST_DATABASE_URL_BILLING) {
  process.env.DATABASE_URL_BILLING =
    "postgresql://tanpa-db-billing-uji.invalid:5432/billing";
}
