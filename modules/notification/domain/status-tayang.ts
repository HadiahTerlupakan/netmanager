/**
 * Status tayang efektif sebuah pengumuman.
 *
 * `isActive` di database hanya saklar manual. Apakah sebuah pengumuman benar-
 * benar sampai ke pengguna juga ditentukan periodenya, karena penyaring
 * pengiriman (`buildMobileAnnouncementWhere` / `buildPortalAnnouncementWhere`)
 * ikut membandingkan `startDate` dan `endDate` terhadap waktu sekarang.
 *
 * Daftar admin wajib memakai status efektif ini, bukan `isActive` mentah.
 * Tanpa itu pengumuman yang periodenya sudah lewat tetap tampil hijau "Aktif"
 * padahal tidak dibaca siapa pun — persis yang terjadi sebelum perbaikan ini.
 *
 * Tanggal kosong berarti tak terbatas di sisi tersebut: tanpa tanggal mulai
 * berarti berlaku sejak awal, tanpa tanggal berakhir berarti tidak kedaluwarsa.
 */

export const STATUS_TAYANG = {
  NONAKTIF: "NONAKTIF",
  TERJADWAL: "TERJADWAL",
  TAYANG: "TAYANG",
  KEDALUWARSA: "KEDALUWARSA",
} as const;

export type StatusTayang = (typeof STATUS_TAYANG)[keyof typeof STATUS_TAYANG];

export const LABEL_STATUS_TAYANG: Record<StatusTayang, string> = {
  NONAKTIF: "Non-aktif",
  TERJADWAL: "Terjadwal",
  TAYANG: "Aktif",
  KEDALUWARSA: "Kedaluwarsa",
};

export interface PeriodeTayang {
  isActive: boolean;
  startDate: string | Date | null;
  endDate: string | Date | null;
}

/**
 * Ubah tanggal menjadi epoch. Nilai kosong maupun tanggal yang tidak bisa
 * diurai sama-sama menghasilkan `null` = batas terbuka, supaya tanggal rusak
 * tidak pernah membuat pengumuman dinyatakan kedaluwarsa secara keliru.
 */
export function tanggalKeEpoch(
  nilai: string | Date | null | undefined,
): number | null {
  if (nilai == null) {
    return null;
  }
  const epoch = nilai instanceof Date ? nilai.getTime() : Date.parse(nilai);
  return Number.isNaN(epoch) ? null : epoch;
}

/** Hitung status tayang efektif dari saklar `isActive` digabung periodenya. */
export function hitungStatusTayang(
  pengumuman: PeriodeTayang,
  sekarang: Date,
): StatusTayang {
  if (!pengumuman.isActive) {
    return STATUS_TAYANG.NONAKTIF;
  }

  const kini = sekarang.getTime();
  const mulai = tanggalKeEpoch(pengumuman.startDate);
  const berakhir = tanggalKeEpoch(pengumuman.endDate);

  if (mulai !== null && kini < mulai) {
    return STATUS_TAYANG.TERJADWAL;
  }
  if (berakhir !== null && kini > berakhir) {
    return STATUS_TAYANG.KEDALUWARSA;
  }
  return STATUS_TAYANG.TAYANG;
}
