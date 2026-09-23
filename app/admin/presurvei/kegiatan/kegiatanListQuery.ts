import { formatDateTimeDisplay } from "@/lib/utils/datetime";
import type {
  KegiatanHasil,
  KegiatanJenis,
  KegiatanListItemDto,
} from "@/modules/presurvei/client";

const BATAS_TABEL = 20;
/** Batas maksimum yang diizinkan `daftarKegiatanSchema`. */
const BATAS_PETA = 100;

/** Halaman pertama daftar; juga batas bawah jumlah halaman. */
export const HALAMAN_PERTAMA = 1;

export interface FilterKegiatan {
  page: number;
  userId: string;
  jenis: KegiatanJenis | "";
  hasil: KegiatanHasil | "";
  /** Format `YYYY-MM-DD`; kosong berarti tidak membatasi. */
  dariTanggal: string;
  sampaiTanggal: string;
}

/**
 * URL daftar kegiatan.
 *
 * Tab peta memakai fungsi yang sama dengan `untukPeta: true`, supaya peta dan
 * daftar tidak pernah menampilkan himpunan yang berbeda — satu-satunya
 * perbedaannya adalah berapa banyak baris yang diambil sekaligus.
 */
export function buildKegiatanListUrl(
  filter: FilterKegiatan,
  opsi: { untukPeta?: boolean } = {},
): string {
  const params = new URLSearchParams({
    // Mode peta selalu dipakukan ke halaman pertama. Tanpa itu, membuka tab
    // peta dari halaman 3 tabel meminta baris 201-300 dan peta menggambar nol
    // titik di sebelah tabel yang penuh, tanpa satu pun pesan.
    page: String(opsi.untukPeta ? HALAMAN_PERTAMA : filter.page),
    limit: String(opsi.untukPeta ? BATAS_PETA : BATAS_TABEL),
  });

  for (const [kunci, nilai] of [
    ["userId", filter.userId],
    ["jenis", filter.jenis],
    ["hasil", filter.hasil],
    ["dariTanggal", filter.dariTanggal],
    ["sampaiTanggal", filter.sampaiTanggal],
  ] as const) {
    if (nilai.trim().length > 0) {
      params.set(kunci, nilai.trim());
    }
  }

  return `/api/presurvei/kegiatan?${params.toString()}`;
}

/**
 * Filter setelah pemakai mengubah kriteria; selalu kembali ke halaman pertama.
 *
 * Transisi state-nya fungsi murni, bukan callback di dalam hook, supaya bisa
 * diuji tanpa merender apa pun. Menyaring dari halaman lima tanpa reset ini
 * menghasilkan tabel kosong, dan pemakai menyimpulkan datanya tidak ada.
 */
export function filterSetelahUbah(
  lama: FilterKegiatan,
  perubahan: Partial<Omit<FilterKegiatan, "page">>,
): FilterKegiatan {
  return { ...lama, ...perubahan, page: HALAMAN_PERTAMA };
}

/**
 * Batas yang dipasang kedua medan tanggal pada satu sama lain.
 *
 * Nama medannya menyebut atribut yang diisinya — `maksDariTanggal` adalah
 * `max` medan "dari", `minSampaiTanggal` adalah `min` medan "sampai" — supaya
 * memasangnya tertukar di JSX terbaca salah tanpa perlu menjalankan apa pun.
 *
 * Tanpa batas ini pemakai bisa membentuk rentang terbalik (`dari` > `sampai`),
 * yang selalu mengembalikan nol baris tanpa satu pun pesan kesalahan; pemakai
 * lalu menyimpulkan timnya tidak bekerja. Tertukarnya `min` dengan `max`
 * membalik penjaga ini jadi kebalikan tujuannya — ia justru memaksa
 * `dari` >= `sampai`, sehingga SETIAP rentang yang bisa dibentuk adalah rentang
 * terbalik. Karena itu ia fungsi murni di sini, bukan dua `const` di dalam
 * komponen: di sana ia tak terjangkau test selamanya.
 *
 * `undefined` berarti "tak ada batas" bagi `<input type="date">`. Perbandingan
 * panjang, bukan truthiness: yang ditanyakan "terisi atau tidak".
 */
export function batasRentangTanggal(filter: FilterKegiatan): {
  maksDariTanggal: string | undefined;
  minSampaiTanggal: string | undefined;
} {
  return {
    maksDariTanggal:
      filter.sampaiTanggal.length > 0 ? filter.sampaiTanggal : undefined,
    minSampaiTanggal:
      filter.dariTanggal.length > 0 ? filter.dariTanggal : undefined,
  };
}

/** Filter setelah pemakai berpindah halaman; kriteria lain dipertahankan. */
export function filterSetelahPindahHalaman(
  lama: FilterKegiatan,
  page: number,
): FilterKegiatan {
  return { ...lama, page };
}

/**
 * Pilihan pemilih sales, diturunkan dari baris yang sedang tampil.
 *
 * `KegiatanListItemDto` hanya membawa `userId` — tidak ada nama — dan modul
 * presurvei tidak punya endpoint lookup sales. Dua endpoint yang ada
 * (`/api/admin/users`, `/api/admin/marketing/sales`) menuntut `users:read` dan
 * `sales:read`, permission yang belum tentu dipegang orang ber-`presurvei:read`;
 * memanggilnya dari sini akan menyambut mereka dengan 403 di setiap pembukaan.
 *
 * `terpilih` selalu ikut walau tidak ada barisnya: tanpa itu, menyaring satu
 * sales lalu mempersempit rentang tanggal sampai nol baris akan menghapus
 * pilihan itu dari `<select>`, sehingga layar menampilkan "Semua sales"
 * padahal filternya masih menyaring satu orang.
 */
export function opsiSales(
  baris: KegiatanListItemDto[],
  terpilih: string,
): string[] {
  const idSales = new Set(baris.map((item) => item.userId));

  if (terpilih.trim().length > 0) {
    idSales.add(terpilih);
  }

  return [...idSales].sort();
}

/**
 * Teks kolom "Waktu".
 *
 * `waktuMulai` adalah hasil `toISOString()`; tanpa pemformatan ini layar
 * mencetak `2026-09-22T23:45:00.000Z`. Jam ikut ditampilkan karena urutan
 * kunjungan dalam satu hari adalah informasi utama daftar ini.
 */
export function teksWaktuKegiatan(item: KegiatanListItemDto): string {
  return formatDateTimeDisplay(item.waktuMulai);
}

/** Urutan tab halaman kegiatan, sekaligus sumber union-nya. */
export const URUTAN_TAB = ["daftar", "peta"] as const;

export type TabKegiatan = (typeof URUTAN_TAB)[number];

/** Label tiap tab; Record memaksa anggota baru dijawab saat kompilasi. */
export const TAB_KEGIATAN_LABEL: Record<TabKegiatan, string> = {
  daftar: "Daftar",
  peta: "Peta kunjungan",
};
