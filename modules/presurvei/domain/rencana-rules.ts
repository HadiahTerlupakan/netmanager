/**
 * Aturan rencana kunjungan presurvei — fungsi murni, tanpa I/O.
 *
 * Murni: tidak mengimpor apa pun dari luar folder domain.
 */

import type {
  RencanaEntity,
  RencanaStatus,
  RencanaStatusTampil,
  RencanaSumber,
} from "./entities/Rencana";

/**
 * Siapa saja yang rencananya boleh dilihat dan diatur seorang pengguna.
 *
 * - SEMUA: admin (`presurvei_rencana:view_all`) — seluruh tenant.
 * - TIM: kepala sales — dirinya sendiri dan anggota timnya (`User.kepalaSalesId`).
 * - SENDIRI: sales dari mobile — hanya rencananya sendiri.
 */
export type LingkupRencana =
  | { jenis: "SEMUA"; penggunaId: string }
  | { jenis: "TIM"; penggunaId: string; anggotaIds: string[] }
  | { jenis: "SENDIRI"; penggunaId: string };

export type JenisLingkupRencana = LingkupRencana["jenis"];

/** Pola tanggal kalender yang dipakai kolom DATE rencana. */
export const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/** Pola jam 24 jam "HH:mm" (00:00–23:59). */
export const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Tanggal kalender "YYYY-MM-DD" dari `saat` di zona waktu tenant.
 *
 * Batas hari mengikuti zona tenant, bukan UTC: rencana "hari ini" pukul 06.00
 * WIB masih tanggal kemarin menurut UTC.
 */
export function tanggalLokal(saat: Date, zonaWaktu: string): string {
  // Locale en-CA memformat tanggal sebagai YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaWaktu,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(saat);
}

/** Status tampil: DIRENCANAKAN yang tanggalnya sudah lewat menjadi TERLEWAT. */
export function tentukanStatusTampil(
  rencana: Pick<RencanaEntity, "status" | "tanggal">,
  hariIni: string,
): RencanaStatusTampil {
  if (rencana.status === "DIRENCANAKAN" && rencana.tanggal < hariIni) {
    return "TERLEWAT";
  }
  return rencana.status;
}

/** Laporan terlambat: dilaporkan setelah hari rencananya (zona tenant). */
export function isLaporanTerlambat(
  rencana: Pick<RencanaEntity, "tanggal" | "dilaporkanAt">,
  zonaWaktu: string,
): boolean {
  if (!rencana.dilaporkanAt) return false;
  return tanggalLokal(rencana.dilaporkanAt, zonaWaktu) > rencana.tanggal;
}

/** Rencana untuk diri sendiri MANDIRI; untuk orang lain PENUGASAN. */
export function tentukanSumber(
  salesId: string,
  pembuatId: string,
): RencanaSumber {
  return salesId === pembuatId ? "MANDIRI" : "PENUGASAN";
}

/** Rencana baru tidak boleh bertanggal lampau. */
export function isTanggalBolehDirencanakan(
  tanggal: string,
  hariIni: string,
): boolean {
  return tanggal >= hariIni;
}

/** Apakah rencana milik `salesId` berada dalam lingkup pengguna. */
export function isDalamLingkup(
  salesId: string,
  lingkup: LingkupRencana,
): boolean {
  if (lingkup.jenis === "SEMUA") return true;
  if (salesId === lingkup.penggunaId) return true;
  return lingkup.jenis === "TIM" && lingkup.anggotaIds.includes(salesId);
}

/**
 * Sales yang rencananya boleh dibaca, atau undefined untuk "tanpa batas".
 * Dipakai repository sebagai filter `salesId IN (...)`.
 */
export function salesIdsDalamLingkup(
  lingkup: LingkupRencana,
): string[] | undefined {
  if (lingkup.jenis === "SEMUA") return undefined;
  if (lingkup.jenis === "SENDIRI") return [lingkup.penggunaId];
  return [lingkup.penggunaId, ...lingkup.anggotaIds];
}

