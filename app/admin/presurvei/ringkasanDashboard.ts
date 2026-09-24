import { PERMISSIONS } from "@/lib/permissions";
import {
  PERAN_PELAKU_LABEL,
  PROSPEK_STATUS_CONFIG,
  daftarKolomHidup,
  type KegiatanListItemDto,
  type PeranPelaku,
  type ProspekStatus,
  type SalesPresurveiDto,
} from "@/modules/presurvei/client";

import { teksPeranPelaku } from "./labelPeranPelaku";
import { labelSales } from "./labelSales";
import { KUNCI_KOLOM_PROSPEK } from "./prospek/prospekKolomQuery";

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
export function teksJumlahKartu(
  kartu: Pick<KartuCorong, "jumlah" | "keadaan">,
): string {
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
  /**
   * Jumlah kegiatan per peran (Sales/Non-sales). Hanya untuk cakupan tenant:
   * pemanggil lain diikat route ke kegiatannya sendiri, jadi angka
   * "Non-sales" baginya pasti 0 dan hanya menyesatkan.
   */
  canLihatPemisahanPeran: boolean;
}

/**
 * Apakah pemakai bercakupan seluruh tenant presurvei — melihat prospek siapa
 * pun, dan karena itu juga boleh menugaskan pemilik prospek.
 *
 * Satu-satunya definisi di klien, dipakai dashboard dan form prospek. Server
 * memakai `isBolehLihatSemuaPresurvei` (`app/api/presurvei/akses-presurvei.ts`)
 * dengan string persis; `punyaIzin` di sini sadar alias
 * (`contexts/PermissionContext.tsx`).
 */
