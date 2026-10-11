/**
 * Setup tes integrasi DB nyata.
 *
 * Tidak ada mock di sini — itu intinya. Satu-satunya tugasnya adalah
 * mengarahkan `DATABASE_URL` ke database UJI sebelum `lib/prisma` pertama kali
 * dipakai, supaya tidak ada tes yang bisa menyentuh database dev.
 *
 * Klien di `lib/prisma.ts` dibangun lazy (`createLazyPrismaClient`), jadi
 * penugasan di berkas setup ini terjadi jauh sebelum koneksi pertama dibuat.
 */

const urlUji = process.env.TEST_DATABASE_URL;

if (urlUji) {
  const urlDev = process.env.DATABASE_URL;
  if (urlDev && urlDev === urlUji) {
    throw new Error(
      "TEST_DATABASE_URL sama dengan DATABASE_URL. Tes DB nyata menghapus baris; " +
        "arahkan ke database uji terpisah (lihat ./scripts/setup-test-db.sh).",
    );
  }
  process.env.DATABASE_URL = urlUji;
}
