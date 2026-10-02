/** Bentuk respons API jadwal & kepatuhan stock opname (sisi klien). */

export type StatusSoGudang = "LENGKAP" | "SEBAGIAN" | "DI_LUAR_JADWAL" | "BELUM" | "TANPA_STOK";
export type KeadaanJendela = "BELUM_DIBUKA" | "TERBUKA" | "DITUTUP";

export interface JendelaSo {
  periode: string;
  mulai: string;
  selesai: string;
  sumber: "KHUSUS" | "BAWAAN" | "TANPA_JADWAL";
}

export interface JadwalKhususSite {
  periode: string;
  mulai: string;
  selesai: string;
  catatan: string | null;
}

/** GET /api/admin/sites/:id/jadwal-so */
export interface JadwalSoSite {
  siteId: string;
  namaSite: string;
  aturan: { isAktif: boolean; tanggalMulai: number; tanggalSelesai: number; isDiatur: boolean };
  jendela: JendelaSo;
  catatan: string | null;
  jadwalKhusus: JadwalKhususSite[];
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

export interface KepatuhanSite {
  siteId: string | null;
  namaSite: string;
  jendela: JendelaSo;
  keadaan: KeadaanJendela;
  isPengingatAktif: boolean;
  gudang: KepatuhanGudang[];
}

export interface LaporanKepatuhanSo {
  periode: string;
  jumlahPerStatus: Record<StatusSoGudang, number>;
  site: KepatuhanSite[];
}

/** Label & warna (makna) tiap status gudang. */
export const TAMPILAN_STATUS_SO: Record<StatusSoGudang, { label: string; kelas: string }> = {
  LENGKAP: { label: "Lengkap", kelas: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  SEBAGIAN: { label: "Sebagian", kelas: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  DI_LUAR_JADWAL: { label: "Di luar jadwal", kelas: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  BELUM: { label: "Belum SO", kelas: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  TANPA_STOK: { label: "Tidak ada stok", kelas: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" },
};

/** "Jadwal 25 Okt – 31 Okt 2026" / "Belum ada jadwal (dinilai sebulan penuh)". */
export function labelJendela(jendela: JendelaSo): string {
  if (jendela.sumber === "TANPA_JADWAL") return "Belum ada jadwal (dinilai sebulan penuh)";
  const khusus = jendela.sumber === "KHUSUS" ? " (khusus bulan ini)" : "";
  return `Jadwal ${formatTanggalSo(jendela.mulai)} – ${formatTanggalSo(jendela.selesai)}${khusus}`;
}

export const LABEL_KEADAAN: Record<KeadaanJendela, string> = {
  BELUM_DIBUKA: "Belum dimulai",
  TERBUKA: "Sedang berjalan",
  DITUTUP: "Sudah lewat",
};

const OFFSET_WIB_MS = 7 * 60 * 60 * 1000;
const PANJANG_TANGGAL = 10;

/** Tanggal kalender WIB "YYYY-MM-DD" dari tanggal polos atau timestamp ISO. */
function keTanggalWib(tanggal: string): string {
  if (tanggal.length === PANJANG_TANGGAL) return tanggal;
  return new Date(new Date(tanggal).getTime() + OFFSET_WIB_MS).toISOString().slice(0, PANJANG_TANGGAL);
}

/** "25 Okt 2026" dari "YYYY-MM-DD" atau timestamp ISO (dibaca menurut WIB). */
export function formatTanggalSo(tanggal: string): string {
  return new Date(`${keTanggalWib(tanggal)}T00:00:00.000Z`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Periode "YYYY-MM" bulan berjalan menurut WIB. */
export function periodeSekarang(): string {
  const wib = new Date(Date.now() + OFFSET_WIB_MS);
  return wib.toISOString().slice(0, 7);
}
