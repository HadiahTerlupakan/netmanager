import type { SalesPresurveiDto } from "@/modules/presurvei/client";

/** Awalan label sales yang tidak ada di daftar sales aktif. */
const LABEL_SALES_TAK_TERCANTUM = "Sales tak tercantum";

/**
 * Panjang potongan ujung id di label cadangan — sama dengan
 * `PANJANG_POTONGAN_ID` di `modules/presurvei/domain/nama-sales.ts:27`, yang
 * tidak diekspor lewat `@/modules/presurvei/client`.
 */
const PANJANG_POTONGAN_ID = 6;

/**
 * Label sales untuk baris yang hanya membawa `userId` (target dan laporan,
 * `modules/presurvei/dto/target.dto.ts:8-26`).
 *
 * Daftar sales hanya berisi sales AKTIF
 * (`modules/presurvei/repositories/SalesRepository.ts:32`). Baris milik sales
 * yang sudah nonaktif — atau yang tampil saat daftar belum tiba/gagal —
 * mendapat label netral berpotongan ujung id, bergaya "Tanpa nama (…xxxxxx)"
 * dari `nama-sales.ts`. Email dan id utuh sengaja tidak dipakai.
 */
export function labelSales(
  userId: string,
  daftarSales: readonly SalesPresurveiDto[],
): string {
  const sales = daftarSales.find((kandidat) => kandidat.id === userId);
  if (sales) return sales.nama;

  return `${LABEL_SALES_TAK_TERCANTUM} (…${userId.slice(-PANJANG_POTONGAN_ID)})`;
}
