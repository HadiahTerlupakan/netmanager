import type { Prisma } from "@prisma/client";

/**
 * Kolom `rate` aturan & komisi reseller bertipe Decimal(5,2); domain memakai
 * `number`. Nilai 2 desimal ≤ 100 selalu terwakili tepat oleh `toNumber()`
 * pada presisi tampilan, dan perhitungan komisi memakai basis poin bulat.
 */
export function toRateNumber(rate: Prisma.Decimal | null): number | null {
  return rate === null ? null : rate.toNumber();
}

/** Ganti `rate` Decimal pada baris Prisma dengan `number`. */
export function withNumericRate<
  T extends { readonly rate: Prisma.Decimal | null },
>(row: T): Omit<T, "rate"> & { readonly rate: number | null } {
  return { ...row, rate: toRateNumber(row.rate) };
}
