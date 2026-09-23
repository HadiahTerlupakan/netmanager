import type {
  ProspekListItemDto,
  ProspekStatus,
} from "@/modules/presurvei/client";

/** Kartu per kolom pada satu kali pengambilan. */
const ISI_KOLOM = 20;

/** Halaman pertama tiap kolom; juga titik reset saat statusnya berganti. */
export const HALAMAN_PERTAMA = 1;

/**
 * Awalan kunci cache seluruh kolom papan.
 *
 * Diekspor supaya invalidasi setelah memindahkan kartu (Task 12) memakai
 * awalan yang sama persis dengan kunci yang dibentuk `useProspekKolom`;
 * menyalin string-nya membuat invalidasi diam-diam tidak mengenai apa pun.
 */
export const KUNCI_KOLOM_PROSPEK = "presurvei-prospek-kolom";

/**
 * URL satu kolom papan.
 *
 * Tiap kolom mengambil datanya sendiri: endpoint ini berpaginasi dengan batas
 * 100, jadi mengambil semua prospek sekaligus lalu mengelompokkan di klien
 * akan bekerja di development dan gagal diam-diam begitu datanya bertambah.
 */
export function buildProspekKolomUrl(
  status: ProspekStatus,
  page: number,
): string {
  const params = new URLSearchParams({
    status,
    page: String(page),
    limit: String(ISI_KOLOM),
  });

  return `/api/presurvei/prospek?${params.toString()}`;
}

/**
 * Seberapa jauh sebuah kolom sudah dimuat.
 *
 * `status` ikut disimpan supaya pergantian status bisa dikenali saat render
 * tanpa effect: muatan milik status lain dianggap kembali ke halaman pertama.
 */
export interface MuatanKolom {
  status: ProspekStatus;
  halaman: number;
}

/** Halaman terjauh yang dimuat untuk `status`; kembali ke awal bila statusnya lain. */
export function halamanTermuat(
  muatan: MuatanKolom,
  status: ProspekStatus,
): number {
  return muatan.status === status ? muatan.halaman : HALAMAN_PERTAMA;
}

/** Muatan setelah pemakai menekan "muat lebih" pada kolom `status`. */
export function muatanSetelahMuatLebih(
  lama: MuatanKolom,
  status: ProspekStatus,
): MuatanKolom {
  return { status, halaman: halamanTermuat(lama, status) + 1 };
}

/** Nomor halaman `1..sampai`, berurutan — satu query per halaman yang sudah dimuat. */
export function daftarHalaman(sampai: number): number[] {
  return Array.from({ length: sampai }, (_, index) => HALAMAN_PERTAMA + index);
}

/**
 * Kartu seluruh halaman yang sudah dimuat, berurutan dan tanpa kembar.
 *
 * Kembar itu nyata, bukan teoretis: daftar diurutkan `createdAt desc` dengan
 * `skip` offset (`modules/presurvei/repositories/ProspekRepository.ts:39-44`),
 * jadi satu prospek baru yang masuk di antara dua pengambilan menggeser semua
 * baris satu posisi ke bawah, dan kartu terakhir halaman satu muncul lagi di
 * awal halaman dua. Kemunculan pertama yang dipertahankan.
 *
 * Halaman yang belum tiba (`undefined`) dilewati.
 */
export function gabungKartu(
  perHalaman: (ProspekListItemDto[] | undefined)[],
): ProspekListItemDto[] {
  const idTerlihat = new Set<string>();
  const kartu: ProspekListItemDto[] = [];

  for (const halaman of perHalaman) {
    for (const item of halaman ?? []) {
      if (idTerlihat.has(item.id)) continue;
      idTerlihat.add(item.id);
      kartu.push(item);
    }
  }

  return kartu;
}

/** Bagian `meta` amplop daftar yang dibaca papan. */
export interface MetaKolom {
  total: number;
  totalPages: number;
}

/**
 * Jumlah prospek kolom dan apakah masih ada halaman berikutnya.
 *
 * Dibaca dari meta halaman TERJAUH yang sudah tiba — itulah hitungan paling
 * baru dari server. Tanpa meta sama sekali kolom dianggap kosong dan tombol
 * "muat lebih" disembunyikan.
 */
export function ringkasJumlahKolom(
  perHalaman: (MetaKolom | undefined)[],
  halaman: number,
): { total: number; adaLagi: boolean } {
  const metaTerbaru = perHalaman.filter((meta) => meta !== undefined).at(-1);

  if (metaTerbaru === undefined) {
    return { total: 0, adaLagi: false };
  }

  return {
    total: metaTerbaru.total,
    adaLagi: halaman < metaTerbaru.totalPages,
  };
}

/** Teks jumlah di kepala kolom, jujur soal kartu yang belum dimuat. */
export function teksJumlahKolom(ditampilkan: number, total: number): string {
  return `menampilkan ${ditampilkan} dari ${total}`;
}

/**
 * Apakah prospek belum punya pemilik.
 *
 * Perbandingan panjang, bukan truthiness: yang ditanyakan "terisi atau
 * tidak". `?? ""` menampung `null` dari DTO sekaligus `undefined` yang lolos
 * kompilasi karena `strictNullChecks: false`.
 */
export function isTakBertuan(item: Pick<ProspekListItemDto, "pemilikId">) {
  return (item.pemilikId ?? "").length === 0;
}
