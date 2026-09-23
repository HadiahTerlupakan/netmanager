import type { SalesPresurveiDto, TargetDto } from "@/modules/presurvei/client";

import { labelSales } from "../labelSales";

/** Akhiran opsi sales yang sudah punya target pada periode yang tampil. */
const AKHIRAN_SUDAH_ADA_TARGET = " (sudah ada target)";

const PESAN_TARGET_KOSONG = "Belum ada target untuk periode ini.";
const PESAN_TARGET_GAGAL = "Target gagal dimuat.";

/** Satu baris tabel target: target beserta label sales-nya. */
export interface BarisTarget extends TargetDto {
  namaSales: string;
}

/** Baris tabel target dari DTO dan daftar sales aktif. */
export function keBarisTarget(
  daftarTarget: readonly TargetDto[],
  daftarSales: readonly SalesPresurveiDto[],
): BarisTarget[] {
  return daftarTarget.map((target) => ({
    ...target,
    namaSales: labelSales(target.userId, daftarSales),
  }));
}

/** Target periode milik sales tertentu, atau null bila belum ada. */
export function cariTargetSales(
  userId: string,
  barisPeriode: readonly BarisTarget[],
): BarisTarget | null {
  return barisPeriode.find((baris) => baris.userId === userId) ?? null;
}

/**
 * Label opsi pemilih sales pada mode buat. Sales yang sudah punya target
 * periode ini diberi akhiran, karena menyimpannya menimpa target lama.
 */
export function labelOpsiSales(
  sales: SalesPresurveiDto,
  barisPeriode: readonly BarisTarget[],
): string {
  return cariTargetSales(sales.id, barisPeriode) === null
    ? sales.nama
    : `${sales.nama}${AKHIRAN_SUDAH_ADA_TARGET}`;
}

/** Pesan tabel tanpa baris: gagal memuat dibedakan dari periode kosong. */
export function pesanTabelKosong(isError: boolean): string {
  return isError ? PESAN_TARGET_GAGAL : PESAN_TARGET_KOSONG;
}
