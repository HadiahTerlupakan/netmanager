import { formatDateTimeDisplay } from "@/lib/utils/datetime";
import type { KegiatanDetailDto } from "@/modules/presurvei/client";

export interface BlokDetail {
  foto: boolean;
  dataTeknis: boolean;
  peta: boolean;
}

/**
 * Blok opsional mana yang punya isi.
 *
 * Dipisahkan dari komponen supaya murah diuji tanpa merender,
 * dan ketiga penentuan di bawah punya cara gagal yang senyap.
 */
export function blokYangTampil(kegiatan: KegiatanDetailDto): BlokDetail {
  return {
    foto: kegiatan.fotoUrls.length > 0,
    // `dataTeknis` sudah dinormalkan DTO menjadi objek atau null.
    dataTeknis: kegiatan.dataTeknis !== null,
    // Perbandingan eksplisit terhadap null: lintang 0 melintasi Indonesia,
    // dan pemeriksaan truthiness akan menyembunyikan petanya.
    peta: kegiatan.latitude !== null && kegiatan.longitude !== null,
  };
}

/** Pemisah antara jam mulai dan jam selesai pada ringkasan. */
const PEMISAH_RENTANG = " – ";

/**
 * Teks pengganti jam selesai untuk kegiatan yang masih berjalan.
 *
 * Kalimatnya sendiri, bukan "-": `formatDateTimeDisplay(null)` mengembalikan
 * "-" yang tidak bisa dibedakan dari tanggal rusak, sementara kegiatan yang
 * belum ditutup adalah keadaan normal di lapangan.
 */
const TEKS_BELUM_SELESAI = "belum selesai";

/**
 * Rentang waktu kegiatan sebagaimana dibaca di ringkasan.
 *
 * Fungsi murni di berkas ini, bukan rangkaian ekspresi di dalam JSX, karena ia
 * menanggung dua cara gagal yang senyap sekaligus:
 *
 * 1. `waktuMulai` dan `waktuSelesai` adalah hasil `toISOString()`. Tanpa
 *    pemformatan, layar mencetak `2026-09-10T02:00:00.000Z`.
 * 2. Keduanya bersebelahan dan sama-sama `string`; menukarnya lolos `tsc`
 *    tanpa satu pun keluhan, dan hasilnya hanya rentang yang terbaca terbalik.
 */
export function teksRentangWaktu(kegiatan: KegiatanDetailDto): string {
  const selesai =
    kegiatan.waktuSelesai === null
      ? TEKS_BELUM_SELESAI
      : formatDateTimeDisplay(kegiatan.waktuSelesai);

  return `${formatDateTimeDisplay(kegiatan.waktuMulai)}${PEMISAH_RENTANG}${selesai}`;
}

/**
 * Teks pengganti untuk field yang memang kosong.
 *
 * Diekspor supaya ringkasan dan blok data teknis memakai lambang yang sama —
 * dua "-" yang ditulis terpisah akan menyimpang begitu salah satunya diubah.
 */
export const TEKS_KOSONG = "-";

/** Satuan panjang kabel sebagaimana dicatat surveyor. */
const SATUAN_KABEL = "m";

/**
 * Estimasi panjang kabel beserta satuannya.
 *
 * Perbandingan eksplisit terhadap null, bukan truthiness: 0 meter adalah hasil
 * survei yang sah — tiang ada tepat di depan rumahnya — dan `meter ? ... : "-"`
 * melaporkannya sebagai belum diukur. Jebakan yang sama sudah diperingatkan di
 * `modules/presurvei/dto/kegiatan.dto.ts` untuk field ini persis, jadi ia
 * dijaga di sini juga alih-alih dipercayakan pada disiplin di dalam JSX.
 */
export function teksEstimasiKabel(meter: number | null): string {
  return meter === null ? TEKS_KOSONG : `${meter} ${SATUAN_KABEL}`;
}
