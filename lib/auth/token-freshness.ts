/**
 * Menentukan apakah sebuah JWT sudah tidak berlaku lagi.
 *
 * `verifyAuth` — penjaga route `withAuth`/`withPermission` — sebelumnya sama
 * sekali tidak memeriksa `tokenVersion`, berbeda dengan `sessionCallback` dan
 * `verifyMobileToken` yang keduanya memeriksanya. Akibatnya pencabutan status
 * (termasuk pencabutan super admin) tidak pernah berlaku pada jalur itu sampai
 * cookie kedaluwarsa sendiri — praktis membuat akses tidak bisa dicabut.
 *
 * `tokenVersion` hanya dinaikkan saat force-logout dan logout mobile, jadi
 * token pengguna normal selalu sepadan dan tidak terdampak.
 *
 * Bila pembanding tidak tersedia (cache atau DB gagal), fungsi ini memilih
 * TIDAK mencabut: gangguan infrastruktur tidak boleh mengunci semua orang.
 */
export function isTokenRevoked(options: {
  tokenVersion?: number | null;
  storedTokenVersion?: number | null;
  isActive?: boolean | null;
}): boolean {
  if (options.isActive === false) {
    return true;
  }

  if (
    options.storedTokenVersion === undefined ||
    options.storedTokenVersion === null
  ) {
    return false;
  }

  return options.storedTokenVersion > (options.tokenVersion ?? 0);
}
