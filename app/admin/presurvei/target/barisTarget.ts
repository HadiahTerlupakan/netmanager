import type { SalesPresurveiDto, TargetDto } from "@/modules/presurvei/client";

/** Awalan label sales yang tidak ada di daftar sales aktif. */
const LABEL_SALES_TAK_TERCANTUM = "Sales tak tercantum";

/**
 * Panjang potongan ujung id di label cadangan — sama dengan
 * `PANJANG_POTONGAN_ID` di `modules/presurvei/domain/nama-sales.ts:27`, yang
 * tidak diekspor lewat `@/modules/presurvei/client`.
 */
const PANJANG_POTONGAN_ID = 6;

/** Akhiran opsi sales yang sudah punya target pada periode yang tampil. */
const AKHIRAN_SUDAH_ADA_TARGET = " (sudah ada target)";

const PESAN_TARGET_KOSONG = "Belum ada target untuk periode ini.";
const PESAN_TARGET_GAGAL = "Target gagal dimuat.";

/** Satu baris tabel target: target beserta label sales-nya. */
export interface BarisTarget extends TargetDto {
  namaSales: string;
}

/**
 * Label sales untuk satu target.
 *
 * `TargetDto` hanya membawa `userId`, dan daftar sales hanya berisi sales
 * AKTIF (`modules/presurvei/repositories/SalesRepository.ts:32`). Target milik
 * sales yang sudah nonaktif — atau yang tampil saat daftar belum tiba/gagal —
 * mendapat label netral berpotongan ujung id, bergaya "Tanpa nama (…xxxxxx)"
 * dari `nama-sales.ts`. Email dan id utuh sengaja tidak dipakai.
 */
export function labelSalesTarget(
  userId: string,
  daftarSales: readonly SalesPresurveiDto[],
): string {
  const sales = daftarSales.find((kandidat) => kandidat.id === userId);
  if (sales) return sales.nama;

  return `${LABEL_SALES_TAK_TERCANTUM} (…${userId.slice(-PANJANG_POTONGAN_ID)})`;
}

/** Baris tabel target dari DTO dan daftar sales aktif. */
export function keBarisTarget(
  daftarTarget: readonly TargetDto[],
  daftarSales: readonly SalesPresurveiDto[],
): BarisTarget[] {
  return daftarTarget.map((target) => ({
    ...target,
    namaSales: labelSalesTarget(target.userId, daftarSales),
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
