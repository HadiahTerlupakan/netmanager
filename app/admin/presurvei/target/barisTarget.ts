import type { SalesPresurveiDto, TargetDto } from "@/modules/presurvei/client";

/** Awalan label sales yang tidak ada di daftar sales aktif. */
const LABEL_SALES_TAK_TERCANTUM = "Sales tak tercantum";

/**
 * Panjang potongan ujung id di label cadangan — sama dengan
 * `PANJANG_POTONGAN_ID` di `modules/presurvei/domain/nama-sales.ts:27`, yang
 * tidak diekspor lewat `@/modules/presurvei/client`.
 */
const PANJANG_POTONGAN_ID = 6;

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