/** Rencana hanya bisa diubah, dibatalkan, atau dilaporkan selagi DIRENCANAKAN. */
export function isMasihTerbuka(status: RencanaStatus): boolean {
  return status === "DIRENCANAKAN";
}

/**
 * Siapa yang boleh mengubah/membatalkan sebuah rencana.
 *
 * Sales (lingkup SENDIRI) hanya rencana MANDIRI miliknya — penugasan dari
 * atasan tidak boleh dibatalkan sepihak oleh yang ditugasi. Pengelola (TIM /
 * SEMUA) boleh mengatur semua rencana dalam lingkupnya.
 */
export function isBolehMengatur(
  rencana: Pick<RencanaEntity, "salesId" | "sumber">,
  lingkup: LingkupRencana,
): boolean {
  if (lingkup.jenis === "SENDIRI") {
    return (
      rencana.salesId === lingkup.penggunaId && rencana.sumber === "MANDIRI"
    );
  }
  return isDalamLingkup(rencana.salesId, lingkup);
}

/** Satu baris rekap rencana vs realisasi per sales. */
export interface BarisRekapRencana {
  salesId: string;
  namaSales: string | null;
  total: number;
  selesai: number;
  tepatWaktu: number;
  terlambat: number;
  terlewat: number;
  batal: number;
  mendatang: number;
  /** Selesai ÷ (selesai + terlewat), 0–100; null bila belum ada yang jatuh tempo. */
  persenRealisasi: number | null;
}

const PERSEN_PENUH = 100;

/** Rekap per sales dari sekumpulan rencana pada satu rentang tanggal. */
export function hitungRekapRencana(
  daftar: RencanaEntity[],
  hariIni: string,
  zonaWaktu: string,
): BarisRekapRencana[] {
  const perSales = new Map<string, BarisRekapRencana>();

  for (const rencana of daftar) {
    const baris =
      perSales.get(rencana.salesId) ?? barisRekapKosong(rencana);
    baris.total += 1;
    tambahkanKeRekap(baris, rencana, hariIni, zonaWaktu);
    perSales.set(rencana.salesId, baris);
  }

  return [...perSales.values()]
    .map((baris) => ({ ...baris, persenRealisasi: hitungPersen(baris) }))
    .sort((a, b) => (a.namaSales ?? "").localeCompare(b.namaSales ?? ""));
}

function barisRekapKosong(rencana: RencanaEntity): BarisRekapRencana {
  return {
    salesId: rencana.salesId,
    namaSales: rencana.namaSales,
    total: 0,
    selesai: 0,
    tepatWaktu: 0,
    terlambat: 0,
    terlewat: 0,
    batal: 0,
    mendatang: 0,
    persenRealisasi: null,
  };
}

function tambahkanKeRekap(
  baris: BarisRekapRencana,
  rencana: RencanaEntity,
  hariIni: string,
  zonaWaktu: string,
): void {
  const status = tentukanStatusTampil(rencana, hariIni);
  if (status === "BATAL") {
    baris.batal += 1;
    return;
  }
  if (status === "TERLEWAT") {
    baris.terlewat += 1;
    return;
  }
  if (status === "DIRENCANAKAN") {
    baris.mendatang += 1;
    return;
  }
  baris.selesai += 1;
  if (isLaporanTerlambat(rencana, zonaWaktu)) {
    baris.terlambat += 1;
  } else {
    baris.tepatWaktu += 1;
  }
}

function hitungPersen(baris: BarisRekapRencana): number | null {
  const jatuhTempo = baris.selesai + baris.terlewat;
  if (jatuhTempo === 0) return null;
  return Math.round((baris.selesai / jatuhTempo) * PERSEN_PENUH);
}

/**
 * Dilempar repository di dalam transaksi laporan saat rencana ternyata sudah
 * tidak DIRENCANAKAN (dilaporkan/dibatalkan pihak lain di sela pembacaan) —
 * melemparnya membatalkan kegiatan yang baru dibuat di transaksi yang sama.
 */
export class RencanaSudahDitutupError extends Error {
  constructor(rencanaId: string) {
    super(`Rencana ${rencanaId} sudah tidak terbuka`);
    this.name = "RencanaSudahDitutupError";
  }
}
