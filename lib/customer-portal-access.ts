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