export function isCakupanTenantPresurvei(
  punyaIzin: (izin: string) => boolean,
): boolean {
  return punyaIzin(PERMISSIONS.MARKETING.PRESURVEI.READ);
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
  const isCakupanTenant = isCakupanTenantPresurvei(punyaIzin);
  const cakupan = isCakupanTenant ? "tenant" : "Anda";

  return {
    judulCorong: `Prospek ${cakupan}`,
    judulKegiatan: `Kegiatan ${cakupan}`,
    canLihatTakBertuan: isCakupanTenant,
    canLihatLaporan: punyaIzin(PERMISSIONS.MARKETING.PRESURVEI_LAPORAN.READ),
    canLihatPemisahanPeran: isCakupanTenant,
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

/** Satu baris per permintaan hitungan: yang dibaca hanya `meta.total`. */
const BATAS_HITUNG_KEGIATAN = 1;

/**
 * URL hitungan kegiatan satu peran pada rentang yang sama dengan kegiatan
 * terbaru. Nama param `peran` dicocokkan ke `app/api/presurvei/kegiatan/route.ts`.
 */
export function buildJumlahKegiatanPeranUrl(
  sekarang: Date,
  peran: PeranPelaku,
): string {
  const params = new URLSearchParams({
    page: String(HALAMAN_PERTAMA),
    limit: String(BATAS_HITUNG_KEGIATAN),
    dariTanggal: tanggalAwalKegiatan(sekarang),
    peran,
  });
  return `/api/presurvei/kegiatan?${params.toString()}`;
}

/** Jumlah kegiatan satu peran, dengan keadaan pemuatan seperti kartu corong. */
export interface KartuPeran {
  peran: PeranPelaku;
  label: string;
  /** Null bila angkanya belum tiba atau gagal dimuat — lihat `keadaan`. */
  jumlah: number | null;
  keadaan: KeadaanKartu;
}

/** Hasil query hitungan satu peran. */
export interface HasilJumlahPeran {
  peran: PeranPelaku;
  /** `meta.total`; undefined selama belum tiba. */
  total: number | undefined;
  isGagal: boolean;
}

/**
 * Kartu jumlah per peran. Seperti `ringkasHasilKolom`, yang gagal dianggap
 * gagal walau masih memegang angka lama — dan tidak pernah tampil sebagai 0.
 */
export function kartuJumlahPeran(
  hasil: readonly HasilJumlahPeran[],
): KartuPeran[] {
  return hasil.map(({ peran, total, isGagal }) => {
    const label = PERAN_PELAKU_LABEL[peran];
    if (isGagal) {
      // Anotasi wajib: `null` tanpa tipe kontekstual memicu TS7018.
      const kartuGagal: KartuPeran = {
        peran,
        label,
        jumlah: null,
        keadaan: "gagal",
      };
      return kartuGagal;
    }
    if (total === undefined) {
      const kartuMemuat: KartuPeran = {
        peran,
        label,
        jumlah: null,
        keadaan: "memuat",
      };
      return kartuMemuat;
    }
    return { peran, label, jumlah: total, keadaan: "termuat" };
  });
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

/**
 * Segmen kedua kunci daftar tak bertuan. Bukan anggota `PROSPEK_STATUSES`,
 * jadi pencarian per status tidak pernah menemukannya.
 */
const SEGMEN_TAK_BERTUAN = "tak-bertuan";

/**
 * Awalan kunci daftar tak bertuan, `[KUNCI_KOLOM_PROSPEK, "tak-bertuan"]`,
 * untuk invalidasi yang tidak peduli halaman atau batas daftarnya.
 */
export function awalanKunciProspekTakBertuan(): [string, string] {
  return [KUNCI_KOLOM_PROSPEK, SEGMEN_TAK_BERTUAN];
}

/**
 * Kunci cache daftar prospek tak bertuan: `[KUNCI_KOLOM_PROSPEK, "tak-bertuan", url]`.
 *
 * Invalidasi yang mengenainya:
 * - seluruh awalan `[KUNCI_KOLOM_PROSPEK]` (`prospek/prospekFormState.ts`,
 *   `kunciKolomSetelahSimpan`, dipakai saat status hasil simpan tak terbaca);
 * - `awalanKunciProspekTakBertuan()` setelah prospek diubah lewat form
 *   (`prospek/useSimpanProspek.ts`), karena nama dan telepon yang tampil di
 *   daftar ini bisa ikut berubah.
 *
 * Invalidasi per status (`[KUNCI_KOLOM_PROSPEK, status]` — seret dan konversi)
 * TIDAK mengenainya. Keanggotaan daftar ini ditentukan pemilik, bukan status,
 * dan kedua jalur itu tidak mengubah pemilik. Satu-satunya jalur web yang
 * mengubah pemilik adalah form prospek: mode ubah menginvalidasi awalan ini
 * (butir di atas), dan mode buat selalu menghasilkan prospek berpemilik
 * (`pemilikDiminta ?? idPemanggil`). Perubahan pemilik dari luar layar ini — mis. aplikasi mobile — baru terlihat
 * setelah `staleTime` 30 detik (`components/providers/session-provider.tsx:31`).
 *
 * Aman terhadap `findAll({ queryKey: [KUNCI_KOLOM_PROSPEK, tujuan] })` di
 * `prospek/usePindahProspek.ts:80-82`, yang membaca datanya sebagai halaman
 * kolom: `tujuan` selalu status, tidak pernah `SEGMEN_TAK_BERTUAN`.
 */
export function kunciQueryProspekTakBertuan(): [string, string, string] {
  return [...awalanKunciProspekTakBertuan(), buildProspekTakBertuanUrl()];
}

/** Daftar sales kosong: dashboard tidak memuat daftar sales untuk bagian kegiatan. */
const TANPA_DAFTAR_SALES: readonly SalesPresurveiDto[] = Object.freeze([]);

/**
 * Pelaku satu kegiatan: `namaSales` dari baris, atau label netral `labelSales`.
 *
 * Daftar sales sengaja tidak diambil: endpoint-nya
 * (`app/api/admin/presurvei/sales/route.ts:23-27`) menolak pemegang
 * `m_presurvei:read` saja, padahal bagian kegiatan tampil untuk mereka. Baris
 * kegiatan sudah membawa nama bila bisa ditampilkan, jadi yang tersisa hanya
 * label cadangan — tanpa id utuh.
 */
export function teksPelakuKegiatan(
  item: Pick<KegiatanListItemDto, "namaSales" | "userId">,
): string {
  return item.namaSales ?? labelSales(item.userId, TANPA_DAFTAR_SALES);
}

/**
 * Pelaku satu kegiatan beserta peran dan departemennya:
 * "Joko (Non-sales · Teknik)", atau nama saja bila peran tidak diketahui.
 */
export function teksPelakuDenganPeran(
  item: Pick<
    KegiatanListItemDto,
    "namaSales" | "userId" | "peranPelaku" | "departemenPelaku"
  >,
): string {
  const pelaku = teksPelakuKegiatan(item);
  const peran = teksPeranPelaku(item);
  return peran === null ? pelaku : `${pelaku} (${peran})`;
}
