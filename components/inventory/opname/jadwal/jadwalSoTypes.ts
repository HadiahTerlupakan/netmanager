/** Bentuk respons API jadwal & kepatuhan stock opname (sisi klien). */

export type StatusSoGudang = "LENGKAP" | "SEBAGIAN" | "DI_LUAR_JADWAL" | "BELUM" | "TANPA_STOK";
export type KeadaanJendela = "BELUM_DIBUKA" | "TERBUKA" | "DITUTUP";

export interface JendelaSo {
  periode: string;
  mulai: string;
  selesai: string;
  sumber: "KHUSUS" | "BAWAAN";
}

export interface JadwalSoBulan {
  aturan: { isAktif: boolean; tanggalMulai: number; tanggalSelesai: number; isDiatur: boolean };
  jendela: JendelaSo;
  catatan: string | null;
}

export interface KepatuhanGudang {
  id: string;
  kode: string;
  nama: string;
  status: StatusSoGudang;
  jumlahBarangBerstok: number;
  jumlahDihitungDalamJadwal: number;
  soTerakhir: { tanggal: string; pic: string | null } | null;
}

export interface LaporanKepatuhanSo {
  jendela: JendelaSo;
  keadaan: KeadaanJendela;
  jumlahPerStatus: Record<StatusSoGudang, number>;
  site: { siteId: string | null; namaSite: string; gudang: KepatuhanGudang[] }[];
}

/** Label & warna (makna) tiap status gudang. */
export const TAMPILAN_STATUS_SO: Record<StatusSoGudang, { label: string; kelas: string }> = {
  LENGKAP: { label: "Lengkap", kelas: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  SEBAGIAN: { label: "Sebagian", kelas: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  DI_LUAR_JADWAL: { label: "Di luar jadwal", kelas: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  BELUM: { label: "Belum SO", kelas: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  TANPA_STOK: { label: "Tidak ada stok", kelas: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" },
};

export const LABEL_KEADAAN: Record<KeadaanJendela, string> = {
  BELUM_DIBUKA: "Belum dimulai",
  TERBUKA: "Sedang berjalan",
  DITUTUP: "Sudah lewat",
};

/** "25 Okt 2026" dari "YYYY-MM-DD". */
export function formatTanggalSo(tanggal: string): string {
  return new Date(`${tanggal.slice(0, 10)}T00:00:00.000Z`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Periode "YYYY-MM" bulan berjalan menurut WIB. */
export function periodeSekarang(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 7);
}
