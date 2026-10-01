import { formatDateDisplay } from "@/lib/utils/datetime";
import type {
  RencanaDto,
  RencanaStatusTampil,
  RencanaSumber,
  TampilanStatus,
} from "@/modules/presurvei/client";

/** Label dan warna badge tiap status tampil rencana. */
export const RENCANA_STATUS_TAMPIL_CONFIG: Record<
  RencanaStatusTampil,
  TampilanStatus
> = {
  DIRENCANAKAN: { label: "Direncanakan", warna: "bg-blue-100 text-blue-700" },
  TERLEWAT: { label: "Terlewat", warna: "bg-red-100 text-red-700" },
  SELESAI: { label: "Selesai", warna: "bg-emerald-100 text-emerald-700" },
  BATAL: { label: "Batal", warna: "bg-gray-100 text-gray-600" },
};

/** Label dan warna badge asal rencana. */
export const RENCANA_SUMBER_CONFIG: Record<RencanaSumber, TampilanStatus> = {
  MANDIRI: { label: "Mandiri", warna: "bg-slate-100 text-slate-700" },
  PENUGASAN: { label: "Penugasan", warna: "bg-violet-100 text-violet-700" },
};

/** Catatan di bawah badge SELESAI untuk laporan yang masuk setelah harinya. */
export const TEKS_TERLAMBAT = "terlambat";

/** Pengganti nama yang tidak bisa ditampilkan (user lain tenant/terhapus). */
const TEKS_TANPA_NAMA = "Tanpa nama";

/** Pengganti persen realisasi saat belum ada rencana yang jatuh tempo. */
export const TEKS_TANPA_PERSEN = "—";

const PERSEN_PENUH = 100;

/** Catatan tambahan badge status, atau null bila tidak ada. */
export function catatanStatusRencana(
  rencana: Pick<RencanaDto, "statusTampil" | "isTerlambat">,
): string | null {
  return rencana.statusTampil === "SELESAI" && rencana.isTerlambat
    ? TEKS_TERLAMBAT
    : null;
}

/**
 * Apakah rencana masih boleh dijadwal ulang atau dibatalkan.
 *
 * TERLEWAT tetap terbuka: ia DIRENCANAKAN yang tanggalnya lewat
 * (`tentukanStatusTampil`), dan server hanya menolak yang sudah SELESAI/BATAL
 * (`isMasihTerbuka`).
 */
export function isRencanaTerbuka(statusTampil: RencanaStatusTampil): boolean {
  return statusTampil === "DIRENCANAKAN" || statusTampil === "TERLEWAT";
}

/** Nama untuk ditampilkan; null dari server diganti label netral. */
export function teksNama(nama: string | null): string {
  return nama ?? TEKS_TANPA_NAMA;
}

/**
 * Keterangan pembuat di bawah badge sumber — hanya untuk penugasan, karena
 * rencana mandiri dibuat oleh sales itu sendiri.
 */
export function teksPembuatRencana(
  rencana: Pick<RencanaDto, "sumber" | "namaPembuat">,
): string | null {
  if (rencana.sumber !== "PENUGASAN") return null;
  return `oleh ${teksNama(rencana.namaPembuat)}`;
}

/** Teks kolom % realisasi; null berarti belum ada yang jatuh tempo. */
export function teksPersenRealisasi(persen: number | null): string {
  return persen === null ? TEKS_TANPA_PERSEN : `${persen}%`;
}

/** Lebar bilah kemajuan (0–100) dari persen realisasi; null berarti 0. */
export function lebarBilahRealisasi(persen: number | null): number {
  if (persen === null) return 0;
  return Math.min(PERSEN_PENUH, Math.max(0, persen));
}

/**
 * Tautan Google Maps untuk sepasang koordinat, atau null bila salah satunya
 * kosong. Perbandingan eksplisit terhadap null: lintang 0 melintasi
 * Indonesia dan sah.
 */
export function tautanPeta(
  latitude: number | null,
  longitude: number | null,
): string | null {
  if (latitude === null || longitude === null) return null;
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

/** Tanggal rencana beserta jamnya bila ada, mis. "27 Sep 2026 · 13:30". */
export function labelWaktuRencana(
  rencana: Pick<RencanaDto, "tanggal" | "jam">,
): string {
  const tanggal = formatDateDisplay(rencana.tanggal);
  return rencana.jam ? `${tanggal} · ${rencana.jam}` : tanggal;
}
