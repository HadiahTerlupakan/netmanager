/**
 * Hasil kegiatan yang relevan per jenis kegiatan — fungsi murni, tanpa I/O.
 *
 * Nilai hasil dipakai bersama semua jenis (maknanya sama: "tidak ada kontak"
 * = tidak ketemu orangnya / telepon tidak diangkat / chat belum dibalas),
 * tetapi pilihan dan labelnya disesuaikan jenis kegiatannya. Survei lokasi
 * punya hasil sendiri: kelayakan pasang.
 */

import type { KegiatanHasil, KegiatanJenis } from "./entities/Kegiatan";

/** Hasil yang hanya bermakna untuk survei lokasi. */
const HASIL_KHUSUS_SURVEI: readonly KegiatanHasil[] = ["BISA_DIPASANG", "TIDAK_BISA_DIPASANG"];

/** Pesan penolakan hasil khusus survei pada jenis lain — satu teks untuk validator dan service. */
export const PESAN_HASIL_KHUSUS_SURVEI =
  'Hasil "bisa/tidak bisa dipasang" hanya untuk survei lokasi';

/** Pilihan hasil jenis kegiatan selain survei lokasi, dalam urutan tampil. */
const HASIL_MINAT_PELANGGAN: readonly KegiatanHasil[] = [
  "TERTARIK",
  "DEAL",
  "PERLU_FOLLOWUP",
  "TIDAK_MINAT",
  "TIDAK_ADA_ORANG",
];

/** Pilihan hasil per jenis kegiatan, dalam urutan tampil. */
export const HASIL_PER_JENIS: Record<KegiatanJenis, readonly KegiatanHasil[]> = {
  KUNJUNGAN: HASIL_MINAT_PELANGGAN,
  SURVEI_LOKASI: ["BISA_DIPASANG", "TIDAK_BISA_DIPASANG", "PERLU_FOLLOWUP", "TIDAK_ADA_ORANG"],
  TELEPON: HASIL_MINAT_PELANGGAN,
  CHAT: HASIL_MINAT_PELANGGAN,
  IKLAN: HASIL_MINAT_PELANGGAN,
};

/** Label umum, dipakai bila jenis tidak punya label khusus. */
export const LABEL_HASIL_UMUM: Record<KegiatanHasil, string> = {
  TERTARIK: "Tertarik",
  PERLU_FOLLOWUP: "Perlu follow-up",
  TIDAK_MINAT: "Tidak minat",
  TIDAK_ADA_ORANG: "Tidak ada orang",
  DEAL: "Deal",
  BISA_DIPASANG: "Bisa dipasang",
  TIDAK_BISA_DIPASANG: "Tidak bisa dipasang",
};

/** Label yang lebih tepat untuk jenis tertentu. */
const LABEL_HASIL_KHUSUS: Partial<Record<KegiatanJenis, Partial<Record<KegiatanHasil, string>>>> = {
  KUNJUNGAN: {
    DEAL: "Setuju pasang",
    PERLU_FOLLOWUP: "Masih pikir-pikir",
    TIDAK_ADA_ORANG: "Tidak ketemu orangnya",
  },
  SURVEI_LOKASI: {
    PERLU_FOLLOWUP: "Perlu dicek ulang",
    TIDAK_ADA_ORANG: "Tidak ketemu orangnya",
  },
  TELEPON: {
    DEAL: "Setuju pasang",
    PERLU_FOLLOWUP: "Minta ditelepon lagi",
    TIDAK_ADA_ORANG: "Tidak diangkat / nomor tidak aktif",
  },
  CHAT: {
    DEAL: "Setuju pasang",
    PERLU_FOLLOWUP: "Masih tanya-tanya",
    TIDAK_ADA_ORANG: "Belum dibalas",
  },
};

/** Label hasil menurut jenis kegiatannya, mis. TIDAK_ADA_ORANG pada telepon = "Tidak diangkat…". */
export function labelHasilKegiatan(hasil: KegiatanHasil, jenis: KegiatanJenis): string {
  return LABEL_HASIL_KHUSUS[jenis]?.[hasil] ?? LABEL_HASIL_UMUM[hasil];
}

/**
 * Apakah hasil boleh dipakai untuk jenis ini. Hanya hasil khusus survei yang
 * dibatasi; kombinasi lama (mis. survei lokasi "Tertarik") tetap diterima
 * supaya aplikasi versi lama dan antrean offline tidak ditolak.
 */
export function isHasilSesuaiJenis(hasil: KegiatanHasil, jenis: KegiatanJenis): boolean {
  return !HASIL_KHUSUS_SURVEI.includes(hasil) || jenis === "SURVEI_LOKASI";
}
