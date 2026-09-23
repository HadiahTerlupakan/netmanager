/** Penutup yang tidak melakukan apa pun; dipasang selama penyimpanan berjalan. */
const TUTUP_DITAHAN = (): void => undefined;

/**
 * Penutup modal yang dipasang ke Batal, tombol X, backdrop, dan Escape.
 *
 * Selama penyimpanan berjalan penutupan ditahan: hook simpan (mis.
 * `useSimpanTarget`, `useUbahKegiatan`) memanggil `onBerhasil` saat
 * permintaannya selesai, dan bila modal sudah ditutup lalu modal lain
 * dibuka, panggilan itu menutup modal yang baru.
 */
export function penutupModalDitahanSaatMenyimpan(
  isMenyimpan: boolean,
  onClose: () => void,
): () => void {
  return isMenyimpan ? TUTUP_DITAHAN : onClose;
}
