/**
 * Pesan dan error transfer antar gudang.
 *
 * Pesan di sini dibaca langsung oleh petugas gudang: kalimat pendek, kata
 * sehari-hari, sebut apa yang salah, di mana, dan apa yang harus dilakukan.
 */

export type TransferRejectionStatus = 400 | 404 | 409;

/** Penolakan transfer yang pesannya aman dan jelas untuk ditampilkan ke petugas. */
export class TransferRejectedError extends Error {
  constructor(
    readonly status: TransferRejectionStatus,
    message: string,
  ) {
    super(message);
    this.name = "TransferRejectedError";
  }
}

/** Cek apakah error adalah penolakan transfer yang boleh ditampilkan. */
export function isTransferRejectedError(
  error: unknown,
): error is TransferRejectedError {
  return error instanceof TransferRejectedError;
}

const KONDISI_LABEL: Record<string, string> = {
  BARU: "baru",
  BEKAS: "bekas",
  RUSAK: "rusak",
};

/** Nama kondisi barang dalam kata sehari-hari. */
export function labelKondisiTransfer(kondisi: string): string {
  return KONDISI_LABEL[kondisi] ?? kondisi.toLowerCase();
}

const LAPOR_ADMIN = "Kalau masih gagal, lapor ke admin.";

/** Pesan tetap untuk transfer. Pesan 404 wajib memuat "tidak ditemukan". */
export const TRANSFER_MESSAGES = {
  barangKosong: "Barang belum dipilih. Pilih barang yang mau dipindah.",
  gudangAsalKosong:
    "Gudang asal belum dipilih. Pilih gudang tempat barang sekarang berada.",
  gudangTujuanKosong:
    "Gudang tujuan belum dipilih. Pilih gudang tempat barang akan dikirim.",
  jumlahKosong:
    "Jumlah belum diisi. Tulis berapa banyak barang yang mau dipindah.",
  jumlahBukanAngka: "Jumlah harus angka. Contoh: 5.",
  jumlahTidakPositif: "Jumlah harus lebih dari 0.",
  jumlahBerkoma: "Jumlah harus angka bulat, tanpa koma. Contoh: 5, bukan 5,5.",
  gudangSama:
    "Gudang asal dan gudang tujuan sama. Pilih gudang tujuan yang berbeda.",
  kondisiTidakDikenal:
    "Kondisi barang tidak dikenal. Pilih Baru, Bekas, atau Rusak.",
  fotoTidakTerbaca:
    "Foto bukti tidak terbaca. Hapus fotonya, lalu unggah lagi.",
  keteranganBukanTulisan: "Keterangan harus berupa tulisan.",
  dataTidakTerbaca:
    "Data transfer tidak terbaca. Muat ulang halaman, lalu isi formulirnya lagi.",
  barangTidakAda:
    "Barang yang mau dipindah tidak ditemukan. Mungkin sudah dihapus. Muat ulang halaman, lalu pilih barangnya lagi.",
  gudangAsalTidakAktif:
    "Gudang asal tidak ditemukan atau sudah dimatikan. Muat ulang halaman, lalu pilih gudang asal lain.",
  gudangTujuanTidakAktif:
    "Gudang tujuan tidak ditemukan atau sudah dimatikan. Muat ulang halaman, lalu pilih gudang tujuan lain.",
  transferTidakAda:
    "Data transfer ini tidak ditemukan. Mungkin sudah dibatalkan. Muat ulang halaman untuk melihat daftar terbaru.",
  transferBedaSite:
    "Transfer ini terjadi di gudang site lain, jadi Anda tidak bisa membukanya. Anda hanya bisa membuka transfer yang gudang asal atau tujuannya ada di site Anda.",
  gagalSimpan: `Transfer belum tersimpan karena ada gangguan di server. Stok tidak berubah. Coba kirim sekali lagi. ${LAPOR_ADMIN}`,
  gagalBatal: `Transfer belum dibatalkan karena ada gangguan di server. Stok tidak berubah. Coba sekali lagi. ${LAPOR_ADMIN}`,
  gagalUbahKeterangan: `Keterangan belum tersimpan karena ada gangguan di server. Coba sekali lagi. ${LAPOR_ADMIN}`,
  gagalMuatDetail: `Detail transfer gagal dimuat karena ada gangguan di server. Muat ulang halaman. ${LAPOR_ADMIN}`,
  gagalMuatDaftar: `Daftar transfer gagal dimuat karena ada gangguan di server. Muat ulang halaman. ${LAPOR_ADMIN}`,
} as const;

/** Pesan saat stok di gudang asal tidak cukup untuk dipindah. */
export function buildStokAsalKurangMessage(input: {
  barangNama: string;
  gudangNama: string;
  kondisi: string;
  tersedia: number;
  diminta: number;
}): string {
  const stok = `Stok "${input.barangNama}" kondisi ${labelKondisiTransfer(input.kondisi)} di gudang ${input.gudangNama}`;
  if (input.tersedia <= 0) {
    return `${stok} kosong (0), jadi tidak bisa dipindah. Cek lagi kondisi barangnya, atau pilih gudang asal lain.`;
  }
  return `${stok} hanya ${input.tersedia}, tapi Anda mau memindah ${input.diminta}. Kurangi jumlahnya jadi ${input.tersedia} atau kurang.`;
}

/** Pesan saat transfer tidak bisa dibatalkan karena barang di gudang tujuan sudah berkurang. */
export function buildBatalStokTujuanKurangMessage(input: {
  barangNama: string;
  gudangAsalNama: string;
  gudangTujuanNama: string;
  kondisi: string;
  tersedia: number;
  harusKembali: number;
}): string {
  return (
    `Transfer ini tidak bisa dibatalkan. ` +
    `Untuk membatalkan, ${input.harusKembali} "${input.barangNama}" (${labelKondisiTransfer(input.kondisi)}) ` +
    `harus diambil lagi dari gudang ${input.gudangTujuanNama} dan dikembalikan ke gudang ${input.gudangAsalNama}. ` +
    `Tapi di gudang ${input.gudangTujuanNama} sekarang hanya ada ${input.tersedia}. ` +
    `Barangnya mungkin sudah dipakai atau dipindah lagi. Tanyakan ke admin cara membetulkan stoknya.`
  );
}
