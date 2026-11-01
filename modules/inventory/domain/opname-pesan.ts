/**
 * Pesan stock opname yang dibaca petugas gudang di layar. Tiap pesan menyebut
 * apa yang terjadi dan langkah berikutnya, dengan kata sehari-hari — tanpa
 * istilah teknis seperti ID, tenant, atau validasi.
 */
export const OPNAME_PESAN = {
  tanpaIzinLihat:
    "Akun Anda tidak punya izin melihat stock opname. Minta admin menambahkan izin itu ke peran Anda.",
  tanpaIzinCatat:
    "Akun Anda tidak punya izin mencatat stock opname. Minta admin menambahkan izin itu ke peran Anda.",
  tanpaIzinUbah:
    "Akun Anda tidak punya izin mengubah stock opname. Minta admin menambahkan izin itu ke peran Anda.",
  tanpaIzinHapus:
    "Akun Anda tidak punya izin menghapus stock opname. Minta admin menambahkan izin itu ke peran Anda.",
  akunTanpaPerusahaan:
    "Akun Anda belum terhubung ke perusahaan mana pun, jadi belum bisa membuka stock opname. Minta admin memeriksa akun Anda.",
  gudangBelumDipilih: "Gudang belum dipilih. Pilih gudang dulu.",
  catatanTidakLengkap:
    "Catatan opname yang dibuka tidak lengkap. Kembali ke daftar opname lalu buka lagi.",
  dataTidakTerbaca:
    "Data opname tidak terbaca. Muat ulang halaman lalu coba lagi.",
  catatanTidakDitemukan:
    "Catatan opname ini tidak ditemukan, mungkin sudah dihapus. Kembali ke daftar opname lalu muat ulang.",
  catatanBukanMilikAnda:
    "Catatan opname ini milik perusahaan lain, jadi tidak bisa dibuka atau diubah.",
  gagalSimpan:
    "Opname belum tersimpan karena ada gangguan di server. Tidak ada angka yang berubah. Coba simpan sekali lagi; kalau tetap gagal, laporkan ke admin.",
  gagalHapus:
    "Catatan opname belum terhapus karena ada gangguan di server. Tidak ada angka yang berubah. Coba hapus sekali lagi; kalau tetap gagal, laporkan ke admin.",
} as const;

/** Pesan saat rincian kondisi (baik + rusak + expire) melebihi stok fisik. */
export function pesanKondisiMelebihiStokFisik(
  totalKondisi: number,
  stokFisik: number,
): string {
  return (
    `Jumlah Baik + Rusak + Expire (${totalKondisi}) lebih banyak dari stok fisik (${stokFisik}). ` +
    `Kurangi salah satunya sampai totalnya tidak lebih dari ${stokFisik}.`
  );
}

/** Pesan saat data opname gagal dimuat; `apa` = nama data, mis. "Laporan stok". */
export function pesanGagalMuatOpname(apa: string): string {
  return `${apa} belum bisa dimuat karena ada gangguan di server. Muat ulang halaman sebentar lagi; kalau tetap gagal, laporkan ke admin.`;
}
