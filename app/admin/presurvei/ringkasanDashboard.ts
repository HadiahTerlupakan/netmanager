import { PERMISSIONS } from "@/lib/permissions";
import {
  PROSPEK_STATUS_CONFIG,
  daftarKolomHidup,
  type ProspekStatus,
} from "@/modules/presurvei/client";

/** Kolom corong yang angkanya belum bisa dipercaya. */
export type KeadaanTakTermuat = "memuat" | "gagal";

/** Keadaan angka satu kartu corong. */
export type KeadaanKartu = "termuat" | KeadaanTakTermuat;

export interface KartuCorong {
  status: ProspekStatus;
  label: string;
  warna: string;
  /** Null bila angkanya belum tiba atau gagal dimuat — lihat `keadaan`. */
  jumlah: number | null;
  keadaan: KeadaanKartu;
}

/**
 * Kartu corong dari jumlah per status.
 *
 * Hanya kolom hidup: TIDAK_MINAT dan TIDAK_LAYAK tumbuh tanpa batas dan akan
 * mendominasi ringkasan dengan prospek yang sudah tidak digarap.
 *
 * `keadaanTakTermuat` membedakan "tidak ada di respons" (nol) dari "gagal
 * dimuat" atau "belum tiba" (tanpa angka). Kolom yang ditolak server tidak
 * boleh tampil sebagai nol.
 */
export function hitungCorong(
  jumlahPerStatus: Record<string, number>,
  keadaanTakTermuat: Partial<Record<ProspekStatus, KeadaanTakTermuat>> = {},
): KartuCorong[] {
  return daftarKolomHidup().map((status) => {
    const tampilan = {
      status,
      label: PROSPEK_STATUS_CONFIG[status].label,
      warna: PROSPEK_STATUS_CONFIG[status].warna,
    };
    const keadaan = keadaanTakTermuat[status];
    if (keadaan !== undefined) {
      // Anotasi wajib: `null` tanpa tipe kontekstual memicu TS7018.
      const kartuTakTermuat: KartuCorong = {
        ...tampilan,
        jumlah: null,
        keadaan,
      };
      return kartuTakTermuat;
    }

    return {
      ...tampilan,
      // Status yang tidak ada di respons berarti nol, bukan tidak ada — kartu
      // yang menghilang membuat corongnya tampak lebih pendek dari kenyataan.
      jumlah: jumlahPerStatus[status] ?? 0,
      keadaan: "termuat",
    };
  });
}

/** Hasil query halaman pertama satu kolom, dari sudut pandang corong. */
export interface HasilKolomCorong {
  status: ProspekStatus;
  /** `meta.total`; undefined selama belum tiba. */
  total: number | undefined;
  isGagal: boolean;
}

/**
 * Pisahkan hasil query kolom menjadi masukan `hitungCorong`.
 *
 * Kolom yang gagal dianggap gagal walau masih memegang angka lama: React
 * Query mempertahankan `data` bersama error setelah muat ulang ditolak, dan
 * angka itu bisa sudah basi setelah kartu dipindahkan di papan.
 */
export function ringkasHasilKolom(hasil: readonly HasilKolomCorong[]): {
  jumlahPerStatus: Partial<Record<ProspekStatus, number>>;
  keadaanTakTermuat: Partial<Record<ProspekStatus, KeadaanTakTermuat>>;
} {
  const jumlahPerStatus: Partial<Record<ProspekStatus, number>> = {};
  const keadaanTakTermuat: Partial<Record<ProspekStatus, KeadaanTakTermuat>> =
    {};

  for (const { status, total, isGagal } of hasil) {
    if (isGagal) keadaanTakTermuat[status] = "gagal";
    else if (total === undefined) keadaanTakTermuat[status] = "memuat";
    else jumlahPerStatus[status] = total;
  }

  return { jumlahPerStatus, keadaanTakTermuat };
}

const TEKS_KARTU_TAK_TERMUAT: Record<KeadaanTakTermuat, string> = {
  memuat: "…",
  gagal: "—",
};

/** Teks angka kartu; kolom gagal dan yang masih dimuat tidak pernah tampil "0". */
export function teksJumlahKartu(kartu: KartuCorong): string {
  if (kartu.keadaan === "termuat") return String(kartu.jumlah);
  return TEKS_KARTU_TAK_TERMUAT[kartu.keadaan];
}

