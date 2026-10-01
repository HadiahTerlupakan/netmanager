/**
 * Tanggal kalender "YYYY-MM-DD" untuk layar rencana kunjungan.
 *
 * Semua perhitungan di sini memakai waktu LOKAL browser, bukan UTC: kolom
 * `tanggal` rencana adalah tanggal kalender tanpa jam, dan admin yang membuka
 * layar pukul 06.00 WIB mengharapkan "hari ini" — bukan kemarin menurut UTC.
 */

/** Rentang tanggal inklusif, keduanya "YYYY-MM-DD". */
export interface RentangTanggal {
  dari: string;
  sampai: string;
}

const HARI_PER_MINGGU = 7;
/** `Date.getDay()` untuk Senin; Minggu bernilai 0. */
const INDEKS_SENIN = 1;
const PANJANG_BULAN_HARI = 2;

/** Angka dua digit berawalan nol. */
function duaDigit(angka: number): string {
  return String(angka).padStart(PANJANG_BULAN_HARI, "0");
}

/** Tanggal kalender lokal dari sebuah `Date`. */
export function keTanggalLokal(saat: Date): string {
  return `${saat.getFullYear()}-${duaDigit(saat.getMonth() + 1)}-${duaDigit(saat.getDate())}`;
}

/** Salinan `saat` yang digeser sejumlah hari (boleh negatif). */
function geserHari(saat: Date, jumlahHari: number): Date {
  return new Date(
    saat.getFullYear(),
    saat.getMonth(),
    saat.getDate() + jumlahHari,
  );
}

/** Senin sampai Minggu pekan berjalan. */
export function rentangMingguIni(sekarang: Date = new Date()): RentangTanggal {
  // Minggu (0) dianggap hari ke-7, supaya pekan selalu diawali Senin.
  const hariKe =
    (sekarang.getDay() - INDEKS_SENIN + HARI_PER_MINGGU) % HARI_PER_MINGGU;
  const senin = geserHari(sekarang, -hariKe);

  return {
    dari: keTanggalLokal(senin),
    sampai: keTanggalLokal(geserHari(senin, HARI_PER_MINGGU - 1)),
  };
}

/** Tanggal pertama sampai terakhir bulan berjalan. */
export function rentangBulanIni(sekarang: Date = new Date()): RentangTanggal {
  const awal = new Date(sekarang.getFullYear(), sekarang.getMonth(), 1);
  // Hari ke-0 bulan berikutnya adalah hari terakhir bulan ini.
  const akhir = new Date(sekarang.getFullYear(), sekarang.getMonth() + 1, 0);

  return { dari: keTanggalLokal(awal), sampai: keTanggalLokal(akhir) };
}

/**
 * Batas `max`/`min` yang dipasang dua medan tanggal pada satu sama lain,
 * supaya rentang terbalik tidak bisa dibentuk lewat widget-nya. Nama medan
 * menyebut atribut tujuannya (lihat `batasRentangTanggal` di
 * `kegiatan/kegiatanListQuery.ts`).
 */
export function batasRentang(rentang: RentangTanggal): {
  maksDari: string | undefined;
  minSampai: string | undefined;
} {
  return {
    maksDari: rentang.sampai.length > 0 ? rentang.sampai : undefined,
    minSampai: rentang.dari.length > 0 ? rentang.dari : undefined,
  };
}
