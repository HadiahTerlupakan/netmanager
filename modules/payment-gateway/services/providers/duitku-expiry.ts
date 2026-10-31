/**
 * Masa berlaku transaksi per kanal Duitku, dalam menit (docs.duitku.com/api/id,
 * bagian "Expiry Period", dibaca 2026-10-31). Nilai yang sama dikirim sebagai
 * `expiryPeriod` dan disimpan sebagai `expiresAt`, sehingga hitung mundur di
 * portal dan aplikasi berakhir tepat saat Duitku menutup VA/QR-nya.
 */
const DEFAULT_EXPIRY_MINUTES = 24 * 60;

// Permintaan di atas batas ini tidak dipakai Duitku.
const MAX_EXPIRY_MINUTES: Record<string, number> = {
  SA: 60, // ShopeePay Apps
  SP: 60, // QRIS ShopeePay
  SQ: 60, // QRIS Nusapay
  NQ: 24 * 60, // QRIS Nobu
  DA: 24 * 60, // DANA
  OV: 24 * 60, // OVO
};

// Kanal yang selalu memakai masa berlaku bawaannya dan mengabaikan
// `expiryPeriod` dari merchant.
const FIXED_EXPIRY_MINUTES: Record<string, number> = {
  LA: 24, // LinkAja Apps (biaya persentase)
  LF: 24, // LinkAja Apps (biaya tetap)
  VC: 30, // Kartu kredit
};

/** Menit masa berlaku yang akan dipakai Duitku untuk kanal ini. */
export function resolveDuitkuExpiryMinutes(
  paymentMethod: string,
  requestedMinutes = DEFAULT_EXPIRY_MINUTES,
): number {
  const fixed = FIXED_EXPIRY_MINUTES[paymentMethod];
  if (fixed) return fixed;

  const max = MAX_EXPIRY_MINUTES[paymentMethod];
  return max ? Math.min(requestedMinutes, max) : requestedMinutes;
}