/** Bagian dashboard yang boleh tampil dan judul yang jujur soal cakupannya. */
export interface BagianDashboard {
  judulCorong: string;
  judulKegiatan: string;
  /** Daftar prospek tak bertuan — hanya untuk pemegang izin web. */
  canLihatTakBertuan: boolean;
  /** Ringkasan pencapaian — endpoint laporan punya izinnya sendiri. */
  canLihatLaporan: boolean;
}

/**
 * Bagian dashboard menurut izin pemakai.
 *
 * Gerbang halaman menerima izin web ATAU mobile, tetapi route daftar prospek
 * dan kegiatan mengikat pemegang izin mobile ke miliknya sendiri
 * (`app/api/presurvei/prospek/route.ts`, `app/api/presurvei/kegiatan/route.ts`).
 * Judulnya mengikuti cakupan itu supaya angka "Prospek Anda" tidak dibaca
 * sebagai angka seluruh tenant.
 */
export function tentukanBagianDashboard(
  punyaIzin: (izin: string) => boolean,
): BagianDashboard {
  const isCakupanTenant = punyaIzin(PERMISSIONS.MARKETING.PRESURVEI.READ);
  const cakupan = isCakupanTenant ? "tenant" : "Anda";

  return {
    judulCorong: `Prospek ${cakupan}`,
    judulKegiatan: `Kegiatan ${cakupan}`,
    canLihatTakBertuan: isCakupanTenant,
    canLihatLaporan: punyaIzin(PERMISSIONS.MARKETING.PRESURVEI_LAPORAN.READ),
  };
}

/** Halaman pertama; daftar dashboard tidak berpaginasi. */
const HALAMAN_PERTAMA = 1;

/** Jumlah hari kalender kegiatan yang diringkas, termasuk hari ini. */
export const JUMLAH_HARI_KEGIATAN = 7;

/** Baris kegiatan terbaru yang ditampilkan dashboard. */
export const BATAS_KEGIATAN_TERBARU = 5;

/** Baris prospek tak bertuan yang ditampilkan dashboard. */
export const BATAS_PROSPEK_TAK_BERTUAN = 5;

const PANJANG_TANGGAL_ISO = "YYYY-MM-DD".length;

/**
 * Tanggal pertama rentang kegiatan terbaru, `YYYY-MM-DD` menurut kalender UTC.
 *
 * UTC, sama dengan periode bulanan (`periode.ts`, `periodeSekarang`). Route
 * membacanya dengan `z.coerce.date()`, dan string tanggal saja diurai
 * JavaScript sebagai tengah malam UTC — jadi batas bawahnya pukul 00:00 UTC,
 * yaitu 07:00 WIB.
 */
export function tanggalAwalKegiatan(sekarang: Date): string {
  const awal = new Date(
    Date.UTC(
      sekarang.getUTCFullYear(),
      sekarang.getUTCMonth(),
      sekarang.getUTCDate() - (JUMLAH_HARI_KEGIATAN - 1),
    ),
  );
  return awal.toISOString().slice(0, PANJANG_TANGGAL_ISO);
}

/**
 * URL kegiatan terbaru. Nama param dicocokkan ke
 * `app/api/presurvei/kegiatan/route.ts:21-28`; urutannya `waktuMulai desc`
 * (`KegiatanRepository.ts`).
 */
export function buildKegiatanTerbaruUrl(sekarang: Date): string {
  const params = new URLSearchParams({
    page: String(HALAMAN_PERTAMA),
    limit: String(BATAS_KEGIATAN_TERBARU),
    dariTanggal: tanggalAwalKegiatan(sekarang),
  });
  return `/api/presurvei/kegiatan?${params.toString()}`;
}

/** URL halaman pertama prospek tak bertuan (`tanpaPemilik`, `daftarProspekSchema`). */
export function buildProspekTakBertuanUrl(): string {
  const params = new URLSearchParams({
    tanpaPemilik: "true",
    page: String(HALAMAN_PERTAMA),
    limit: String(BATAS_PROSPEK_TAK_BERTUAN),
  });
  return `/api/presurvei/prospek?${params.toString()}`;
}
