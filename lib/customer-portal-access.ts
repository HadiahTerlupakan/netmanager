/**
 * Status pelanggan yang boleh memakai portal dan aplikasi pelanggan.
 *
 * Dulu hanya AKTIF, sehingga pelanggan yang diisolir atau dinonaktifkan karena
 * telat bayar tidak bisa login untuk melihat dan membayar tagihannya sendiri,
 * padahal halaman isolir meminta mereka membayar. Hanya DISMANTLE (berhenti
 * berlangganan) yang ditutup.
 */
export function canUseCustomerPortal(status: string | null | undefined) {
  return Boolean(status) && status !== "DISMANTLE";
}

/**
 * Pelanggan hanya bisa mengajukan upgrade paket saat layanannya AKTIF.
 * Cerminan aturan `CustomerPackageUpgradeService` di server, dipakai portal
 * untuk menutup tombol upgrade sebelum pelanggan membentur penolakan server.
 */
export function canRequestPackageUpgrade(status: string | null | undefined) {
  return status === "AKTIF";
}

/** Alasan yang ditampilkan di samping tombol upgrade yang dinonaktifkan. */
export const PACKAGE_UPGRADE_UNAVAILABLE_MESSAGE =
  "Upgrade paket hanya bisa diajukan saat layanan aktif. Hubungi CS bila perlu bantuan.";
