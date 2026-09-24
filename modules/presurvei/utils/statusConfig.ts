/**
 * Label dan warna untuk enum presurvei di lapisan tampilan.
 *
 * Terpisah dari `components/common/StatusBadge.tsx` karena komponen itu
 * memakai union status yang di-hardcode dan tidak memuat enum modul ini;
 * memaksakannya ke sana akan mengubah union yang dipakai sepuluh berkas lain.
 */

import type { IklanChannel } from "../domain/entities/Iklan";
import type { KegiatanHasil, KegiatanJenis } from "../domain/entities/Kegiatan";
import type { PeranPelaku } from "../domain/peran-pelaku";
import {
  PROSPEK_STATUSES,
  type ProspekStatus,
  type ProspekSumber,
} from "../domain/entities/Prospek";

/** Bagaimana satu nilai enum ditampilkan. */
export interface TampilanStatus {
  label: string;
  /** Kelas Tailwind untuk badge — latar dan teks sekaligus. */
  warna: string;
}

export const PROSPEK_STATUS_CONFIG: Record<ProspekStatus, TampilanStatus> = {
  BARU: { label: "Baru", warna: "bg-slate-100 text-slate-700" },
  DIHUBUNGI: { label: "Dihubungi", warna: "bg-blue-100 text-blue-700" },
  TERTARIK: { label: "Tertarik", warna: "bg-amber-100 text-amber-700" },
  NEGOSIASI: { label: "Negosiasi", warna: "bg-orange-100 text-orange-700" },
  DEAL: { label: "Deal", warna: "bg-emerald-100 text-emerald-700" },
  TIDAK_MINAT: { label: "Tidak minat", warna: "bg-gray-100 text-gray-600" },
  TIDAK_LAYAK: { label: "Tidak layak", warna: "bg-red-100 text-red-700" },
};

export const PROSPEK_SUMBER_CONFIG: Record<ProspekSumber, TampilanStatus> = {
  LAPANGAN: { label: "Lapangan", warna: "bg-teal-100 text-teal-700" },
  IKLAN: { label: "Iklan", warna: "bg-violet-100 text-violet-700" },
  WEBSITE: { label: "Website", warna: "bg-sky-100 text-sky-700" },
  REFERRAL: { label: "Referral", warna: "bg-pink-100 text-pink-700" },
  WALK_IN: { label: "Walk-in", warna: "bg-lime-100 text-lime-700" },
};

export const KEGIATAN_JENIS_CONFIG: Record<KegiatanJenis, TampilanStatus> = {
  KUNJUNGAN: { label: "Kunjungan", warna: "bg-teal-100 text-teal-700" },
  SURVEI_LOKASI: {
    label: "Survei lokasi",
    warna: "bg-indigo-100 text-indigo-700",
  },
  TELEPON: { label: "Telepon", warna: "bg-sky-100 text-sky-700" },
  CHAT: { label: "Chat", warna: "bg-cyan-100 text-cyan-700" },
  IKLAN: { label: "Iklan", warna: "bg-violet-100 text-violet-700" },
};

export const KEGIATAN_HASIL_CONFIG: Record<KegiatanHasil, TampilanStatus> = {
  TERTARIK: { label: "Tertarik", warna: "bg-amber-100 text-amber-700" },
  PERLU_FOLLOWUP: {
    label: "Perlu follow-up",
    warna: "bg-blue-100 text-blue-700",
  },
  TIDAK_MINAT: { label: "Tidak minat", warna: "bg-gray-100 text-gray-600" },
  TIDAK_ADA_ORANG: {
    label: "Tidak ada orang",
    warna: "bg-slate-100 text-slate-600",
  },
  DEAL: { label: "Deal", warna: "bg-emerald-100 text-emerald-700" },
};

export const IKLAN_CHANNEL_CONFIG: Record<IklanChannel, TampilanStatus> = {
  META: { label: "Meta", warna: "bg-blue-100 text-blue-700" },
  GOOGLE: { label: "Google", warna: "bg-red-100 text-red-700" },
  TIKTOK: { label: "TikTok", warna: "bg-neutral-100 text-neutral-800" },
  WHATSAPP: { label: "WhatsApp", warna: "bg-green-100 text-green-700" },
  OFFLINE: { label: "Offline", warna: "bg-stone-100 text-stone-700" },
  LAINNYA: { label: "Lainnya", warna: "bg-gray-100 text-gray-600" },
};

/**
 * Label peran pelaku kegiatan. "Non-sales", bukan "Teknisi": admin yang
 * mencatat telepon dari web juga bukan sales. Departemen ditampilkan terpisah
 * di sampingnya supaya teknisi tetap terbaca.
 */
export const PERAN_PELAKU_LABEL: Record<PeranPelaku, string> = {
  SALES: "Sales",
  NON_SALES: "Non-sales",
};

const KOLOM_STATUS: Record<ProspekStatus, "hidup" | "mati"> = {
  BARU: "hidup",
  DIHUBUNGI: "hidup",
  TERTARIK: "hidup",
  NEGOSIASI: "hidup",
  DEAL: "hidup",
  TIDAK_MINAT: "mati",
  TIDAK_LAYAK: "mati",
};

/**
 * Salinan kolom corong hidup, berurutan dari kiri.
 *
 * Diturunkan dari `PROSPEK_STATUSES` lewat `.filter()`, bukan ditulis sebagai
 * array tersendiri: bentuk `Record` memaksa status baru dijawab saat kompilasi,
 * dan `.filter()` menghasilkan array baru tiap panggilan sehingga sifat
 * salinannya tetap.
 */
export function daftarKolomHidup(): ProspekStatus[] {
  return PROSPEK_STATUSES.filter((status) => KOLOM_STATUS[status] === "hidup");
}

/** Salinan kolom status mati; prospek mati mengotori papan kerja. */
export function daftarKolomMati(): ProspekStatus[] {
  return PROSPEK_STATUSES.filter((status) => KOLOM_STATUS[status] === "mati");
}
